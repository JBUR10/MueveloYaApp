-- =====================================================================
-- Muévelo Ya · 025: saldo del transportista y comisión de la app (5 %)
-- ---------------------------------------------------------------------
-- Ejecutar UNA vez en Supabase > SQL Editor (es idempotente).
--
-- Qué hace:
--  1) Crea el libro de movimientos del transportista.
--  2) Al FINALIZAR un servicio (completar_servicio) registra el ingreso:
--       · Tarjeta (Stripe): la app tiene el dinero -> saldo + (tarifa - 5 %).
--       · Efectivo: el conductor ya cobró el 100 % en mano -> saldo - 5 %
--         (la comisión que le debe a la app).
--     Antes de finalizar el saldo NO cambia.
--  3) Si un pago con tarjeta se reembolsa, el movimiento se revierte.
--  4) mi_saldo_transportista(): resumen para el perfil.
-- =====================================================================

-- Porcentaje de comisión (un solo lugar para cambiarlo).
create or replace function public.comision_app_porcentaje()
returns numeric
language sql
immutable
as $$ select 5::numeric $$;

create table if not exists public.transportista_movimientos (
  id               uuid primary key default gen_random_uuid(),
  transportista_id uuid not null references public.perfiles (id) on delete cascade,
  servicio_id      uuid references public.servicios (id) on delete set null,
  tipo             text not null check (tipo in ('servicio', 'reversion')),
  metodo_pago      text not null check (metodo_pago in ('stripe', 'efectivo')),
  tipo_servicio    text not null default '',
  monto_bruto      integer not null,   -- tarifa final que pagó el cliente
  comision         integer not null,   -- parte de la app
  neto             integer not null,   -- bruto - comisión
  saldo_delta      integer not null,   -- lo que suma/resta al saldo
  creado_el        timestamptz not null default now(),
  unique (servicio_id, tipo)
);

create index if not exists transportista_movimientos_conductor_idx
  on public.transportista_movimientos (transportista_id, creado_el desc);

alter table public.transportista_movimientos enable row level security;

drop policy if exists "movimientos: leer propios" on public.transportista_movimientos;
create policy "movimientos: leer propios" on public.transportista_movimientos
  for select to authenticated using (transportista_id = auth.uid());

drop policy if exists "movimientos: admin lee todos" on public.transportista_movimientos;
create policy "movimientos: admin lee todos" on public.transportista_movimientos
  for select to authenticated using (public.soy_admin());

-- Solo las funciones del servidor escriben; nadie desde la app.
revoke insert, update, delete on public.transportista_movimientos from anon, authenticated;

-- ---------------------------------------------------------------------
-- Registro del ingreso (uso interno, lo llama completar_servicio)
-- ---------------------------------------------------------------------
create or replace function public.registrar_ingreso_transportista(p_servicio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.servicios;
  v_bruto    integer;
  v_comision integer;
  v_neto     integer;
  v_delta    integer;
begin
  select * into s
    from public.servicios
   where id = p_servicio
     and estado = 'completada'
     and transportista_id is not null;

  if s.id is null then
    return;
  end if;

  -- Tarjeta: solo cuenta si el pago está confirmado. Efectivo: siempre.
  -- Servicios antiguos sin método de pago (null) se omiten.
  if not coalesce(
    s.metodo_pago = 'efectivo'
    or (s.metodo_pago = 'stripe' and s.pago_estado = 'pagado'),
    false
  ) then
    return;
  end if;

  v_bruto := coalesce(s.tarifa_acordada, 0);
  if v_bruto <= 0 then
    return;
  end if;

  v_comision := round(v_bruto * public.comision_app_porcentaje() / 100.0);
  v_neto     := v_bruto - v_comision;
  v_delta    := case when s.metodo_pago = 'efectivo' then -v_comision else v_neto end;

  insert into public.transportista_movimientos (
    transportista_id, servicio_id, tipo, metodo_pago, tipo_servicio,
    monto_bruto, comision, neto, saldo_delta
  ) values (
    s.transportista_id, s.id, 'servicio', s.metodo_pago, coalesce(s.tipo_servicio, ''),
    v_bruto, v_comision, v_neto, v_delta
  )
  on conflict (servicio_id, tipo) do nothing;
end;
$$;

revoke all on function public.registrar_ingreso_transportista(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- completar_servicio: igual que en la 003, más el registro del ingreso.
-- El saldo cambia en la misma transacción que termina el pedido.
-- ---------------------------------------------------------------------
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

  perform public.registrar_ingreso_transportista(fila.id);

  perform public.notificar(
    fila.user_id, fila.id, 'completada',
    'Servicio finalizado',
    'Tu ' || lower(fila.tipo_servicio) || ' fue entregado. ¡Cuéntanos qué tal te fue!'
  );
  return fila;
end;
$$;

-- ---------------------------------------------------------------------
-- Reembolso de un pago con tarjeta: revierte el movimiento si ya existía.
-- (Igual que en la 018, más la reversión.)
-- ---------------------------------------------------------------------
create or replace function public.marcar_servicio_reembolsado(p_servicio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  update public.servicios
     set pago_estado = 'reembolsado',
         actualizado_el = now()
   where id = p_servicio
     and pago_estado = 'pagado'
  returning * into fila;

  if fila.id is not null then
    insert into public.transportista_movimientos (
      transportista_id, servicio_id, tipo, metodo_pago, tipo_servicio,
      monto_bruto, comision, neto, saldo_delta
    )
    select m.transportista_id, m.servicio_id, 'reversion', m.metodo_pago, m.tipo_servicio,
           -m.monto_bruto, -m.comision, -m.neto, -m.saldo_delta
      from public.transportista_movimientos m
     where m.servicio_id = fila.id
       and m.tipo = 'servicio'
    on conflict (servicio_id, tipo) do nothing;

    perform public.notificar(
      fila.user_id, fila.id, 'pago_reembolsado',
      'Reembolso realizado',
      'El reembolso total fue registrado para tu servicio.'
    );
  end if;
end;
$$;

revoke all on function public.marcar_servicio_reembolsado(uuid) from public, anon, authenticated;
grant execute on function public.marcar_servicio_reembolsado(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Resumen del saldo para el perfil del transportista
-- ---------------------------------------------------------------------
create or replace function public.mi_saldo_transportista()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'saldo',            coalesce(sum(saldo_delta), 0),
    'ganancias_netas',  coalesce(sum(neto), 0),
    'comisiones',       coalesce(sum(comision), 0),
    'servicios',        count(*) filter (where tipo = 'servicio'),
    'saldo_tarjeta',    coalesce(sum(saldo_delta) filter (where metodo_pago = 'stripe'), 0),
    'saldo_efectivo',   coalesce(sum(saldo_delta) filter (where metodo_pago = 'efectivo'), 0),
    'porcentaje',       public.comision_app_porcentaje()
  )
  from public.transportista_movimientos
  where transportista_id = auth.uid();
$$;

revoke all on function public.mi_saldo_transportista() from public, anon;
grant execute on function public.mi_saldo_transportista() to authenticated;

-- ---------------------------------------------------------------------
-- OPCIONAL: acreditar los servicios que ya estaban finalizados antes de
-- esta migración. Descomenta y ejecuta solo si quieres que cuenten.
-- ---------------------------------------------------------------------
-- select public.registrar_ingreso_transportista(id)
--   from public.servicios
--  where estado = 'completada' and transportista_id is not null;
