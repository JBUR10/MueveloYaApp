-- =====================================================================
-- Muévelo Ya · 010: el conductor puede rechazar solicitudes
-- ---------------------------------------------------------------------
-- Requiere 007. Idempotente: se puede volver a ejecutar.
--
-- Al rechazar una solicitud, esta desaparece SOLO para ese conductor
-- (de su mapa, su lista y sus notificaciones push). Para los demás sigue
-- disponible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) SOLICITUDES RECHAZADAS POR CADA CONDUCTOR
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_rechazadas (
  transportista_id uuid not null default auth.uid()
                   references public.perfiles (id) on delete cascade,
  servicio_id      uuid not null
                   references public.servicios (id) on delete cascade,
  rechazada_el     timestamptz not null default now(),
  primary key (transportista_id, servicio_id)
);

alter table public.solicitudes_rechazadas enable row level security;

drop policy if exists "rechazos: ver propios" on public.solicitudes_rechazadas;
create policy "rechazos: ver propios" on public.solicitudes_rechazadas
  for select to authenticated
  using (transportista_id = auth.uid());

drop policy if exists "rechazos: crear propios" on public.solicitudes_rechazadas;
create policy "rechazos: crear propios" on public.solicitudes_rechazadas
  for insert to authenticated
  with check (transportista_id = auth.uid());

drop policy if exists "rechazos: borrar propios" on public.solicitudes_rechazadas;
create policy "rechazos: borrar propios" on public.solicitudes_rechazadas
  for delete to authenticated
  using (transportista_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) PUSH DE SOLICITUDES NUEVAS (reemplaza la versión de la 007)
--    - No avisa a quien ya la rechazó (si vuelve a quedar pendiente).
--    - Con un servicio en curso, el conductor solo puede tomar
--      programadas: se le avisan las programadas, no las inmediatas.
--    - Al tocar la notificación se abre el mapa con la solicitud.
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
