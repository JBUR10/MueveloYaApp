-- Muévelo Ya · 019: evidencias con fotos y sanciones a transportistas
--
-- * El cliente adjunta fotos a su queja (hasta 5; obligatorias si es
--   «Daño o pérdida»).
-- * El transportista toma fotos de los artículos al recogerlos (1 a 10);
--   sin fotos no puede marcar «Recogido».
-- * El administrador revisa la queja comparando ambas evidencias y la
--   descarta o la confirma con una gravedad. La sanción se aplica sola:
--
--     gravedad     cuenta normal                 cuenta condicionada
--     minima       advertencia (3 → 5 días)      1 semana
--     baja         1 semana                      2 semanas
--     media        2 semanas                     definitiva
--     severa       definitiva                    definitiva
--
--   Tras cualquier suspensión temporal las advertencias vuelven a 0 y la
--   cuenta queda condicionada; la condición se quita con 30 días Y 15
--   viajes completados sin quejas confirmadas.
-- * Suspendido solo se bloquea el modo conductor (documentos_vigentes).
--   Sus servicios aceptados (aún sin recoger) vuelven a quedar pendientes.
--
-- Requiere 001–016 (y la 017 y 018 de los compañeros, si ya existen). Idempotente: se puede volver a ejecutar.

-- ---------------------------------------------------------------------
-- 1) ALMACENAMIENTO DE FOTOS (Supabase Storage, bucket privado)
--    Ruta de cada archivo: <id del usuario>/<carpeta>/<nombre>.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuario sube solo a su carpeta. No se pueden editar ni borrar
-- (así el transportista no puede quitar sus fotos después).
drop policy if exists "evidencias: subir propias" on storage.objects;
create policy "evidencias: subir propias" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "evidencias: ver propias o admin" on storage.objects;
create policy "evidencias: ver propias o admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.soy_admin())
  );

-- ---------------------------------------------------------------------
-- 2) QUEJAS: resultado de la revisión del administrador
--    estado: abierta | confirmada | descartada
-- ---------------------------------------------------------------------
alter table public.quejas
  add column if not exists gravedad     text,
  add column if not exists nota_admin   text,
  add column if not exists resuelta_el  timestamptz,
  add column if not exists resuelta_por uuid references public.perfiles (id) on delete set null;

alter table public.quejas drop constraint if exists quejas_gravedad_valida;
alter table public.quejas add constraint quejas_gravedad_valida
  check (gravedad is null or gravedad in ('minima', 'baja', 'media', 'severa'));

-- ---------------------------------------------------------------------
-- 3) EVIDENCIAS (una fila por foto)
-- ---------------------------------------------------------------------
create table if not exists public.evidencias (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('queja', 'recogida')),
  queja_id    bigint references public.quejas (id) on delete cascade,
  servicio_id uuid references public.servicios (id) on delete cascade,
  ruta        text not null unique,
  subida_por  uuid not null references public.perfiles (id) on delete cascade,
  creada_el   timestamptz not null default now(),
  constraint evidencias_destino check (
    (tipo = 'queja' and queja_id is not null)
    or (tipo = 'recogida' and servicio_id is not null)
  )
);
create index if not exists evidencias_queja_idx on public.evidencias (queja_id);
create index if not exists evidencias_servicio_idx on public.evidencias (servicio_id);

alter table public.evidencias enable row level security;

-- Solo lectura; se crean con crear_queja() y marcar_recogido().
drop policy if exists "evidencias: ver propias o admin" on public.evidencias;
create policy "evidencias: ver propias o admin" on public.evidencias
  for select to authenticated
  using (subida_por = auth.uid() or public.soy_admin());

-- ---------------------------------------------------------------------
-- 4) ESTADO DISCIPLINARIO DEL CONDUCTOR E HISTORIAL DE SANCIONES
--    Va aparte de "perfiles" porque el usuario puede editar su perfil.
-- ---------------------------------------------------------------------
create table if not exists public.conductor_disciplina (
  transportista_id      uuid primary key references public.perfiles (id) on delete cascade,
  advertencias          smallint not null default 0,
  suspendido_hasta      timestamptz,
  suspension_definitiva boolean not null default false,
  -- Desde cuándo corre la condición (= fin de la última suspensión).
  condicionado_desde    timestamptz,
  actualizado_el        timestamptz not null default now()
);

alter table public.conductor_disciplina enable row level security;

