-- =====================================================================
-- Muévelo Ya · 001: login, perfiles, vehículos y flujo del transportista
-- ---------------------------------------------------------------------
-- Ejecutar UNA vez en Supabase > SQL Editor. Es idempotente: si se vuelve
-- a correr no duplica nada.
--
-- Supone que ya existe public.servicios con la columna user_id
-- (default auth.uid()) y sus políticas RLS para el dueño.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PERFILES: nombre y teléfono de cada cuenta
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nombre    text not null default '',
  telefono  text not null default '',
  creado_el timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Crea el perfil automáticamente al registrarse, con los datos del formulario.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, telefono)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'telefono', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Usuarios que ya existían antes de este script.
insert into public.perfiles (id, nombre, telefono)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'nombre', ''),
       coalesce(u.raw_user_meta_data ->> 'telefono', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) VEHÍCULOS: uno por transportista, con vencimiento de documentos
-- ---------------------------------------------------------------------
create table if not exists public.vehiculos (
  transportista_id           uuid primary key references public.perfiles (id) on delete cascade,
  tipo                       text not null,
  placa                      text not null,
  marca_modelo               text not null default '',
  licencia_transito_numero   text not null,
  soat_vence                 date not null,
  tecnomecanica_exento       boolean not null default false,
  tecnomecanica_vence        date,
  licencia_conduccion_vence  date not null,
  seguro_rc_vence            date,          -- póliza opcional (RC / todo riesgo)
  actualizado_el             timestamptz not null default now(),
  constraint tecnomecanica_requerida
    check (tecnomecanica_exento or tecnomecanica_vence is not null)
);

alter table public.vehiculos enable row level security;

-- true si el transportista tiene vehículo y todos sus documentos obligatorios vigentes.
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
      and v.soat_vence >= current_date
      and v.licencia_conduccion_vence >= current_date
      and (v.tecnomecanica_exento or v.tecnomecanica_vence >= current_date)
  );
$$;

-- ---------------------------------------------------------------------
-- 3) SERVICIOS: estado y transportista asignado
-- ---------------------------------------------------------------------
alter table public.servicios
  add column if not exists estado text not null default 'pendiente',
  add column if not exists transportista_id uuid references public.perfiles (id) on delete set null,
  add column if not exists aceptada_el   timestamptz,
  add column if not exists recogida_el   timestamptz,
  add column if not exists completada_el timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'servicios_estado_valido'
  ) then
    alter table public.servicios
      add constraint servicios_estado_valido
      check (estado in ('pendiente', 'aceptada', 'en_curso', 'completada'));
  end if;
end $$;

create index if not exists servicios_estado_idx on public.servicios (estado);
create index if not exists servicios_transportista_idx on public.servicios (transportista_id);

-- Historial de cancelaciones del transportista (la solicitud vuelve a 'pendiente').
create table if not exists public.cancelaciones (
  id               bigint generated always as identity primary key,
  servicio_id      uuid not null references public.servicios (id) on delete cascade,
  transportista_id uuid not null references public.perfiles (id) on delete cascade,
  aceptada_el      timestamptz,
  cancelada_el     timestamptz not null default now()
);

alter table public.cancelaciones enable row level security;

-- Fecha real del servicio. Programado: "dd/mm/aaaa hh:mm AM|PM" en hora de Colombia.
create or replace function public.fecha_del_servicio(s public.servicios)
returns timestamptz
language plpgsql
stable
as $$
begin
  if s.tipo_programacion = 'programado' and s.fecha_programada ~ '^\d{1,2}/\d{1,2}/\d{4}' then
    return to_timestamp(s.fecha_programada || ' -05', 'DD/MM/YYYY HH12:MI AM TZH');
  end if;
  return s.fecha::timestamptz;
exception when others then
  return s.fecha::timestamptz;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) POLÍTICAS RLS
--    Las políticas permisivas se suman con OR a las que ya existían.
-- ---------------------------------------------------------------------

-- Perfiles: el propio, y el del transportista que atiende mis solicitudes.
drop policy if exists "perfiles: ver propio o relacionado" on public.perfiles;
create policy "perfiles: ver propio o relacionado" on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.servicios s
      where s.transportista_id = perfiles.id and s.user_id = auth.uid()
    )
  );

