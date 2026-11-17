-- =====================================================================
-- Muévelo Ya · 013: cupones de descuento y promociones por push
-- ---------------------------------------------------------------------
-- Requiere 001, 003, 005, 007 y 009 (y 012 para la vista del panel).
-- Idempotente: se puede volver a ejecutar.
--
-- Cómo funciona:
--   1) El administrador crea una CAMPAÑA (tabla campanas) desde el panel:
--      motivo (primera vez en un servicio, segundo pedido, reactivación
--      o todos), servicio, % de descuento y vigencia.
--   2) crear_campana() genera un CUPÓN por cada cliente que cumple y le
--      guarda un aviso en "notificaciones": el trigger de la 007 lo envía
--      además como push.
--   3) Al crear una solicitud, la base aplica SOLA el mejor cupón vigente
--      del cliente (mayor descuento, vale para ese tipo de servicio).
--      Se guardan tarifa_base, descuento y cupon_id; tarifa_acordada pasa
--      a ser el precio FINAL con descuento.
--   4) Si el cliente elimina la solicitud pendiente o la cancela, el cupón
--      se le devuelve.
--   5) resultados_campanas() mide cuántos cupones se usaron, cuántos
--      terminaron en servicio completado, ingresos y descuento otorgado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.campanas (
  id             uuid primary key default gen_random_uuid(),
  motivo         text not null
                 check (motivo in ('primera_vez', 'segundo_pedido', 'reactivacion', 'todos')),
  tipo_servicio  text,                     -- null = cualquier servicio
  porcentaje     smallint not null check (porcentaje between 5 and 50),
  vigencia_dias  smallint not null check (vigencia_dias between 1 and 90),
  destinatarios  integer not null default 0,
  creada_por     uuid default auth.uid() references auth.users (id) on delete set null,
  creada_el      timestamptz not null default now()
);

alter table public.campanas enable row level security;
-- Sin políticas: solo se toca desde las funciones de administrador.

create table if not exists public.cupones (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  campana_id     uuid references public.campanas (id) on delete set null,
  tipo_servicio  text,                     -- null = vale para cualquier servicio
  porcentaje     smallint not null check (porcentaje between 1 and 100),
  motivo         text not null,
  vence_el       timestamptz not null,
  usado_el       timestamptz,
  servicio_id    uuid references public.servicios (id) on delete set null,
  creado_el      timestamptz not null default now()
);

create index if not exists cupones_usuario_idx on public.cupones (usuario_id, usado_el, vence_el);
create index if not exists cupones_campana_idx on public.cupones (campana_id);

alter table public.cupones enable row level security;

drop policy if exists "cupones: ver propios" on public.cupones;
create policy "cupones: ver propios" on public.cupones
  for select to authenticated
  using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) COLUMNAS NUEVAS EN SERVICIOS
--    tarifa_acordada sigue siendo "lo que paga el cliente" (con descuento),
--    así Q05, Q08 y los ingresos del análisis cuentan el precio real.
-- ---------------------------------------------------------------------
alter table public.servicios
  add column if not exists tarifa_base integer,
  add column if not exists descuento   integer not null default 0,
  add column if not exists cupon_id    uuid references public.cupones (id) on delete set null;

-- ---------------------------------------------------------------------
-- 3) APLICAR EL CUPÓN AL CREAR / RECALCULAR LA TARIFA
--    Se llama "servicios_cupon" para que dispare DESPUÉS de
--    "servicios_calcular_tarifa" (los triggers BEFORE van en orden
--    alfabético). Recalcula la base por su cuenta, así no depende de
--    lo que haya dejado el trigger de la 009.
-- ---------------------------------------------------------------------
create or replace function public.servicios_aplicar_cupon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_pct  smallint;
  v_base integer;
begin
  if tg_op = 'INSERT' then
    -- Nunca se confía en un cupon_id enviado por la app: lo elige la base.
    new.cupon_id := null;
    select id, porcentaje into v_id, v_pct
      from public.cupones
     where usuario_id = new.user_id
       and usado_el is null
       and vence_el > now()
       and (tipo_servicio is null or tipo_servicio = new.tipo_servicio)
     order by porcentaje desc, vence_el asc
     limit 1
       for update skip locked;
    new.cupon_id := v_id;
  else
    -- En una actualización el cupón no se puede cambiar.
    new.cupon_id := old.cupon_id;
    if new.cupon_id is not null then
      select porcentaje into v_pct from public.cupones where id = new.cupon_id;
    end if;
  end if;

  v_base := public.calcular_tarifa(new.distancia_km, new.ayudantes, new.pisos_escaleras);
  new.tarifa_base    := v_base;
  new.descuento      := case when v_pct is null then 0
                             else round(v_base * v_pct / 100.0)::integer end;
  new.tarifa_acordada := v_base - new.descuento;
  return new;
