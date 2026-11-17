-- =====================================================================
-- Muévelo Ya · 012: análisis de negocio (clientes y mezcla de servicios)
-- ---------------------------------------------------------------------
-- Requiere 001, 005 y 009. Idempotente.
--
-- analisis_negocio(p_dias) devuelve, agregado y sin datos personales:
--   · por tipo de servicio: pedidos, periodo anterior, ingresos, tarifa
--     promedio, cancelados, clientes que lo usaron y clientes que NUNCA
--     lo han usado (oportunidad de promoción);
--   · clientes: total, activos, nuevos, recurrentes, de un solo pedido,
--     inactivos (30+ días) y los que solo usan un tipo de servicio.
-- p_dias = 7 / 30 / ... filtra los últimos N días; null = todo.
-- =====================================================================

create or replace function public.analisis_negocio(p_dias integer default null)
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
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver el análisis de negocio.';
  end if;

  if p_dias is not null then
    v_desde := now() - make_interval(days => greatest(p_dias, 1));
    v_prev  := now() - make_interval(days => greatest(p_dias, 1) * 2);
  end if;

  with todos as (
    select user_id, tipo_servicio,
           coalesce(estado, 'pendiente') as estado,
           fecha::timestamptz            as f,
           tarifa_acordada
    from public.servicios
    where user_id is not null
  ),
  periodo as (select * from todos where v_desde is null or f >= v_desde),
  previo  as (select * from todos where v_desde is not null and f >= v_prev and f < v_desde),
  clientes as (
    select user_id,
           min(f)                        as primero,
           max(f)                        as ultimo,
           count(*)                      as n,
           count(distinct tipo_servicio) as n_tipos
    from todos group by 1
  ),
  tipos as (select distinct tipo_servicio from todos)
  select jsonb_build_object(
    'por_tipo',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'tipo',            t.tipo_servicio,
          'total',           coalesce(p.pedidos, 0),
          'anterior',        case when v_desde is null then null
                                  else coalesce(pv.pedidos, 0) end,
          'ingresos',        coalesce(p.ingresos, 0),
          'tarifa_promedio', p.tarifa,
          'cancelados',      coalesce(p.cancelados, 0),
          'clientes',        coalesce(p.clientes, 0),
          'clientes_nunca',  (select count(*) from clientes c
                               where not exists (
                                 select 1 from todos x
                                  where x.user_id = c.user_id
                                    and x.tipo_servicio = t.tipo_servicio))
        ) order by coalesce(p.pedidos, 0) desc)
        from tipos t
        left join (
          select tipo_servicio,
                 count(*)                                                   as pedidos,
                 coalesce(sum(tarifa_acordada) filter (where estado = 'completada'), 0) as ingresos,
                 round(avg(tarifa_acordada))                                as tarifa,
                 count(*) filter (where estado = 'cancelada')               as cancelados,
                 count(distinct user_id)                                    as clientes
          from periodo group by 1
        ) p on p.tipo_servicio = t.tipo_servicio
        left join (
          select tipo_servicio, count(*) as pedidos from previo group by 1
        ) pv on pv.tipo_servicio = t.tipo_servicio
      ), '[]'::jsonb),

    'clientes_total',       (select count(*) from clientes),
    'clientes_activos',     (select count(distinct user_id) from periodo),
    'clientes_nuevos',      (select count(*) from clientes
                              where v_desde is null or primero >= v_desde),
    'clientes_recurrentes', (select count(*) from clientes where n >= 2),
    'clientes_un_pedido',   (select count(*) from clientes where n = 1),
    'clientes_inactivos',   (select count(*) from clientes
                              where ultimo < now() - interval '30 days'),
    'clientes_un_tipo',     (select count(*) from clientes where n_tipos = 1)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.analisis_negocio(integer) from public, anon;
grant execute on function public.analisis_negocio(integer) to authenticated;