drop policy if exists "perfiles: editar propio" on public.perfiles;
create policy "perfiles: editar propio" on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Vehículos: el propio, y el del transportista que atiende mis solicitudes.
drop policy if exists "vehiculos: ver propio o relacionado" on public.vehiculos;
create policy "vehiculos: ver propio o relacionado" on public.vehiculos
  for select to authenticated
  using (
    transportista_id = auth.uid()
    or exists (
      select 1 from public.servicios s
      where s.transportista_id = vehiculos.transportista_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "vehiculos: crear propio" on public.vehiculos;
create policy "vehiculos: crear propio" on public.vehiculos
  for insert to authenticated
  with check (transportista_id = auth.uid());

drop policy if exists "vehiculos: editar propio" on public.vehiculos;
create policy "vehiculos: editar propio" on public.vehiculos
  for update to authenticated
  using (transportista_id = auth.uid())
  with check (transportista_id = auth.uid());

-- Servicios: el transportista con documentos vigentes ve las pendientes...
drop policy if exists "servicios: transportista ve pendientes" on public.servicios;
create policy "servicios: transportista ve pendientes" on public.servicios
  for select to authenticated
  using (estado = 'pendiente' and public.documentos_vigentes(auth.uid()));

-- ...y las que tiene asignadas.
drop policy if exists "servicios: transportista ve asignadas" on public.servicios;
create policy "servicios: transportista ve asignadas" on public.servicios
  for select to authenticated
  using (transportista_id = auth.uid());

-- El cliente solo puede eliminar solicitudes que nadie ha tomado.
drop policy if exists "servicios: eliminar solo pendientes" on public.servicios;
create policy "servicios: eliminar solo pendientes" on public.servicios
  as restrictive
  for delete to authenticated
  using (estado = 'pendiente');

-- Los cambios de estado solo se hacen con las funciones de abajo,
-- así nadie puede asignarse una solicitud editando la fila a mano.
revoke update on public.servicios from anon, authenticated;

-- Cancelaciones: cada transportista ve las suyas (se insertan desde la función).
drop policy if exists "cancelaciones: ver propias" on public.cancelaciones;
create policy "cancelaciones: ver propias" on public.cancelaciones
  for select to authenticated
  using (transportista_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5) FUNCIONES DEL FLUJO (se llaman con supabase.rpc)
-- ---------------------------------------------------------------------

-- Acepta una solicitud pendiente. Si otro la tomó primero, falla.
create or replace function public.aceptar_servicio(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.documentos_vigentes(auth.uid()) then
    raise exception 'Tus documentos no están vigentes. Actualízalos en tu vehículo.';
  end if;

  update public.servicios
     set estado = 'aceptada',
         transportista_id = auth.uid(),
         aceptada_el = now()
   where id = p_servicio
     and estado = 'pendiente'
     and user_id <> auth.uid()
  returning * into fila;

  if fila.id is null then
    raise exception 'Esta solicitud ya no está disponible.';
  end if;
  return fila;
end;
$$;

-- Cancela una solicitud aceptada (mínimo 48 h antes). Vuelve a quedar pendiente.
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
  if public.fecha_del_servicio(actual) - now() < interval '48 hours' then
    raise exception 'No puedes cancelar con menos de 48 horas de anticipación.';
  end if;

  insert into public.cancelaciones (servicio_id, transportista_id, aceptada_el)
  values (actual.id, auth.uid(), actual.aceptada_el);

  update public.servicios
     set estado = 'pendiente', transportista_id = null, aceptada_el = null
   where id = actual.id
  returning * into fila;
  return fila;
end;
$$;

-- El transportista ya recogió la carga en el punto A.
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
   where id = p_servicio and transportista_id = auth.uid() and estado = 'aceptada'
  returning * into fila;

  if fila.id is null then
    raise exception 'No se pudo marcar como recogido.';
  end if;
  return fila;
end;
$$;

-- El transportista entregó en el punto B.
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
  return fila;
end;
$$;

revoke execute on function public.aceptar_servicio(uuid)   from anon;
revoke execute on function public.cancelar_servicio(uuid)  from anon;
revoke execute on function public.marcar_recogido(uuid)    from anon;
revoke execute on function public.completar_servicio(uuid) from anon;

-- ---------------------------------------------------------------------
-- 6) REALTIME: avisos al instante de cambios en servicios
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'servicios'
  ) then
    alter publication supabase_realtime add table public.servicios;
  end if;
end $$;