drop policy if exists "disciplina: ver propia o admin" on public.conductor_disciplina;
create policy "disciplina: ver propia o admin" on public.conductor_disciplina
  for select to authenticated
  using (transportista_id = auth.uid() or public.soy_admin());

create table if not exists public.sanciones (
  id                   bigint generated always as identity primary key,
  queja_id             bigint references public.quejas (id) on delete set null,
  transportista_id     uuid not null references public.perfiles (id) on delete cascade,
  gravedad             text not null check (gravedad in ('minima', 'baja', 'media', 'severa')),
  estaba_condicionado  boolean not null default false,
  accion               text not null check (accion in ('advertencia', 'suspension', 'definitiva')),
  dias                 smallint,
  inicia_el            timestamptz not null default now(),
  termina_el           timestamptz,
  anulada_el           timestamptz,
  creada_por           uuid references public.perfiles (id) on delete set null,
  creada_el            timestamptz not null default now(),
  -- Estado anterior, para poder anular la sanción.
  prev_advertencias      smallint not null default 0,
  prev_suspendido_hasta  timestamptz,
  prev_definitiva        boolean not null default false,
  prev_condicionado_desde timestamptz
);
create index if not exists sanciones_transportista_idx
  on public.sanciones (transportista_id, creada_el desc);

alter table public.sanciones enable row level security;

drop policy if exists "sanciones: ver propias o admin" on public.sanciones;
create policy "sanciones: ver propias o admin" on public.sanciones
  for select to authenticated
  using (transportista_id = auth.uid() or public.soy_admin());

-- ---------------------------------------------------------------------
-- 5) ¿SUSPENDIDO? ¿CONDICIONADO?
-- ---------------------------------------------------------------------
create or replace function public.esta_suspendido(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conductor_disciplina d
    where d.transportista_id = uid
      and (d.suspension_definitiva or d.suspendido_hasta > now())
  );
$$;

-- Viajes completados desde que empezó la condición.
create or replace function public.viajes_en_condicion(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.servicios s
    join public.conductor_disciplina d on d.transportista_id = uid
   where s.transportista_id = uid
     and s.estado = 'completada'
     and d.condicionado_desde is not null
     and s.completada_el >= d.condicionado_desde;
$$;

-- Condicionado hasta cumplir 30 días Y 15 viajes desde el fin de la
-- última suspensión. Toda queja confirmada en ese tiempo genera una
-- nueva suspensión, que vuelve a empezar la cuenta.
create or replace function public.esta_condicionado(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select d.condicionado_desde is not null
       and not d.suspension_definitiva
       and not (now() >= d.condicionado_desde + interval '30 days'
                and public.viajes_en_condicion(uid) >= 15)
      from public.conductor_disciplina d
     where d.transportista_id = uid
  ), false);
$$;

revoke execute on function public.esta_suspendido(uuid)     from public, anon;
revoke execute on function public.viajes_en_condicion(uuid) from public, anon;
revoke execute on function public.esta_condicionado(uuid)   from public, anon;

-- documentos_vigentes (005) + no estar suspendido. Con esto, un
-- suspendido no ve solicitudes, no puede aceptarlas, no puede ponerse
-- «Disponible» y no recibe push de solicitudes nuevas.
create or replace function public.documentos_vigentes(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehiculos v
    where v.transportista_id = uid
      and v.verificacion = 'aprobado'
      and v.soat_vence >= current_date
      and v.licencia_conduccion_vence >= current_date
      and (v.tecnomecanica_exento or v.tecnomecanica_vence >= current_date)
  )
  and not public.esta_suspendido(uid);
$$;

-- Para la app del conductor.
create or replace function public.mi_estado_conductor()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d public.conductor_disciplina;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  select * into d from public.conductor_disciplina where transportista_id = v_uid;
  return jsonb_build_object(
    'suspendido',        public.esta_suspendido(v_uid),
    'definitiva',        coalesce(d.suspension_definitiva, false),
    'suspendido_hasta',  case when d.suspendido_hasta > now() then d.suspendido_hasta end,
    'advertencias',      coalesce(d.advertencias, 0),
    'condicionado',      public.esta_condicionado(v_uid),
    'condicion_desde',   d.condicionado_desde,
    'viajes_condicion',  public.viajes_en_condicion(v_uid),
    'viajes_requeridos', 15,
    'dias_requeridos',   30
  );
end;
$$;
revoke all on function public.mi_estado_conductor() from public, anon;
grant execute on function public.mi_estado_conductor() to authenticated;

