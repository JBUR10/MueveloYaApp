-- =====================================================================
-- Muévelo Ya · 007: notificaciones push, disponibilidad del conductor,
--                   motivo de cancelación y recordatorios
-- ---------------------------------------------------------------------
-- Requiere 001 a 005. Idempotente: se puede volver a ejecutar.
--
-- Usa dos extensiones de Supabase (gratis):
--   - pg_net:  envía las notificaciones al servicio de push de Expo.
--   - pg_cron: revisa cada 5 minutos si hay recordatorios por enviar.
-- Si al ejecutar sale un error con alguna de ellas, actívalas en
-- Database > Extensions (buscar "pg_net" y "pg_cron") y vuelve a ejecutar.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 1) CELULARES QUE RECIBEN PUSH (token de Expo por dispositivo)
-- ---------------------------------------------------------------------
create table if not exists public.dispositivos_push (
  token          text primary key,
  usuario_id     uuid not null references public.perfiles (id) on delete cascade,
  -- false = el usuario apagó "Notificaciones" en el Perfil de ese celular.
  activo         boolean not null default true,
  actualizado_el timestamptz not null default now()
);

create index if not exists dispositivos_push_usuario_idx
  on public.dispositivos_push (usuario_id);

alter table public.dispositivos_push enable row level security;

drop policy if exists "dispositivos: ver propios" on public.dispositivos_push;
create policy "dispositivos: ver propios" on public.dispositivos_push
  for select to authenticated
  using (usuario_id = auth.uid());

-- Registra (o pasa a la cuenta actual) el celular. Un mismo celular puede
-- cambiar de cuenta al cerrar sesión e iniciar con otra.
create or replace function public.registrar_dispositivo(p_token text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  insert into public.dispositivos_push (token, usuario_id, activo, actualizado_el)
  values (p_token, auth.uid(), coalesce(p_activo, true), now())
  on conflict (token) do update
    set usuario_id = auth.uid(),
        activo = coalesce(p_activo, true),
        actualizado_el = now();
end;
$$;

-- Al cerrar sesión: ese celular deja de recibir push de la cuenta.
create or replace function public.quitar_dispositivo(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.dispositivos_push
  where token = p_token and usuario_id = auth.uid();
$$;

revoke execute on function public.registrar_dispositivo(text, boolean) from anon;
revoke execute on function public.quitar_dispositivo(text) from anon;

-- ---------------------------------------------------------------------
-- 2) ENVÍO DE PUSH (servicio de Expo, gratis)
-- ---------------------------------------------------------------------
create or replace function public.enviar_push(
  p_usuarios uuid[], p_titulo text, p_mensaje text, p_datos jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lote jsonb;
begin
  -- Expo acepta hasta 100 mensajes por petición: se envían en lotes.
  for lote in
    select jsonb_agg(m.mensaje)
    from (
      select jsonb_build_object(
               'to', d.token,
               'title', p_titulo,
               'body', p_mensaje,
               'data', p_datos,
               'sound', 'default',
               'channelId', 'default',
               'priority', 'high'
             ) as mensaje,
             (row_number() over () - 1) / 100 as grupo
      from public.dispositivos_push d
      where d.usuario_id = any (p_usuarios) and d.activo
    ) m
    group by m.grupo
  loop
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      body    := lote,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Accept', 'application/json'
                 )
    );
  end loop;
exception when others then
  -- Un fallo del push nunca debe impedir aceptar, cancelar, etc.
  raise warning 'No se pudo enviar el push: %', sqlerrm;
end;
$$;

revoke execute on function public.enviar_push(uuid[], text, text, jsonb)
  from public, anon, authenticated;

-- Pantalla que abre la app al tocar la notificación.
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
    else '/solicitudes'
  end;
$$;

-- Cada aviso que se guarda en "notificaciones" también se envía por push.
create or replace function public.push_de_notificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enviar_push(
    array[new.usuario_id],
    new.titulo,
    new.mensaje,
    jsonb_build_object(
      'tipo', new.tipo,
      'servicioId', new.servicio_id,
      'ruta', public.ruta_de_aviso(new.tipo)
    )
  );
  return new;
end;
$$;

drop trigger if exists push_de_notificacion on public.notificaciones;
create trigger push_de_notificacion
  after insert on public.notificaciones
  for each row execute function public.push_de_notificacion();

-- ---------------------------------------------------------------------
-- 3) DISPONIBILIDAD DEL CONDUCTOR
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists disponible   boolean not null default false,
  add column if not exists actividad_el timestamptz;

