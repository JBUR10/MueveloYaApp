-- =====================================================================
-- Muévelo Ya · 005: aprobación del transportista por un administrador
-- ---------------------------------------------------------------------
-- Requiere 001, 002 y 003. Idempotente: se puede volver a ejecutar.
--
-- Ser transportista ya no depende solo de llenar el vehículo: un
-- administrador revisa el perfil y lo aprueba o lo rechaza (con motivo).
-- Mientras no esté aprobado, documentos_vigentes() devuelve false, así
-- que el servidor no le muestra ni le deja aceptar solicitudes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ADMINISTRADORES
--    Tabla sin políticas: nadie la lee desde la app, solo la función
--    soy_admin(). Se agregan desde el SQL Editor (ver el final).
-- ---------------------------------------------------------------------
create table if not exists public.administradores (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  creado_el timestamptz not null default now()
);
alter table public.administradores enable row level security;

create or replace function public.soy_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2) VEHÍCULOS: estado de la verificación
--    Los vehículos que ya existían quedan APROBADOS (solo la primera vez
--    que corre este script); los nuevos arrancan en 'pendiente'.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vehiculos'
      and column_name = 'verificacion'
  ) then
    alter table public.vehiculos
      add column verificacion   text not null default 'pendiente',
      add column motivo_rechazo text,
      add column revisado_por   uuid references auth.users (id) on delete set null,
      add column revisado_el    timestamptz;

    update public.vehiculos set verificacion = 'aprobado', revisado_el = now();
  end if;
end $$;

alter table public.vehiculos drop constraint if exists vehiculos_verificacion_valida;
alter table public.vehiculos
  add constraint vehiculos_verificacion_valida
  check (verificacion in ('pendiente', 'aprobado', 'rechazado'));

create index if not exists vehiculos_verificacion_idx on public.vehiculos (verificacion);

-- El transportista NO puede aprobarse a sí mismo: la política "editar
-- propio" le deja actualizar su fila, así que este trigger protege los
-- campos de la revisión.
--   · Insert de un usuario normal  -> siempre 'pendiente'.
--   · Update de un usuario normal  -> no puede tocar la revisión.
--       - Si estaba 'rechazado' y corrige sus datos -> vuelve a 'pendiente'.
--       - Si cambia tipo, placa o licencia de tránsito -> vuelve a 'pendiente'.
--   · Admin (o SQL Editor, sin auth.uid()) -> sin restricción.
create or replace function public.proteger_verificacion_vehiculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.soy_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verificacion   := 'pendiente';
    new.motivo_rechazo := null;
    new.revisado_por   := null;
    new.revisado_el    := null;
    return new;
  end if;

  new.verificacion   := old.verificacion;
  new.motivo_rechazo := old.motivo_rechazo;
  new.revisado_por   := old.revisado_por;
  new.revisado_el    := old.revisado_el;

  if old.verificacion = 'rechazado'
     or new.tipo is distinct from old.tipo
     or new.placa is distinct from old.placa
     or new.licencia_transito_numero is distinct from old.licencia_transito_numero then
    new.verificacion   := 'pendiente';
    new.motivo_rechazo := null;
    new.revisado_por   := null;
    new.revisado_el    := null;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_verificacion on public.vehiculos;
create trigger proteger_verificacion
  before insert or update on public.vehiculos
  for each row execute function public.proteger_verificacion_vehiculo();

-- ---------------------------------------------------------------------
-- 3) documentos_vigentes ahora exige el vehículo APROBADO
--    La usan las políticas RLS de servicios y aceptar_servicio.
-- ---------------------------------------------------------------------
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
  );
$$;

-- ---------------------------------------------------------------------
-- 4) El administrador puede ver todos los vehículos y perfiles
-- ---------------------------------------------------------------------
drop policy if exists "vehiculos: admin ve todos" on public.vehiculos;
create policy "vehiculos: admin ve todos" on public.vehiculos
  for select to authenticated
  using (public.soy_admin());

drop policy if exists "perfiles: admin ve todos" on public.perfiles;
create policy "perfiles: admin ve todos" on public.perfiles
  for select to authenticated
  using (public.soy_admin());

-- ---------------------------------------------------------------------
-- 5) Aprobar o rechazar (se llama con supabase.rpc)
-- ---------------------------------------------------------------------
create or replace function public.revisar_transportista(
  p_transportista uuid,
  p_aprobar       boolean,
  p_motivo        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para revisar transportistas.';
  end if;
  if not p_aprobar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo del rechazo.';
  end if;

  update public.vehiculos
     set verificacion   = case when p_aprobar then 'aprobado' else 'rechazado' end,
         motivo_rechazo = case when p_aprobar then null else trim(p_motivo) end,
         revisado_por   = auth.uid(),
         revisado_el    = now()
   where transportista_id = p_transportista;

  if not found then
    raise exception 'Ese transportista no tiene vehículo registrado.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) CÓMO CREAR UN ADMINISTRADOR
--    1. Crea el usuario en Authentication > Users (Auto Confirm User).
--    2. Ejecuta esto con SU correo:
--
--    insert into public.administradores (user_id)
--    select id from auth.users where email = 'admin@mueveloya.com'
--    on conflict do nothing;
-- ---------------------------------------------------------------------