-- ---------------------------------------------------------------------
-- 6) VALIDAR FOTOS SUBIDAS
--    Deben estar en la carpeta del usuario y existir en el bucket.
-- ---------------------------------------------------------------------
create or replace function public.validar_fotos(p_fotos text[], p_min int, p_max int)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fotos text[];
  v_existen int;
begin
  select coalesce(array_agg(distinct f), '{}') into v_fotos
    from unnest(coalesce(p_fotos, '{}')) f
   where f is not null and f <> '';

  if cardinality(v_fotos) < p_min then
    raise exception 'Debes adjuntar al menos % foto(s).', p_min;
  end if;
  if cardinality(v_fotos) > p_max then
    raise exception 'Puedes adjuntar máximo % fotos.', p_max;
  end if;
  if exists (select 1 from unnest(v_fotos) f where f not like auth.uid()::text || '/%') then
    raise exception 'Alguna foto no es válida.';
  end if;

  select count(*) into v_existen
    from storage.objects o
   where o.bucket_id = 'evidencias' and o.name = any (v_fotos);
  if v_existen <> cardinality(v_fotos) then
    raise exception 'Alguna foto no terminó de subirse. Inténtalo de nuevo.';
  end if;
  return v_fotos;
end;
$$;
revoke execute on function public.validar_fotos(text[], int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) CREAR QUEJA CON FOTOS
-- ---------------------------------------------------------------------
create or replace function public.crear_queja(
  p_servicio uuid, p_tipo text, p_descripcion text, p_fotos text[] default '{}'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fotos text[];
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if coalesce(trim(p_tipo), '') = '' then
    raise exception 'Elige el tipo de problema.';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) < 10 then
    raise exception 'Cuéntanos qué pasó (mínimo 10 caracteres).';
  end if;
  if p_servicio is not null and not exists (
    select 1 from public.servicios
     where id = p_servicio and (user_id = v_uid or transportista_id = v_uid)
  ) then
    raise exception 'Ese servicio no es tuyo.';
  end if;

  v_fotos := public.validar_fotos(
    p_fotos, case when p_tipo = 'Daño o pérdida' then 1 else 0 end, 5);

  insert into public.quejas (servicio_id, autor_id, tipo, descripcion)
  values (p_servicio, v_uid, trim(p_tipo), trim(p_descripcion))
  returning id into v_id;

  insert into public.evidencias (tipo, queja_id, servicio_id, ruta, subida_por)
  select 'queja', v_id, p_servicio, f, v_uid from unnest(v_fotos) f;

  return v_id;
end;
$$;
revoke all on function public.crear_queja(uuid, text, text, text[]) from public, anon;
grant execute on function public.crear_queja(uuid, text, text, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 8) MARCAR RECOGIDO: ahora exige las fotos de los artículos
--    Se elimina la versión sin fotos para que no se pueda saltar.
-- ---------------------------------------------------------------------
drop function if exists public.marcar_recogido(uuid);

create or replace function public.marcar_recogido(p_servicio uuid, p_fotos text[])
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
  v_fotos text[];
begin
  v_fotos := public.validar_fotos(p_fotos, 1, 10);

  update public.servicios
     set estado = 'en_curso', recogida_el = now()
   where id = p_servicio and transportista_id = auth.uid()
     and estado = 'aceptada' and iniciada_el is not null
  returning * into fila;

  if fila.id is null then
    raise exception 'No se pudo marcar como recogido.';
  end if;

  insert into public.evidencias (tipo, servicio_id, ruta, subida_por)
  select 'recogida', fila.id, f, auth.uid() from unnest(v_fotos) f
  on conflict (ruta) do nothing;

  perform public.notificar(
    fila.user_id, fila.id, 'recogida',
    'Carga recogida',
    'El transportista recogió tu carga, registró ' || cardinality(v_fotos)
      || ' foto(s) del estado de tus artículos y va hacia el punto de entrega.'
  );
  return fila;
