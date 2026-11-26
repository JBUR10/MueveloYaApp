-- =====================================================================
-- Muévelo Ya · 018: pagos con Stripe
-- =====================================================================

alter table public.servicios
  add column if not exists pago_estado text;

alter table public.servicios
  add column if not exists creado_el timestamptz;
alter table public.servicios
  add column if not exists actualizado_el timestamptz not null default now();

alter table public.servicios
  drop constraint if exists servicios_pago_estado_valido;

update public.servicios
set pago_estado = 'no_aplica'
where pago_estado is null
   or pago_estado not in ('pendiente_pago','pagado','reembolsado','no_aplica');

alter table public.servicios
  alter column pago_estado set default 'pendiente_pago',
  alter column pago_estado set not null,
  alter column creado_el set default now();

update public.servicios
set creado_el = coalesce(creado_el, now())
where creado_el is null;

alter table public.servicios
  alter column creado_el set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'servicios_pago_estado_check'
      and conrelid = 'public.servicios'::regclass
  ) then
    alter table public.servicios
      add constraint servicios_pago_estado_check
      check (pago_estado in ('pendiente_pago','pagado','reembolsado','no_aplica'));
  end if;
end $$;

create or replace function public.servicios_forzar_pago_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user <> 'service_role' then
    new.pago_estado := 'pendiente_pago';
  end if;
  return new;
end;
$$;

drop trigger if exists servicios_forzar_pago_pendiente on public.servicios;
create trigger servicios_forzar_pago_pendiente
  before insert on public.servicios
  for each row execute function public.servicios_forzar_pago_pendiente();

create table if not exists public.clientes_stripe (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique not null,
  creado_el timestamptz not null default now()
);
alter table public.clientes_stripe enable row level security;
drop policy if exists "clientes_stripe: leer propio" on public.clientes_stripe;
create policy "clientes_stripe: leer propio" on public.clientes_stripe
  for select to authenticated using (usuario_id = auth.uid());
revoke insert, update, delete on public.clientes_stripe from anon, authenticated;

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid references public.servicios(id) on delete set null,
  usuario_id uuid not null,
  stripe_payment_intent_id text unique not null,
  stripe_charge_id text,
  monto integer not null,
  moneda text not null default 'cop',
  estado text not null check (estado in ('pendiente','pagado','fallido','reembolsado','reembolso_parcial','en_disputa')),
  monto_reembolsado integer not null default 0,
  motivo_reembolso text,
  recibo_url text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

-- Compatibilidad con pagos Wompi existentes: se conservan sus columnas y se
-- añaden los campos necesarios por el flujo Stripe.
alter table public.pagos
  add column if not exists usuario_id uuid,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists monto integer,
  add column if not exists monto_reembolsado integer not null default 0,
  add column if not exists motivo_reembolso text,
  add column if not exists recibo_url text;

do $compatibilidad_usuario$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pagos'
      and column_name = 'user_id'
  ) then
    update public.pagos
    set usuario_id = coalesce(usuario_id, user_id)
    where usuario_id is null;
  end if;
end
$compatibilidad_usuario$;

alter table public.pagos
  alter column usuario_id set not null,
  alter column monto set default 0;

do $compatibilidad_wompi$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pagos'
      and column_name = 'monto_centavos'
  ) then
    update public.pagos
    set monto = coalesce(monto, greatest(floor(monto_centavos::numeric / 100), 0))
    where monto is null;
  else
    update public.pagos
    set monto = coalesce(monto, 0)
    where monto is null;
  end if;
end
$compatibilidad_wompi$;

alter table public.pagos
  alter column monto set not null;