end;
$$;

drop trigger if exists servicios_cupon on public.servicios;
create trigger servicios_cupon
  before insert or update of distancia_km, ayudantes, pisos_escaleras,
                             tarifa_acordada, tarifa_base, descuento, cupon_id
  on public.servicios
  for each row execute function public.servicios_aplicar_cupon();

-- El cupón se marca como usado cuando la solicitud ya existe (por la FK).
create or replace function public.servicios_cupon_usado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cupon_id is not null then
    update public.cupones
       set usado_el = now(), servicio_id = new.id
     where id = new.cupon_id and usado_el is null;
  end if;
  return null;
end;
$$;

drop trigger if exists servicios_cupon_usado on public.servicios;
create trigger servicios_cupon_usado
  after insert on public.servicios
  for each row execute function public.servicios_cupon_usado();

-- Si el cliente elimina la solicitud pendiente o la cancela, recupera el cupón.
create or replace function public.servicios_cupon_devolver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.cupones set usado_el = null, servicio_id = null
     where servicio_id = old.id;
    return old;
  end if;

  if new.estado = 'cancelada'
     and old.estado is distinct from 'cancelada'
     and new.cancelada_por = 'cliente' then
    update public.cupones set usado_el = null, servicio_id = null
     where servicio_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists servicios_cupon_devolver_borrado on public.servicios;
create trigger servicios_cupon_devolver_borrado
  before delete on public.servicios
  for each row execute function public.servicios_cupon_devolver();

drop trigger if exists servicios_cupon_devolver_cancelado on public.servicios;
create trigger servicios_cupon_devolver_cancelado
  after update of estado on public.servicios
  for each row execute function public.servicios_cupon_devolver();

-- ---------------------------------------------------------------------
-- 4) AL TOCAR LA NOTIFICACIÓN DE UN CUPÓN SE ABRE "SERVICIOS"
--    (misma función de la 007 con un caso más).
-- ---------------------------------------------------------------------
create or replace function public.ruta_de_aviso(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo in ('cancelada_cliente', 'recordatorio_conductor',
                    'hora_sin_iniciar', 'solicitud_nueva') then '/transportista'
    when p_tipo = 'cuenta_aprobada'  then '/perfil'
    when p_tipo = 'cuenta_rechazada' then '/vehiculo'
    when p_tipo = 'cupon'            then '/servicios'
    else '/solicitudes'
  end;
$$;

-- ---------------------------------------------------------------------
-- 5) A QUIÉN SE LE ENVÍA (uso interno)
--    · primera_vez:     clientes que nunca han pedido ese servicio
--    · segundo_pedido:  clientes con un solo pedido
--    · reactivacion:    clientes sin pedir hace más de 30 días
--    · todos:           todos los clientes
--    Nadie recibe dos promociones en 7 días (para no saturar).
-- ---------------------------------------------------------------------
create or replace function public.audiencia_campana(p_motivo text, p_tipo text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select user_id,
           count(*)                  as n,
           max(fecha::timestamptz)   as ultimo
    from public.servicios
    where user_id is not null
    group by 1
  )
  select c.user_id
  from c
  where exists (select 1 from public.perfiles p where p.id = c.user_id)
    and case p_motivo
          when 'primera_vez' then not exists (
                 select 1 from public.servicios s
                  where s.user_id = c.user_id and s.tipo_servicio = p_tipo)
          when 'segundo_pedido' then c.n = 1
          when 'reactivacion'   then c.ultimo < now() - interval '30 days'
          when 'todos'          then true
          else false
        end
    and not exists (
          select 1 from public.cupones q
           where q.usuario_id = c.user_id
             and q.creado_el > now() - interval '7 days');
$$;

