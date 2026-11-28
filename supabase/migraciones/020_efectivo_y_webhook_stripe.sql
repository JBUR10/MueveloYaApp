-- =====================================================================
-- Muévelo Ya · 020: Stripe, efectivo y retiro definitivo de Wompi
-- =====================================================================

alter table public.servicios
  add column if not exists metodo_pago text;

alter table public.servicios
  alter column metodo_pago drop not null;

update public.servicios
set metodo_pago = null
where metodo_pago is not null
  and metodo_pago not in ('stripe','efectivo');

alter table public.servicios
  alter column metodo_pago set default 'stripe';

alter table public.servicios
  drop constraint if exists servicios_metodo_pago_valido;
alter table public.servicios
  add constraint servicios_metodo_pago_valido
  check (metodo_pago is null or metodo_pago in ('stripe','efectivo'));

do $$
declare
  funcion record;
  objeto record;
begin
  for funcion in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ilike '%wompi%'
  loop
    execute format('drop function %s cascade', funcion.firma);
  end loop;

  for objeto in
    select tablename as nombre from pg_tables
    where schemaname = 'public' and tablename ilike '%wompi%'
  loop
    execute format('drop table public.%I cascade', objeto.nombre);
  end loop;
end $$;

do $$
declare
  condiciones text[] := array['stripe_payment_intent_id is null'];
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagos'
      and column_name = 'wompi_transaction_id'
  ) then
    condiciones := array_append(condiciones, 'wompi_transaction_id is not null');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagos'
      and column_name = 'metodo_wompi'
  ) then
    condiciones := array_append(condiciones, 'metodo_wompi is not null');
  end if;

  execute 'delete from public.pagos where ' || array_to_string(condiciones, ' or ');
end $$;

do $$
declare
  politica record;
begin
  for politica in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'pagos'
  loop
    execute format('drop policy %I on public.pagos', politica.policyname);
  end loop;
end $$;

alter table public.pagos
  drop column if exists user_id,
  drop column if exists referencia,
  drop column if exists monto_centavos,
  drop column if exists wompi_transaction_id,
  drop column if exists metodo_wompi,
  drop column if exists mensaje_estado,
  drop column if exists evento_raw;

alter table public.pagos
  drop constraint if exists pagos_estado_check;
alter table public.pagos
  add constraint pagos_estado_check
  check (estado in (
    'pendiente','pagado','fallido','reembolsado','reembolso_parcial','en_disputa'
  ));

alter table public.pagos enable row level security;
create policy "pagos: leer propios" on public.pagos
  for select to authenticated using (usuario_id = auth.uid());
create policy "pagos: admin lee todos" on public.pagos
  for select to authenticated using (public.soy_admin());

create or replace function public.servicios_forzar_pago_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user <> 'service_role' then
    if new.metodo_pago = 'efectivo' then
      new.pago_estado := 'no_aplica';
    else
      new.pago_estado := 'pendiente_pago';
    end if;
  end if;
  return new;
end;
$$;

grant execute on function public.marcar_servicio_pagado(uuid) to service_role;
grant execute on function public.marcar_servicio_reembolsado(uuid) to service_role;