-- Activa o desactiva "Disponible". Solo conductores aprobados y al día.
create or replace function public.cambiar_disponibilidad(p_disponible boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if p_disponible and not public.documentos_vigentes(auth.uid()) then
    raise exception 'Tu cuenta debe estar aprobada y con documentos vigentes para estar disponible.';
  end if;
  update public.perfiles
     set disponible = p_disponible, actividad_el = now()
   where id = auth.uid();
  return p_disponible;
end;
$$;

-- Se llama al abrir la app. Si pasaron más de 12 h sin abrirla, el
-- conductor deja de estar disponible. Devuelve el estado actual.
create or replace function public.registrar_actividad()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  estado boolean;
begin
  update public.perfiles
     set disponible = case
           when actividad_el is null or actividad_el < now() - interval '12 hours'
             then false
           else disponible
         end,
         actividad_el = now()
   where id = auth.uid()
  returning disponible into estado;
  return coalesce(estado, false);
end;
$$;

revoke execute on function public.cambiar_disponibilidad(boolean) from anon;
revoke execute on function public.registrar_actividad() from anon;

-- Push de solicitudes nuevas a los conductores disponibles. También cuando
-- una solicitud vuelve a quedar pendiente porque un conductor la canceló.
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
  if new.estado <> 'pendiente' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.estado = 'pendiente' then
    return new;
  end if;

  select array_agg(p.id) into destinatarios
    from public.perfiles p
   where p.disponible
     and p.actividad_el > now() - interval '12 hours'
     and p.id <> new.user_id
     and public.documentos_vigentes(p.id)
     -- Mientras hace un servicio no lo interrumpimos.
     and not exists (
       select 1 from public.servicios s
        where s.transportista_id = p.id
          and s.estado in ('aceptada', 'en_curso')
          and s.iniciada_el is not null
     );

  if destinatarios is null then
    return new;
  end if;

  perform public.enviar_push(
    destinatarios,
    case when programado
      then '📅 Solicitud programada: ' || new.tipo_servicio || ' · ' || coalesce(new.fecha_programada, '')
      else '⚡ Solicitud inmediata: ' || new.tipo_servicio
    end,
    new.origen || ' → ' || new.destino,
    jsonb_build_object('tipo', 'solicitud_nueva', 'servicioId', new.id, 'ruta', '/transportista')
  );
  return new;
end;
$$;

drop trigger if exists push_solicitud_nueva on public.servicios;
create trigger push_solicitud_nueva
  after insert or update of estado on public.servicios
  for each row execute function public.push_solicitud_nueva();

-- ---------------------------------------------------------------------
-- 4) AVISO DE CUENTA APROBADA O RECHAZADA
-- ---------------------------------------------------------------------
create or replace function public.avisar_revision_vehiculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verificacion = 'aprobado' then
    perform public.notificar(
      new.transportista_id, null, 'cuenta_aprobada',
      '¡Tu cuenta fue aprobada!',
      'Ya puedes recibir solicitudes. Actívate como disponible en el panel del transportista.'
    );
  elsif new.verificacion = 'rechazado' then
    perform public.notificar(
      new.transportista_id, null, 'cuenta_rechazada',
      'Tu registro fue rechazado',
      'Motivo: ' || coalesce(new.motivo_rechazo, 'revisa los datos de tu vehículo')
        || '. Corrige los datos en «Mi vehículo» para que lo revisemos de nuevo.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists avisar_revision_vehiculo on public.vehiculos;
create trigger avisar_revision_vehiculo
  after update of verificacion on public.vehiculos
  for each row
  when (old.verificacion is distinct from new.verificacion
        and new.verificacion in ('aprobado', 'rechazado'))
  execute function public.avisar_revision_vehiculo();

-- ---------------------------------------------------------------------
-- 5) MOTIVO DE CANCELACIÓN (obligatorio)
-- ---------------------------------------------------------------------
alter table public.servicios
  add column if not exists motivo_cancelacion text;
alter table public.cancelaciones
  add column if not exists motivo text;

-- Las versiones sin motivo (003) se reemplazan por estas.
drop function if exists public.cancelar_servicio(uuid);
drop function if exists public.cancelar_servicio_cliente(uuid);

-- El conductor cancela (mínimo 48 h antes y sin haberlo iniciado).
-- La solicitud vuelve a quedar disponible para otros transportistas.
create or replace function public.cancelar_servicio(p_servicio uuid, p_motivo text)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  actual public.servicios;
  fila   public.servicios;
  motivo text := trim(coalesce(p_motivo, ''));
begin
  if motivo = '' then
    raise exception 'Indica el motivo de la cancelación.';
  end if;

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

  insert into public.cancelaciones (servicio_id, transportista_id, aceptada_el, motivo)
  values (actual.id, auth.uid(), actual.aceptada_el, motivo);

  update public.servicios
     set estado = 'pendiente', transportista_id = null,
         aceptada_el = null, iniciada_el = null,
         recordatorio_24h_el = null, recordatorio_1h_el = null, aviso_hora_el = null
   where id = actual.id
  returning * into fila;

  perform public.notificar(
    fila.user_id, fila.id, 'cancelada_conductor',
    'El conductor canceló tu servicio',
    'Tu ' || lower(fila.tipo_servicio) || ' del ' || coalesce(fila.fecha_programada, '')
      || ' fue cancelado. Motivo: ' || motivo
      || '. Tu solicitud vuelve a estar disponible para otros transportistas.'
  );
  return fila;
