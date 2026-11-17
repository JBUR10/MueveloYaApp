-- =====================================================================
-- Muévelo Ya · 014: el conductor indica si cuenta con ayudantes
-- ---------------------------------------------------------------------
-- Requiere 010 (y va después de la 011–013). Idempotente: se puede volver a ejecutar.
--
-- Si el conductor NO cuenta con ayudantes, las solicitudes que piden 1 o
-- más ayudantes no le aparecen (lo filtra la app), no le llega push de
-- ellas y la base de datos no le deja aceptarlas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PREFERENCIA DEL CONDUCTOR
--    La edita él mismo (política "perfiles: editar propio" de la 001).
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists cuenta_con_ayudantes boolean not null default false;

-- ---------------------------------------------------------------------
-- 2) NO SE PUEDE ACEPTAR UNA SOLICITUD CON AYUDANTES SIN TENERLOS
--    Se revisa justo cuando la solicitud pasa de pendiente a aceptada.
-- ---------------------------------------------------------------------
create or replace function public.validar_ayudantes_al_aceptar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ayudantes > 0
     and not exists (
       select 1 from public.perfiles p
        where p.id = new.transportista_id and p.cuenta_con_ayudantes
     ) then
    raise exception 'Esta solicitud requiere ayudantes. Actívalos en tu panel si cuentas con ellos.';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_ayudantes_al_aceptar on public.servicios;
create trigger validar_ayudantes_al_aceptar
  before update of estado on public.servicios
  for each row
  when (old.estado = 'pendiente' and new.estado = 'aceptada')
  execute function public.validar_ayudantes_al_aceptar();

-- ---------------------------------------------------------------------
-- 3) PUSH DE SOLICITUDES NUEVAS (reemplaza la versión de la 010)
--    Igual que antes, y además: si pide ayudantes, solo a conductores
--    que cuentan con ellos.
-- ---------------------------------------------------------------------
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
     -- Si pide ayudantes, solo a quien cuenta con ellos.
     and (coalesce(new.ayudantes, 0) = 0 or p.cuenta_con_ayudantes)
     -- La rechazó antes (por ejemplo, otro conductor la canceló y volvió).
     and not exists (
       select 1 from public.solicitudes_rechazadas r
        where r.transportista_id = p.id and r.servicio_id = new.id
     )
     -- En un servicio en curso no se le avisan las inmediatas.
     and (
       programado
       or not exists (
         select 1 from public.servicios s
          where s.transportista_id = p.id
            and s.estado in ('aceptada', 'en_curso')
            and s.iniciada_el is not null
       )
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
    jsonb_build_object(
      'tipo', 'solicitud_nueva',
      'servicioId', new.id,
      -- Inicio del conductor (mapa) con la solicitud abierta.
      'ruta', '/?ver=' || new.id
    )
  );
  return new;
end;
$$;
