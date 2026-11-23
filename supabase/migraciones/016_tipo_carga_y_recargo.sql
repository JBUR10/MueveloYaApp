-- Muévelo Ya · 016: tipo de carga y recargo especial

alter table public.servicios
  add column if not exists tipo_carga text not null default 'estandar',
  add column if not exists articulos_fragiles boolean not null default false,
  add column if not exists objetos_extrapesados boolean not null default false,
  add column if not exists recargo_carga integer not null default 0;

create or replace function public.servicios_aplicar_cupon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pct smallint;
  v_sin_carga integer;
  v_recargo integer;
  v_base integer;
begin
  if tg_op = 'INSERT' then
    new.cupon_id := null;
    select id, porcentaje into v_id, v_pct
      from public.cupones
     where usuario_id = new.user_id
       and usado_el is null
       and vence_el > now()
       and (tipo_servicio is null or tipo_servicio = new.tipo_servicio)
     order by porcentaje desc, vence_el asc
     limit 1
       for update skip locked;
    new.cupon_id := v_id;
  else
    new.cupon_id := old.cupon_id;
    if new.cupon_id is not null then
      select porcentaje into v_pct
        from public.cupones
       where id = new.cupon_id;
    end if;
  end if;

  v_sin_carga := public.calcular_tarifa(
    new.distancia_km,
    new.ayudantes,
    new.pisos_escaleras
  );

  if new.tipo_servicio in ('Trasteo', 'Mudanza') then
    v_recargo :=
      round(120000 * (
        case when coalesce(new.articulos_fragiles, false) then 15 else 0 end
        + case when coalesce(new.objetos_extrapesados, false) then 20 else 0 end
      ) / 100.0)::integer;
  elsif new.tipo_carga = 'fragil' then
    v_recargo := round(120000 * 15 / 100.0)::integer;
  elsif new.tipo_carga = 'extrapesado' then
    v_recargo := round(120000 * 20 / 100.0)::integer;
  else
    v_recargo := 0;
  end if;

  new.recargo_carga := v_recargo;
  v_base := v_sin_carga + v_recargo;
  new.tarifa_base := v_base;
  new.descuento := case
    when v_pct is null then 0
    else round(v_base * v_pct / 100.0)::integer
  end;
  new.tarifa_acordada := v_base - new.descuento;
  return new;
end;
$$;

drop trigger if exists servicios_cupon on public.servicios;
create trigger servicios_cupon
  before insert or update of distancia_km, ayudantes, pisos_escaleras,
                             tarifa_acordada, tarifa_base, descuento, cupon_id,
                             tipo_carga, articulos_fragiles,
                             objetos_extrapesados, recargo_carga
  on public.servicios
  for each row execute function public.servicios_aplicar_cupon();

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
        from (select id, tipo_servicio, origen, tarifa_base, recargo_carga,
                     descuento, tarifa_acordada, estado
              from public.servicios where estado = 'pendiente') t;
    when 'Q02' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada asc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, destino, estado, tarifa_base,
                     recargo_carga, descuento, tarifa_acordada
              from public.servicios where tipo_servicio = 'Mudanza') t;
    when 'Q03' then
      select jsonb_agg(to_jsonb(t))
        into v_res
        from (select id, tipo_servicio, origen, tarifa_base, recargo_carga,
                     descuento, tarifa_acordada, estado
              from public.servicios where estado = 'en_curso') t;
    when 'Q04' then
      select jsonb_agg(to_jsonb(t) order by t.total desc, t.estado)
        into v_res
        from (select estado, count(*) as total
              from public.servicios group by estado) t;
    when 'Q05' then
      select jsonb_build_array(jsonb_build_object(
               'valor', round(avg(tarifa_acordada))))
        into v_res
        from public.servicios;
    when 'Q06' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada desc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, destino, distancia_km,
                     tarifa_base, recargo_carga, descuento, tarifa_acordada, estado
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
        from (select id, tipo_servicio, origen, destino, tarifa_base,
                     recargo_carga, descuento, tarifa_acordada, estado
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