end;
$$;

-- El cliente cancela un servicio aceptado (mínimo 48 h antes y sin iniciar).
create or replace function public.cancelar_servicio_cliente(p_servicio uuid, p_motivo text)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  actual public.servicios;
  fila   public.servicios;
  motivo text := trim(coalesce(p_motivo, ''));
begin
  if motivo = '' then
    raise exception 'Indica el motivo de la cancelación.';
  end if;

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
     set estado = 'cancelada', cancelada_el = now(), cancelada_por = 'cliente',
         motivo_cancelacion = motivo
   where id = actual.id
  returning * into fila;

  perform public.notificar(
    fila.transportista_id, fila.id, 'cancelada_cliente',
    'El usuario canceló el servicio',
    'El ' || lower(fila.tipo_servicio) || ' del ' || coalesce(fila.fecha_programada, '')
      || ' fue cancelado. Motivo: ' || motivo || '.'
  );
  return fila;
end;
$$;

revoke execute on function public.cancelar_servicio(uuid, text)         from anon;
revoke execute on function public.cancelar_servicio_cliente(uuid, text) from anon;

-- ---------------------------------------------------------------------
-- 6) RECORDATORIOS DE SERVICIOS PROGRAMADOS
--    24 h antes y 1 h antes (cliente y conductor) y, si llega la hora
--    sin iniciar, un aviso al conductor. Cada uno se envía una sola vez.
-- ---------------------------------------------------------------------
alter table public.servicios
  add column if not exists recordatorio_24h_el timestamptz,
  add column if not exists recordatorio_1h_el  timestamptz,
  add column if not exists aviso_hora_el       timestamptz;

create or replace function public.enviar_recordatorios()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.servicios;
  hora timestamptz;
  faltan interval;
  servicio text;
begin
  for s in
    select * from public.servicios
     where estado = 'aceptada'
       and tipo_programacion = 'programado'
       and iniciada_el is null
       and aviso_hora_el is null
  loop
    hora := public.fecha_del_servicio(s);
    faltan := hora - now();
    servicio := lower(s.tipo_servicio);

    if faltan < interval '-2 hours' then
      -- Servicios viejos que nadie inició: se marcan sin avisar.
      update public.servicios
         set recordatorio_24h_el = coalesce(recordatorio_24h_el, now()),
             recordatorio_1h_el  = coalesce(recordatorio_1h_el, now()),
             aviso_hora_el       = now()
       where id = s.id;

    elsif faltan <= interval '0' then
      perform public.notificar(
        s.transportista_id, s.id, 'hora_sin_iniciar',
        'Ya es la hora de tu servicio',
        'Tu ' || servicio || ' estaba programado para el ' || public.texto_hora(hora)
          || ' y aún no lo has iniciado. Inícialo desde «Aceptadas».'
      );
      update public.servicios
         set recordatorio_24h_el = coalesce(recordatorio_24h_el, now()),
             recordatorio_1h_el  = coalesce(recordatorio_1h_el, now()),
             aviso_hora_el       = now()
       where id = s.id;

    elsif s.recordatorio_1h_el is null and faltan <= interval '1 hour' then
      perform public.notificar(
        s.user_id, s.id, 'recordatorio_cliente',
        'Tu servicio empieza pronto',
        'Tu ' || servicio || ' es a las ' || public.texto_hora(hora) || '. ¡Ten todo listo!'
      );
      perform public.notificar(
        s.transportista_id, s.id, 'recordatorio_conductor',
        'Tienes un servicio en 1 hora',
        'Tu ' || servicio || ' es a las ' || public.texto_hora(hora)
          || '. Recogida: ' || s.origen || '.'
      );
      update public.servicios
         set recordatorio_24h_el = coalesce(recordatorio_24h_el, now()),
             recordatorio_1h_el  = now()
       where id = s.id;

    elsif s.recordatorio_24h_el is null and faltan <= interval '24 hours' then
      perform public.notificar(
        s.user_id, s.id, 'recordatorio_cliente',
        'Recordatorio de tu servicio',
        'Tu ' || servicio || ' está programado para el ' || public.texto_hora(hora) || '.'
      );
      perform public.notificar(
        s.transportista_id, s.id, 'recordatorio_conductor',
        'Recordatorio de servicio',
        'Tienes un ' || servicio || ' programado para el ' || public.texto_hora(hora)
          || '. Recogida: ' || s.origen || '.'
      );
      update public.servicios
         set recordatorio_24h_el = now()
       where id = s.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.enviar_recordatorios() from public, anon, authenticated;

-- Tarea programada cada 5 minutos (se reemplaza si ya existía).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'mueveloya-recordatorios') then
    perform cron.unschedule('mueveloya-recordatorios');
  end if;
  perform cron.schedule(
    'mueveloya-recordatorios',
    '*/5 * * * *',
    'select public.enviar_recordatorios()'
  );
end $$;