end;
$$;
revoke all on function public.marcar_recogido(uuid, text[]) from public, anon;
grant execute on function public.marcar_recogido(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 9) ADMIN: LISTA DE QUEJAS
--    p_filtro: 'abiertas' | 'revisadas'
-- ---------------------------------------------------------------------
create or replace function public.quejas_admin(p_filtro text default 'abiertas')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver las quejas.';
  end if;

  select jsonb_agg(fila order by (fila->>'creada_el') desc) into v_res
  from (
    select jsonb_build_object(
      'id', q.id,
      'tipo', q.tipo,
      'descripcion', q.descripcion,
      'estado', q.estado,
      'gravedad', q.gravedad,
      'nota_admin', q.nota_admin,
      'creada_el', q.creada_el,
      'resuelta_el', q.resuelta_el,
      'autor_es_cliente', s.user_id is not null and q.autor_id = s.user_id,
      'servicio', case when s.id is null then null else jsonb_build_object(
          'id', s.id, 'tipo_servicio', s.tipo_servicio,
          'origen', s.origen, 'destino', s.destino,
          'fecha', s.fecha, 'recogida_el', s.recogida_el,
          'completada_el', s.completada_el) end,
      'cliente', jsonb_build_object('nombre', pa.nombre, 'telefono', pa.telefono),
      'transportista', case when pt.id is null then null else jsonb_build_object(
          'id', pt.id, 'nombre', pt.nombre, 'telefono', pt.telefono,
          'advertencias', coalesce(d.advertencias, 0),
          'suspendido', public.esta_suspendido(pt.id),
          'definitiva', coalesce(d.suspension_definitiva, false),
          'suspendido_hasta', case when d.suspendido_hasta > now() then d.suspendido_hasta end,
          'condicionado', public.esta_condicionado(pt.id)) end,
      'fotos_cliente', coalesce((
          select jsonb_agg(e.ruta order by e.id) from public.evidencias e
           where e.queja_id = q.id), '[]'::jsonb),
      'fotos_recogida', coalesce((
          select jsonb_agg(e.ruta order by e.id) from public.evidencias e
           where e.tipo = 'recogida' and e.servicio_id = q.servicio_id), '[]'::jsonb),
      'sancion', (
          select jsonb_build_object(
                   'id', sa.id, 'accion', sa.accion, 'dias', sa.dias,
                   'termina_el', sa.termina_el, 'anulada_el', sa.anulada_el,
                   'estaba_condicionado', sa.estaba_condicionado,
                   'es_la_ultima', not exists (
                      select 1 from public.sanciones s2
                       where s2.transportista_id = sa.transportista_id
                         and s2.anulada_el is null and s2.id > sa.id))
            from public.sanciones sa
           where sa.queja_id = q.id
           order by sa.id desc limit 1)
    ) as fila
    from public.quejas q
    left join public.servicios s on s.id = q.servicio_id
    left join public.perfiles pa on pa.id = q.autor_id
    left join public.perfiles pt on pt.id = s.transportista_id
    left join public.conductor_disciplina d on d.transportista_id = pt.id
    where case when p_filtro = 'revisadas' then q.estado <> 'abierta'
               else q.estado = 'abierta' end
    order by q.creada_el desc
    limit 100
  ) t;

  return coalesce(v_res, '[]'::jsonb);
end;
$$;
revoke all on function public.quejas_admin(text) from public, anon;
grant execute on function public.quejas_admin(text) to authenticated;