create unique index if not exists pagos_stripe_payment_intent_uidx
  on public.pagos(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.pagos
  drop constraint if exists pagos_estado_check;

alter table public.pagos
  add constraint pagos_estado_check
  check (estado in (
    'pendiente','aprobado','rechazado','anulado','error',
    'pagado','fallido','reembolsado','reembolso_parcial','en_disputa'
  ));
alter table public.pagos enable row level security;
drop policy if exists "pagos: leer propios" on public.pagos;
create policy "pagos: leer propios" on public.pagos
  for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "pagos: admin lee todos" on public.pagos;
create policy "pagos: admin lee todos" on public.pagos
  for select to authenticated using (public.soy_admin());
revoke insert, update, delete on public.pagos from anon, authenticated;

create table if not exists public.stripe_eventos (
  id text primary key,
  tipo text not null,
  recibido_el timestamptz not null default now(),
  procesado_el timestamptz,
  error text
);
alter table public.stripe_eventos enable row level security;
revoke insert, update, delete on public.stripe_eventos from anon, authenticated;

drop policy if exists "servicios: transportista ve pendientes" on public.servicios;
create policy "servicios: transportista ve pendientes" on public.servicios
  for select to authenticated
  using (
    estado = 'pendiente'
    and pago_estado in ('pagado','no_aplica')
    and public.documentos_vigentes(auth.uid())
  );

create or replace function public.marcar_servicio_pagado(p_servicio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  update public.servicios
     set pago_estado = 'pagado',
         actualizado_el = now()
   where id = p_servicio
     and pago_estado = 'pendiente_pago'
  returning * into fila;

  if fila.id is not null then
    perform public.notificar(
      fila.user_id, fila.id, 'pago_confirmado',
      'Pago recibido',
      'Pago recibido. Estamos buscando un conductor para tu servicio'
    );
  end if;
end;
$$;

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
    perform public.notificar(
      fila.user_id, fila.id, 'pago_reembolsado',
      'Reembolso realizado',
      'El reembolso total fue registrado para tu servicio.'
    );
  end if;
end;
$$;

revoke all on function public.marcar_servicio_pagado(uuid) from public, anon, authenticated;
revoke all on function public.marcar_servicio_reembolsado(uuid) from public, anon, authenticated;

create or replace function public.ruta_de_aviso(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo in ('pago_confirmado','pago_reembolsado','pago_fallido') then '/solicitudes'
    when p_tipo in ('cancelada_cliente','recordatorio_conductor',
                    'hora_sin_iniciar','solicitud_nueva') then '/transportista'
    when p_tipo = 'cuenta_aprobada' then '/perfil'
    when p_tipo = 'cuenta_rechazada' then '/vehiculo'
    when p_tipo = 'cupon' then '/servicios'
    else '/solicitudes'
  end;
$$;

create or replace function public.retirar_solicitud_pendiente(p_servicio uuid)
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

  update public.servicios
     set estado = 'cancelada',
         cancelada_el = now(),
         cancelada_por = 'cliente',
         motivo_cancelacion = 'Solicitud retirada por el cliente'
   where id = p_servicio
     and user_id = auth.uid()
     and estado = 'pendiente'
  returning * into fila;

  if fila.id is null then
    raise exception 'La solicitud ya fue tomada o ya no está pendiente.';
  end if;
  return fila;
end;
$$;

revoke all on function public.retirar_solicitud_pendiente(uuid) from public, anon;
grant execute on function public.retirar_solicitud_pendiente(uuid) to authenticated;

create or replace function public.aceptar_servicio(p_servicio uuid)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.servicios;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if not public.documentos_vigentes(auth.uid()) then
    raise exception 'Tus documentos no están vigentes. Actualízalos en tu vehículo.';
  end if;

  update public.servicios
     set estado = 'aceptada',
         transportista_id = auth.uid(),
         aceptada_el = now()
   where id = p_servicio
     and estado = 'pendiente'
     and pago_estado in ('pagado','no_aplica')
     and user_id <> auth.uid()
  returning * into fila;

  if fila.id is null then
    raise exception 'Esta solicitud ya no está disponible o todavía no está pagada.';
  end if;
  return fila;
end;
$$;

revoke all on function public.aceptar_servicio(uuid) from public, anon;
grant execute on function public.aceptar_servicio(uuid) to authenticated;

create or replace function public.push_solicitud_nueva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destinatarios uuid[];
  programado boolean := new.tipo_programacion = 'programado';
begin
  if new.estado <> 'pendiente'
     or new.pago_estado not in ('pagado','no_aplica') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.estado = 'pendiente'
     and old.pago_estado = new.pago_estado then
    return new;
  end if;

  select array_agg(p.id) into destinatarios
    from public.perfiles p
   where p.disponible
     and p.actividad_el > now() - interval '12 hours'
     and p.id <> new.user_id
     and public.documentos_vigentes(p.id)
     and (coalesce(new.ayudantes, 0) = 0 or p.cuenta_con_ayudantes)
     and not exists (
       select 1 from public.solicitudes_rechazadas r
        where r.transportista_id = p.id and r.servicio_id = new.id
     )
     and (
       programado
       or not exists (
         select 1 from public.servicios s
          where s.transportista_id = p.id
            and s.estado in ('aceptada','en_curso')
            and s.iniciada_el is not null
       )
     );

  if destinatarios is not null then
    perform public.enviar_push(
      destinatarios,
      case when programado
        then '📅 Solicitud programada: ' || new.tipo_servicio || ' · ' || coalesce(new.fecha_programada,'')
        else '⚡ Solicitud inmediata: ' || new.tipo_servicio
      end,
      new.origen || ' → ' || new.destino,
      jsonb_build_object(
        'tipo','solicitud_nueva',
        'servicioId',new.id,
        'ruta','/?ver=' || new.id
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists push_solicitud_nueva on public.servicios;
create trigger push_solicitud_nueva
  after insert or update of pago_estado, estado on public.servicios
  for each row execute function public.push_solicitud_nueva();

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
exception when others then
  raise notice 'Activa pg_cron y pg_net si todavía no están disponibles.';
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'mueveloya-limpiar-no-pagados';

    perform cron.schedule(
      'mueveloya-limpiar-no-pagados',
      '15 * * * *',
      'delete from public.servicios
        where pago_estado = ''pendiente_pago''
          and creado_el < now() - interval ''24 hours'''
    );
  end if;
end $$;
