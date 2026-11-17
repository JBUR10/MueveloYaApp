-- =====================================================================
-- Muévelo Ya · 011: análisis de datos para el panel de administrador
-- ---------------------------------------------------------------------
-- Requiere 001, 003, 005, 007 y 009. Idempotente.
--
-- analisis_pedidos(p_dias) devuelve, ya agregado y sin datos personales:
--   · KPIs: pedidos, ingresos (completados), tarifa promedio, distancia
--     promedio, tasa de completados y de cancelación, calificación media,
--     minutos promedio hasta que un conductor acepta.
--   · comparación contra el periodo anterior (si p_dias no es null).
--   · serie por día, por hora del día y por día de la semana.
--   · motivos de cancelación más frecuentes.
-- p_dias = 7 / 30 / ... filtra los últimos N días; null = todo.
-- =====================================================================

create or replace function public.analisis_pedidos(p_dias integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde timestamptz;
  v_prev  timestamptz;
  v_res   jsonb;
  v_prev_total integer;
  v_prev_ingresos bigint;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver el análisis de datos.';
  end if;

  if p_dias is not null then
    v_desde := now() - make_interval(days => greatest(p_dias, 1));
    v_prev  := now() - make_interval(days => greatest(p_dias, 1) * 2);

    select count(*),
           coalesce(sum(tarifa_acordada) filter (where estado = 'completada'), 0)
      into v_prev_total, v_prev_ingresos
      from public.servicios
     where fecha::timestamptz >= v_prev and fecha::timestamptz < v_desde;
  end if;

  with base as (
    select
      id,
      tipo_servicio,
      coalesce(estado, 'pendiente')           as estado,
      fecha::timestamptz                      as f,
      aceptada_el,
      tarifa_acordada,
      distancia_km,
      nullif(trim(motivo_cancelacion), '')    as motivo
    from public.servicios
    where v_desde is null or fecha::timestamptz >= v_desde
  ),
  local as (
    select *, (f at time zone 'America/Bogota') as f_local from base
  )
  select jsonb_build_object(
    'total',            (select count(*) from base),
    'ingresos',         (select coalesce(sum(tarifa_acordada), 0)
                           from base where estado = 'completada'),
    'tarifa_promedio',  (select round(avg(tarifa_acordada)) from base),
    'distancia_promedio',
                        (select round(avg(distancia_km)::numeric, 1) from base),
    'completados',      (select count(*) from base where estado = 'completada'),
    'cancelados',       (select count(*) from base where estado = 'cancelada'),
    'minutos_aceptacion',
      (select round(avg(extract(epoch from (aceptada_el - f)) / 60)::numeric, 1)
         from base
        where aceptada_el is not null and aceptada_el >= f),
    'calificacion_promedio',
      (select round(avg(c.estrellas)::numeric, 2)
         from public.calificaciones c
         join base b on b.id = c.servicio_id),
    'total_anterior',    v_prev_total,
    'ingresos_anterior', v_prev_ingresos,

    'por_dia',
      coalesce((
        select jsonb_agg(jsonb_build_object('dia', dia, 'total', n,
                                            'ingresos', ing) order by dia)
        from (
          select f_local::date as dia, count(*) as n,
                 coalesce(sum(tarifa_acordada) filter (where estado = 'completada'), 0) as ing
          from local group by 1
        ) d
      ), '[]'::jsonb),

    'por_hora',
      coalesce((
        select jsonb_agg(jsonb_build_object('hora', h, 'total', n) order by h)
        from (
          select extract(hour from f_local)::int as h, count(*) as n
          from local group by 1
        ) x
      ), '[]'::jsonb),

    'por_dia_semana',
      coalesce((
        select jsonb_agg(jsonb_build_object('dia', d, 'total', n) order by d)
        from (
          select extract(isodow from f_local)::int as d, count(*) as n  -- 1 = lunes
          from local group by 1
        ) x
      ), '[]'::jsonb),

    'motivos_cancelacion',
      coalesce((
        select jsonb_agg(jsonb_build_object('motivo', motivo, 'total', n)
                         order by n desc, motivo)
        from (
          select motivo, count(*) as n
          from base
          where estado = 'cancelada' and motivo is not null
          group by 1 order by n desc limit 5
        ) m
      ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.analisis_pedidos(integer) from public, anon;
grant execute on function public.analisis_pedidos(integer) to authenticated;
