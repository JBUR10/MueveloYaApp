-- =====================================================================
-- Muévelo Ya · 008: estadísticas de pedidos para el panel de administrador
-- ---------------------------------------------------------------------
-- Requiere 001 y 005. Idempotente: se puede volver a ejecutar.
--
-- Crea la función estadisticas_pedidos(p_dias), que solo responde a las
-- cuentas de la tabla "administradores" y devuelve ya agregado (sin datos
-- personales de los clientes):
--   · total de pedidos y cuántos tienen ubicación en el mapa,
--   · cantidad por tipo de servicio (Envío, Acarreo, Trasteo, Mudanza),
--   · cantidad por estado,
--   · zonas: el punto de recogida se agrupa en cuadrículas de 0,01°
--     (~1,1 km) y se cuenta cuántos pedidos salen de cada una,
--   · barrios con más pedidos (según el texto de la dirección de recogida).
--
-- p_dias = 7 / 30 / ... filtra por los últimos N días; null = todo.
-- =====================================================================

create or replace function public.estadisticas_pedidos(p_dias integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde timestamptz;
  v_res   jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver las estadísticas.';
  end if;

  v_desde := case
    when p_dias is null then null
    else now() - make_interval(days => greatest(p_dias, 1))
  end;

  with base as (
    select
      tipo_servicio,
      coalesce(estado, 'pendiente') as estado,
      origen_lat,
      origen_lng,
      -- "Cra 43A 10-50, El Poblado" -> "El Poblado"
      nullif(trim(split_part(origen, ',', 2)), '') as barrio
    from public.servicios
    where v_desde is null or fecha::timestamptz >= v_desde
  )
  select jsonb_build_object(
    'total',
      (select count(*) from base),
    'con_ubicacion',
      (select count(*) from base
        where origen_lat is not null and origen_lng is not null),
    'por_tipo',
      coalesce((
        select jsonb_agg(
                 jsonb_build_object('tipo', tipo_servicio, 'total', n)
                 order by n desc, tipo_servicio)
        from (select tipo_servicio, count(*) as n from base group by 1) t
      ), '[]'::jsonb),
    'por_estado',
      coalesce((
        select jsonb_agg(
                 jsonb_build_object('estado', estado, 'total', n)
                 order by n desc, estado)
        from (select estado, count(*) as n from base group by 1) e
      ), '[]'::jsonb),
    'zonas',
      coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'lat', lat, 'lng', lng, 'total', n, 'nombre', nombre)
                 order by n desc)
        from (
          select
            round(origen_lat::numeric, 2) as lat,
            round(origen_lng::numeric, 2) as lng,
            count(*)                      as n,
            mode() within group (order by barrio) as nombre
          from base
          where origen_lat is not null and origen_lng is not null
          group by 1, 2
        ) z
      ), '[]'::jsonb),
    'barrios',
      coalesce((
        select jsonb_agg(
                 jsonb_build_object('nombre', nombre, 'total', n)
                 order by n desc, nombre)
        from (
          select min(barrio) as nombre, count(*) as n
          from base
          where barrio is not null
          group by lower(barrio)
          order by n desc, min(barrio)
          limit 8
        ) b
      ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.estadisticas_pedidos(integer) from public, anon;
grant execute on function public.estadisticas_pedidos(integer) to authenticated;
