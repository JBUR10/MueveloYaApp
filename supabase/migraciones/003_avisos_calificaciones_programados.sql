-- =====================================================================
-- Muévelo Ya · 003: programados, cancelación del cliente, avisos,
--                   calificaciones, quejas y margen entre servicios
-- ---------------------------------------------------------------------
-- Requiere 001 y 002. Idempotente: se puede volver a ejecutar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) SERVICIOS: inicio del servicio y cancelación por el cliente
-- ---------------------------------------------------------------------
alter table public.servicios
  add column if not exists iniciada_el   timestamptz,
  add column if not exists cancelada_el  timestamptz,
  add column if not exists cancelada_por text;

alter table public.servicios drop constraint if exists servicios_estado_valido;
alter table public.servicios
  add constraint servicios_estado_valido
  check (estado in ('pendiente', 'aceptada', 'en_curso', 'completada', 'cancelada'));

-- Los servicios ya aceptados antes de este script: los inmediatos y los que
-- van en curso se consideran iniciados.
update public.servicios
   set iniciada_el = coalesce(aceptada_el, now())
 where iniciada_el is null
   and (estado = 'en_curso'
        or (estado = 'aceptada' and tipo_programacion is distinct from 'programado'));

-- Relación servicios.user_id -> perfiles (para ver la calificación del cliente).
-- NOT VALID: no revisa filas viejas de usuarios anónimos ya borrados.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'servicios_user_id_perfil_fkey'
  ) then
    alter table public.servicios
      add constraint servicios_user_id_perfil_fkey
      foreign key (user_id) references public.perfiles (id) on delete cascade not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) PERFILES: promedio de calificaciones
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists calificacion_promedio numeric(3, 2),
  add column if not exists calificaciones_total  integer not null default 0;

-- El transportista también ve el perfil (nombre y calificación) de los
-- clientes cuyas solicitudes puede ver.
drop policy if exists "perfiles: transportista ve clientes" on public.perfiles;
create policy "perfiles: transportista ve clientes" on public.perfiles
  for select to authenticated
  using (
    exists (
      select 1 from public.servicios s
      where s.user_id = perfiles.id
        and (s.transportista_id = auth.uid()
             or (s.estado = 'pendiente' and public.documentos_vigentes(auth.uid())))
    )
  );