-- ---------------------------------------------------------------------
-- 10) ADMIN: RESOLVER UNA QUEJA
--     p_gravedad null = descartar (p. ej. las fotos de la recogida
--     muestran que el daño ya existía).
-- ---------------------------------------------------------------------
create or replace function public.resolver_queja(
  p_queja bigint, p_gravedad text, p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quejas;
  s public.servicios;
  d public.conductor_disciplina;
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_cond boolean;
  v_nivel int;
  v_accion text;
  v_dias int;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_titulo text;
  v_msg text;
  v_servicio text;
  r record;
begin
  if not public.soy_admin() then
    raise exception 'No tienes permiso para revisar quejas.';
  end if;

  select * into q from public.quejas where id = p_queja for update;
  if q.id is null then
    raise exception 'La queja no existe.';
  end if;
  if q.estado <> 'abierta' then
    raise exception 'Esta queja ya fue revisada.';
  end if;

  if q.servicio_id is not null then
    select * into s from public.servicios where id = q.servicio_id;
  end if;
  v_servicio := coalesce(lower(s.tipo_servicio), 'servicio');

  -- Descartar
  if p_gravedad is null then
    update public.quejas
       set estado = 'descartada', nota_admin = v_nota,
           resuelta_el = now(), resuelta_por = auth.uid()
     where id = q.id;
    perform public.notificar(
      q.autor_id, q.servicio_id, 'queja_revisada',
      'Revisamos tu queja',
      'Revisamos tu queja sobre el ' || v_servicio || ' y la cerramos sin sanción para el transportista.'
        || coalesce(' ' || v_nota, '')
    );
    return jsonb_build_object('estado', 'descartada');
  end if;

  if p_gravedad not in ('minima', 'baja', 'media', 'severa') then
    raise exception 'Gravedad no válida.';
  end if;
  if s.id is null or s.transportista_id is null then
    raise exception 'Esta queja no tiene un transportista asignado para sancionar.';
  end if;
  if q.autor_id <> s.user_id then
    raise exception 'Solo se sanciona por quejas del cliente del servicio.';
  end if;

  insert into public.conductor_disciplina (transportista_id)
  values (s.transportista_id)
  on conflict (transportista_id) do nothing;
  select * into d from public.conductor_disciplina
   where transportista_id = s.transportista_id for update;

  v_cond := public.esta_condicionado(s.transportista_id);
  v_nivel := case p_gravedad
               when 'minima' then 0 when 'baja' then 1
               when 'media'  then 2 else 3 end;
  if v_cond then
    v_nivel := least(v_nivel + 1, 3);
  end if;

  if d.suspension_definitiva then
    v_nivel := 3;  -- ya estaba suspendido definitivamente
  end if;

  if v_nivel = 0 then
    if d.advertencias + 1 >= 3 then
      v_accion := 'suspension'; v_dias := 5;
    else
      v_accion := 'advertencia';
    end if;
  elsif v_nivel = 1 then
    v_accion := 'suspension'; v_dias := 7;
  elsif v_nivel = 2 then
    v_accion := 'suspension'; v_dias := 14;
  else
    v_accion := 'definitiva';
  end if;

  -- Si ya está suspendido, la nueva suspensión se suma al final.
  v_inicio := greatest(now(), coalesce(d.suspendido_hasta, now()));
  if v_accion = 'suspension' then
    v_fin := v_inicio + make_interval(days => v_dias);
  end if;

  insert into public.sanciones (
    queja_id, transportista_id, gravedad, estaba_condicionado, accion, dias,
    inicia_el, termina_el, creada_por,
    prev_advertencias, prev_suspendido_hasta, prev_definitiva, prev_condicionado_desde)
  values (
    q.id, s.transportista_id, p_gravedad, v_cond, v_accion, v_dias,
    case when v_accion = 'advertencia' then now() else v_inicio end, v_fin, auth.uid(),
    d.advertencias, d.suspendido_hasta, d.suspension_definitiva, d.condicionado_desde);

  if v_accion = 'advertencia' then
    update public.conductor_disciplina
       set advertencias = advertencias + 1, actualizado_el = now()
     where transportista_id = s.transportista_id;
    v_titulo := 'Advertencia por daño';
    v_msg := 'Se confirmó una queja por daño mínimo en tu ' || v_servicio
      || '. Llevas ' || (d.advertencias + 1) || ' de 3 advertencias: al llegar a 3 '
      || 'tu cuenta de conductor se suspende 5 días. Toma fotos claras en cada recogida.';
  elsif v_accion = 'suspension' then
    update public.conductor_disciplina
       set suspendido_hasta = v_fin, advertencias = 0,
           condicionado_desde = v_fin, actualizado_el = now()
     where transportista_id = s.transportista_id;
    v_titulo := 'Cuenta de conductor suspendida';
    v_msg := 'Por una queja de daño confirmada en tu ' || v_servicio
      || ', tu modo conductor queda suspendido ' || v_dias || ' días, hasta el '
      || public.texto_hora(v_fin) || '.'
      || case when v_cond then ' La sanción aumentó porque tu cuenta estaba condicionada.' else '' end
      || ' Al volver, tu cuenta quedará condicionada hasta cumplir 30 días y 15 viajes sin quejas.';
  else
    update public.conductor_disciplina
       set suspension_definitiva = true, advertencias = 0, actualizado_el = now()
     where transportista_id = s.transportista_id;
    v_titulo := 'Cuenta de conductor suspendida';
    v_msg := 'Por una queja de daño confirmada en tu ' || v_servicio
      || ', tu modo conductor quedó suspendido de forma definitiva.'
      || case when v_cond and p_gravedad <> 'severa'
              then ' La sanción aumentó porque tu cuenta estaba condicionada.' else '' end
      || ' Puedes seguir usando la app como cliente.';
  end if;
  if v_nota is not null then
    v_msg := v_msg || ' Nota: ' || v_nota;
  end if;

  update public.quejas
     set estado = 'confirmada', gravedad = p_gravedad, nota_admin = v_nota,
         resuelta_el = now(), resuelta_por = auth.uid()
   where id = q.id;

  perform public.notificar(s.transportista_id, s.id, 'sancion', v_titulo, v_msg);
  perform public.notificar(
    q.autor_id, q.servicio_id, 'queja_revisada',
    'Revisamos tu queja',
    'Confirmamos tu queja sobre el ' || v_servicio
      || ' y el transportista fue sancionado. Gracias por ayudarnos a mejorar.'
  );

  -- Suspendido: deja de estar disponible y se liberan sus servicios aún
  -- sin recoger (los que ya llevan la carga se terminan normalmente).
  if v_accion <> 'advertencia' then
    update public.perfiles set disponible = false where id = s.transportista_id;

    for r in
      update public.servicios
         set estado = 'pendiente', transportista_id = null,
             aceptada_el = null, iniciada_el = null,
             recordatorio_24h_el = null, recordatorio_1h_el = null, aviso_hora_el = null
       where transportista_id = s.transportista_id and estado = 'aceptada'
      returning id, user_id, tipo_servicio
    loop
      perform public.notificar(
        r.user_id, r.id, 'servicio_liberado',
        'Tu transportista ya no está disponible',
        'El transportista asignado a tu ' || lower(r.tipo_servicio)
          || ' no podrá atenderlo. Tu solicitud vuelve a estar disponible para otros transportistas.'
      );
    end loop;
  end if;

  return jsonb_build_object('estado', 'confirmada', 'accion', v_accion,
                            'dias', v_dias, 'hasta', v_fin, 'condicionado', v_cond);
end;
$$;
revoke all on function public.resolver_queja(bigint, text, text) from public, anon;
grant execute on function public.resolver_queja(bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11) ADMIN: ANULAR UNA SANCIÓN (si se equivocó)
--     Solo la más reciente del conductor: se restaura el estado que
--     tenía antes. Los servicios liberados no se le devuelven.
-- ---------------------------------------------------------------------
create or replace function public.anular_sancion(p_sancion bigint, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sa public.sanciones;
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if not public.soy_admin() then
    raise exception 'No tienes permiso para anular sanciones.';
  end if;

  select * into sa from public.sanciones where id = p_sancion for update;
  if sa.id is null then
    raise exception 'La sanción no existe.';
  end if;
  if sa.anulada_el is not null then
    raise exception 'Esta sanción ya fue anulada.';
  end if;
  if exists (select 1 from public.sanciones
              where transportista_id = sa.transportista_id
                and anulada_el is null and id > sa.id) then
    raise exception 'Solo puedes anular la sanción más reciente de este transportista.';
  end if;

  update public.conductor_disciplina
     set advertencias          = sa.prev_advertencias,
         suspendido_hasta      = sa.prev_suspendido_hasta,
         suspension_definitiva = sa.prev_definitiva,
         condicionado_desde    = sa.prev_condicionado_desde,
         actualizado_el        = now()
   where transportista_id = sa.transportista_id;

  update public.sanciones set anulada_el = now() where id = sa.id;

  update public.quejas
     set estado = 'descartada',
         nota_admin = concat_ws(' · ', nota_admin, 'Sanción anulada' || coalesce(': ' || v_nota, ''))
   where id = sa.queja_id;

  perform public.notificar(
    sa.transportista_id, null, 'sancion_anulada',
    'Sanción anulada',
    'Un administrador anuló la sanción que tenías'
      || case when sa.accion = 'advertencia' then ' (advertencia).' else '. Ya puedes volver a trabajar.' end
      || coalesce(' ' || v_nota, '')
  );
end;
$$;
revoke all on function public.anular_sancion(bigint, text) from public, anon;
grant execute on function public.anular_sancion(bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 12) AL TOCAR EL AVISO, A DÓNDE LLEVA (013 + sanciones)
-- ---------------------------------------------------------------------
create or replace function public.ruta_de_aviso(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo in ('cancelada_cliente', 'recordatorio_conductor',
                    'hora_sin_iniciar', 'solicitud_nueva') then '/transportista'
    when p_tipo in ('cuenta_aprobada', 'sancion', 'sancion_anulada') then '/perfil'
    when p_tipo = 'cuenta_rechazada' then '/vehiculo'
    when p_tipo = 'cupon'            then '/servicios'
    else '/solicitudes'
  end;
$$;