revoke all on function public.audiencia_campana(text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) FUNCIONES DEL PANEL DE ADMINISTRADOR
-- ---------------------------------------------------------------------
create or replace function public.contar_audiencia(p_motivo text, p_tipo text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver esta información.';
  end if;
  return (select count(*)::integer from public.audiencia_campana(p_motivo, p_tipo));
end;
$$;

create or replace function public.crear_campana(
  p_motivo text, p_tipo text, p_porcentaje integer, p_dias integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_n      integer;
  v_vence  timestamptz;
  v_titulo text;
  v_msg    text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para enviar promociones.';
  end if;
  if coalesce(p_motivo, '') not in ('primera_vez', 'segundo_pedido', 'reactivacion', 'todos') then
    raise exception 'Tipo de promoción no válido.';
  end if;
  if p_tipo is not null and p_tipo not in ('Envío', 'Acarreo', 'Trasteo', 'Mudanza') then
    raise exception 'Servicio no válido.';
  end if;
  if p_motivo = 'primera_vez' and p_tipo is null then
    raise exception 'Elige el servicio que quieres promover.';
  end if;
  if p_porcentaje is null or p_porcentaje not between 5 and 50 then
    raise exception 'El descuento debe estar entre 5 % y 50 %.';
  end if;
  if p_dias is null or p_dias not between 1 and 90 then
    raise exception 'La vigencia debe estar entre 1 y 90 días.';
  end if;

  v_vence := now() + make_interval(days => p_dias);

  insert into public.campanas (motivo, tipo_servicio, porcentaje, vigencia_dias)
  values (p_motivo, p_tipo, p_porcentaje, p_dias)
  returning id into v_id;

  insert into public.cupones (usuario_id, campana_id, tipo_servicio, porcentaje, motivo, vence_el)
  select u, v_id, p_tipo, p_porcentaje, p_motivo, v_vence
  from public.audiencia_campana(p_motivo, p_tipo) as u;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    delete from public.campanas where id = v_id;
    return jsonb_build_object('campana_id', null, 'destinatarios', 0);
  end if;

  update public.campanas set destinatarios = v_n where id = v_id;

  v_titulo := '🎁 Tienes un cupón de ' || p_porcentaje || ' %';
  v_msg := case p_motivo
    when 'primera_vez'    then 'Prueba ' || lower(p_tipo) || ' con ' || p_porcentaje || ' % de descuento.'
    when 'segundo_pedido' then 'Tu próximo pedido tiene ' || p_porcentaje || ' % de descuento'
                               || coalesce(' en ' || lower(p_tipo), '') || '.'
    when 'reactivacion'   then 'Te extrañamos: ' || p_porcentaje || ' % de descuento en tu próximo pedido'
                               || coalesce(' de ' || lower(p_tipo), '') || '.'
    else p_porcentaje || ' % de descuento ' || coalesce('en ' || lower(p_tipo), 'en tu próximo pedido') || '.'
  end
  || ' Vence el ' || to_char(v_vence at time zone 'America/Bogota', 'DD/MM') || '.';

  -- Cada aviso también sale como push (trigger push_de_notificacion, 007).
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
  select usuario_id, 'cupon', v_titulo, v_msg
  from public.cupones
  where campana_id = v_id;

  return jsonb_build_object('campana_id', v_id, 'destinatarios', v_n);
end;
$$;

-- ¿Funcionó la promoción? Una fila por campaña (las más recientes primero).
create or replace function public.resultados_campanas(p_limite integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver los resultados.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',          c.id,
             'motivo',      c.motivo,
             'tipo',        c.tipo_servicio,
             'porcentaje',  c.porcentaje,
             'creada_el',   c.creada_el,
             'vence_el',    c.creada_el + make_interval(days => c.vigencia_dias),
             'enviados',    c.destinatarios,
             'usados',      coalesce(u.usados, 0),
             'completados', coalesce(u.completados, 0),
             'ingresos',    coalesce(u.ingresos, 0),
             'descuento',   coalesce(u.descuento, 0)
           ) order by c.creada_el desc)
    from (select * from public.campanas
           order by creada_el desc
           limit greatest(coalesce(p_limite, 20), 1)) c
    left join lateral (
      select count(*)                                              as usados,
             count(*) filter (where s.estado = 'completada')      as completados,
             coalesce(sum(s.tarifa_acordada) filter (where s.estado = 'completada'), 0) as ingresos,
             coalesce(sum(s.descuento)       filter (where s.estado = 'completada'), 0) as descuento
      from public.cupones q
      join public.servicios s on s.id = q.servicio_id
      where q.campana_id = c.id and q.usado_el is not null
    ) u on true
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.contar_audiencia(text, text)              from public, anon;
revoke all on function public.crear_campana(text, text, integer, integer) from public, anon;
revoke all on function public.resultados_campanas(integer)              from public, anon;
grant execute on function public.contar_audiencia(text, text)              to authenticated;
grant execute on function public.crear_campana(text, text, integer, integer) to authenticated;
grant execute on function public.resultados_campanas(integer)              to authenticated;