-- ---------------------------------------------------------------------
-- 3) NOTIFICACIONES (avisos dentro de la app)
-- ---------------------------------------------------------------------
create table if not exists public.notificaciones (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  servicio_id uuid references public.servicios (id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  mensaje     text not null,
  leida       boolean not null default false,
  creada_el   timestamptz not null default now()
);

create index if not exists notificaciones_usuario_idx
  on public.notificaciones (usuario_id, leida);

alter table public.notificaciones enable row level security;

drop policy if exists "notificaciones: ver propias" on public.notificaciones;
create policy "notificaciones: ver propias" on public.notificaciones
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "notificaciones: marcar leidas" on public.notificaciones;
create policy "notificaciones: marcar leidas" on public.notificaciones
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Solo las funciones del servidor crean avisos.
create or replace function public.notificar(
  p_usuario uuid, p_servicio uuid, p_tipo text, p_titulo text, p_mensaje text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notificaciones (usuario_id, servicio_id, tipo, titulo, mensaje)
  values (p_usuario, p_servicio, p_tipo, p_titulo, p_mensaje);
$$;

revoke execute on function public.notificar(uuid, uuid, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) MARGEN ENTRE SERVICIOS DEL MISMO CONDUCTOR
-- ---------------------------------------------------------------------
-- Duración estimada según el tipo: es el margen mínimo con otro servicio.
create or replace function public.margen_servicio(p_tipo text)
returns interval
language sql
immutable
as $$
  select case p_tipo
    when 'Envío'   then interval '2 hours'
    when 'Acarreo' then interval '3 hours'
    when 'Trasteo' then interval '4 hours'
    when 'Mudanza' then interval '6 hours'
    else interval '3 hours'
  end;
$$;

-- Hora en que se presta el servicio: la programada, o para los inmediatos
-- la hora en que se inició (si aún no, ahora mismo).
create or replace function public.hora_efectiva(s public.servicios)
returns timestamptz
language sql
stable
as $$
  select case
    when s.tipo_programacion = 'programado' then public.fecha_del_servicio(s)
    else coalesce(s.iniciada_el, s.aceptada_el, now())
  end;
$$;

create or replace function public.texto_hora(t timestamptz)
returns text
language sql
stable
as $$
  select to_char(t at time zone 'America/Bogota', 'DD/MM HH12:MI AM');
$$;

-- ---------------------------------------------------------------------
-- 5) FUNCIONES DEL FLUJO (reemplazan las de 001)
-- ---------------------------------------------------------------------

create or replace function public.aceptar_servicio(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo  public.servicios;
  choque public.servicios;
  fila   public.servicios;
  programado boolean;
  margen interval;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.documentos_vigentes(auth.uid()) then
    raise exception 'Tus documentos no están vigentes. Actualízalos en tu vehículo.';
  end if;

  select * into nuevo from public.servicios
   where id = p_servicio and estado = 'pendiente' and user_id <> auth.uid()
   for update;
  if nuevo.id is null then
    raise exception 'Esta solicitud ya no está disponible.';
  end if;

  programado := nuevo.tipo_programacion = 'programado';

  -- Un inmediato no se puede tomar mientras haya otro servicio en marcha.
  if not programado and exists (
    select 1 from public.servicios s
    where s.transportista_id = auth.uid()
      and s.estado in ('aceptada', 'en_curso')
      and s.iniciada_el is not null
  ) then
    raise exception 'Termina tu servicio en curso antes de aceptar uno inmediato.';
  end if;

  -- Margen con los demás servicios del conductor (el del servicio más largo).
  select s.* into choque
    from public.servicios s
   where s.transportista_id = auth.uid()
     and s.estado in ('aceptada', 'en_curso')
     and abs(extract(epoch from (public.hora_efectiva(s) - public.hora_efectiva(nuevo))))
         < extract(epoch from greatest(public.margen_servicio(s.tipo_servicio),
                                       public.margen_servicio(nuevo.tipo_servicio)))
   limit 1;

  if choque.id is not null then
    margen := greatest(public.margen_servicio(choque.tipo_servicio),
                       public.margen_servicio(nuevo.tipo_servicio));
    raise exception 'Se cruza con tu servicio de % del %. Debe haber al menos % h de diferencia.',
      lower(choque.tipo_servicio),
      public.texto_hora(public.hora_efectiva(choque)),
      extract(hour from margen);
  end if;

  update public.servicios
     set estado = 'aceptada',
         transportista_id = auth.uid(),
         aceptada_el = now(),
         -- Los programados se inician después, desde "Aceptadas".
         iniciada_el = case when programado then null else now() end
   where id = nuevo.id
  returning * into fila;

  perform public.notificar(
    fila.user_id, fila.id, 'aceptada',
    'Solicitud aceptada',
    case when programado
      then 'Un transportista aceptó tu ' || lower(fila.tipo_servicio) || ' programado para el ' || fila.fecha_programada || '.'
      else 'Un transportista aceptó tu ' || lower(fila.tipo_servicio) || ' y va en camino al punto de recogida.'
    end
  );
  return fila;
end;
$$;

-- El conductor sale hacia el punto de recogida de un servicio programado.
create or replace function public.iniciar_servicio(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  if exists (
    select 1 from public.servicios s
    where s.transportista_id = auth.uid()
      and s.estado in ('aceptada', 'en_curso')
      and s.iniciada_el is not null
      and s.id <> p_servicio
  ) then
    raise exception 'Termina tu servicio en curso antes de iniciar otro.';
  end if;

  update public.servicios
     set iniciada_el = now()
   where id = p_servicio and transportista_id = auth.uid()
     and estado = 'aceptada' and iniciada_el is null
  returning * into fila;

  if fila.id is null then
    raise exception 'No se pudo iniciar el servicio.';
  end if;

  perform public.notificar(
    fila.user_id, fila.id, 'iniciada',
    'Tu transportista va en camino',
    'El transportista inició tu ' || lower(fila.tipo_servicio) || ' y va hacia el punto de recogida.'
  );
  return fila;
end;
$$;

-- El conductor cancela (mínimo 48 h antes y sin haberlo iniciado).
-- La solicitud vuelve a quedar disponible para otros transportistas.
create or replace function public.cancelar_servicio(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  actual public.servicios;
  fila   public.servicios;
begin
  select * into actual from public.servicios
   where id = p_servicio and transportista_id = auth.uid() and estado = 'aceptada'
   for update;

  if actual.id is null then
    raise exception 'Esta solicitud no está aceptada por ti.';
  end if;
  if actual.iniciada_el is not null then
    raise exception 'No puedes cancelar un servicio que ya iniciaste.';
  end if;
  if public.fecha_del_servicio(actual) - now() < interval '48 hours' then
    raise exception 'No puedes cancelar con menos de 48 horas de anticipación.';
  end if;

  insert into public.cancelaciones (servicio_id, transportista_id, aceptada_el)
  values (actual.id, auth.uid(), actual.aceptada_el);

  update public.servicios
     set estado = 'pendiente', transportista_id = null,
         aceptada_el = null, iniciada_el = null
   where id = actual.id
  returning * into fila;

  perform public.notificar(
    fila.user_id, fila.id, 'cancelada_conductor',
    'Tu servicio fue cancelado',
    'El transportista canceló tu ' || lower(fila.tipo_servicio) || ' programado para el '
      || fila.fecha_programada || '. Tu solicitud vuelve a estar disponible para otros transportistas.'
  );
  return fila;
end;
$$;

-- El cliente cancela un servicio ya aceptado (mínimo 48 h antes y sin iniciar).
create or replace function public.cancelar_servicio_cliente(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  actual public.servicios;
  fila   public.servicios;
begin
  select * into actual from public.servicios
   where id = p_servicio and user_id = auth.uid() and estado = 'aceptada'
   for update;

  if actual.id is null then
    raise exception 'Este servicio no se puede cancelar.';
  end if;
  if actual.iniciada_el is not null then
    raise exception 'El transportista ya inició el servicio: no se puede cancelar.';
  end if;
  if public.fecha_del_servicio(actual) - now() < interval '48 hours' then
    raise exception 'No puedes cancelar con menos de 48 horas de anticipación.';
  end if;

  update public.servicios
     set estado = 'cancelada', cancelada_el = now(), cancelada_por = 'cliente'
   where id = actual.id
  returning * into fila;

  perform public.notificar(
    fila.transportista_id, fila.id, 'cancelada_cliente',
    'Han cancelado el servicio',
    'El cliente canceló el ' || lower(fila.tipo_servicio) || ' programado para el '
      || fila.fecha_programada || '.'
  );
  return fila;
end;
$$;

create or replace function public.marcar_recogido(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  update public.servicios
     set estado = 'en_curso', recogida_el = now()
   where id = p_servicio and transportista_id = auth.uid()
     and estado = 'aceptada' and iniciada_el is not null
  returning * into fila;

  if fila.id is null then
    raise exception 'No se pudo marcar como recogido.';
  end if;

  perform public.notificar(
    fila.user_id, fila.id, 'recogida',
    'Carga recogida',
    'El transportista recogió tu carga y va hacia el punto de entrega.'
  );
  return fila;
end;
$$;

create or replace function public.completar_servicio(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  update public.servicios
     set estado = 'completada', completada_el = now()
   where id = p_servicio and transportista_id = auth.uid() and estado = 'en_curso'
  returning * into fila;

  if fila.id is null then
    raise exception 'No se pudo finalizar el servicio.';
  end if;

  perform public.notificar(
    fila.user_id, fila.id, 'completada',
    'Servicio finalizado',
    'Tu ' || lower(fila.tipo_servicio) || ' fue entregado. ¡Cuéntanos qué tal te fue!'
  );
  return fila;
end;
$$;

revoke execute on function public.iniciar_servicio(uuid)          from anon;
revoke execute on function public.cancelar_servicio_cliente(uuid) from anon;

-- ---------------------------------------------------------------------
-- 6) CALIFICACIONES (cliente <-> transportista)
-- ---------------------------------------------------------------------
create table if not exists public.calificaciones (
  id             bigint generated always as identity primary key,
  servicio_id    uuid not null references public.servicios (id) on delete cascade,
  autor_id       uuid not null references public.perfiles (id) on delete cascade,
  calificado_id  uuid not null references public.perfiles (id) on delete cascade,
  rol_autor      text not null check (rol_autor in ('cliente', 'transportista')),
  estrellas      smallint not null check (estrellas between 1 and 5),
  estrellas_app  smallint check (estrellas_app between 1 and 5),
  recomendaria   boolean,
  comentario     text not null default '',
  tuvo_problema  boolean not null default false,
  creada_el      timestamptz not null default now(),
  unique (servicio_id, autor_id)
);

alter table public.calificaciones enable row level security;

drop policy if exists "calificaciones: ver propias o recibidas" on public.calificaciones;
create policy "calificaciones: ver propias o recibidas" on public.calificaciones
  for select to authenticated
  using (autor_id = auth.uid() or calificado_id = auth.uid());

create or replace function public.calificar_servicio(
  p_servicio uuid,
  p_estrellas smallint,
  p_estrellas_app smallint default null,
  p_recomendaria boolean default null,
  p_comentario text default '',
  p_tuvo_problema boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.servicios;
  rol text;
  calificado uuid;
begin
  select * into s from public.servicios where id = p_servicio and estado = 'completada';
  if s.id is null then
    raise exception 'Solo se pueden calificar servicios finalizados.';
  end if;

  if s.user_id = auth.uid() then
    rol := 'cliente';
    calificado := s.transportista_id;
  elsif s.transportista_id = auth.uid() then
    rol := 'transportista';
    calificado := s.user_id;
  else
    raise exception 'No participaste en este servicio.';
  end if;

  insert into public.calificaciones (
    servicio_id, autor_id, calificado_id, rol_autor, estrellas,
    estrellas_app, recomendaria, comentario, tuvo_problema
  ) values (
    s.id, auth.uid(), calificado, rol, p_estrellas,
    case when rol = 'cliente' then p_estrellas_app end,
    case when rol = 'cliente' then p_recomendaria end,
    coalesce(p_comentario, ''),
    coalesce(p_tuvo_problema, false)
  );

  update public.perfiles p
     set calificacion_promedio = c.promedio,
         calificaciones_total  = c.total
    from (
      select avg(estrellas)::numeric(3, 2) as promedio, count(*) as total
      from public.calificaciones where calificado_id = calificado
    ) c
   where p.id = calificado;
exception when unique_violation then
  raise exception 'Ya calificaste este servicio.';
end;
$$;

revoke execute on function public.calificar_servicio(uuid, smallint, smallint, boolean, text, boolean) from anon;

-- ---------------------------------------------------------------------
-- 7) QUEJAS
-- ---------------------------------------------------------------------
create table if not exists public.quejas (
  id          bigint generated always as identity primary key,
  servicio_id uuid references public.servicios (id) on delete set null,
  autor_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo        text not null,
  descripcion text not null,
  estado      text not null default 'abierta',
  creada_el   timestamptz not null default now()
);

alter table public.quejas enable row level security;

drop policy if exists "quejas: crear propias" on public.quejas;
create policy "quejas: crear propias" on public.quejas
  for insert to authenticated
  with check (autor_id = auth.uid());

drop policy if exists "quejas: ver propias" on public.quejas;
create policy "quejas: ver propias" on public.quejas
  for select to authenticated
  using (autor_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8) REALTIME para los avisos
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;
