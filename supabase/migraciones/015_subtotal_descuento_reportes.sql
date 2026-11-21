-- Muévelo Ya · 015: subtotal y descuento en reportes administrativos

create or replace function public.consulta_admin(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ejecutar consultas.';
  end if;

  case upper(trim(p_codigo))
    when 'Q01' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada desc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, tarifa_base, descuento, tarifa_acordada, estado
              from public.servicios where estado = 'pendiente') t;
    when 'Q02' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada asc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, destino, estado, tarifa_base, descuento, tarifa_acordada
              from public.servicios where tipo_servicio = 'Mudanza') t;
    when 'Q03' then
      select jsonb_agg(to_jsonb(t))
        into v_res
        from (select id, tipo_servicio, origen, tarifa_base, descuento, tarifa_acordada, estado
              from public.servicios where estado = 'en_curso') t;
    when 'Q04' then
      select jsonb_agg(to_jsonb(t) order by t.total desc, t.estado)
        into v_res
        from (select estado, count(*) as total from public.servicios group by estado) t;
    when 'Q05' then
      select jsonb_build_array(jsonb_build_object('valor', round(avg(tarifa_acordada))))
        into v_res
        from public.servicios;
    when 'Q06' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada desc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, destino, distancia_km,
                     tarifa_base, descuento, tarifa_acordada, estado
              from public.servicios where distancia_km > 5) t;
    when 'Q07' then
      select jsonb_build_array(jsonb_build_object('valor', count(*)))
        into v_res
        from public.servicios;
    when 'Q08' then
      select jsonb_build_array(jsonb_build_object(
               'valor', coalesce(sum(tarifa_acordada), 0)))
        into v_res
        from public.servicios;
    when 'Q09' then
      select jsonb_agg(to_jsonb(t))
        into v_res
        from (select id, tipo_servicio, origen, destino, tarifa_base, descuento, tarifa_acordada, estado
              from public.servicios
              where tarifa_acordada is not null
              order by tarifa_acordada desc
              limit 1) t;
    when 'Q10' then
      select jsonb_agg(to_jsonb(t) order by t.total desc, t.tipo_servicio)
        into v_res
        from (select tipo_servicio, count(*) as total
              from public.servicios group by tipo_servicio) t;
    else
      raise exception 'Consulta no válida: %', p_codigo;
  end case;

  return coalesce(v_res, '[]'::jsonb);
end;
$$;

revoke all on function public.consulta_admin(text) from public, anon;
grant execute on function public.consulta_admin(text) to authenticated;
