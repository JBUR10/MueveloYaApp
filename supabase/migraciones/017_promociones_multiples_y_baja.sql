-- Muévelo Ya · 017: promociones simultáneas, selección y baja inmediata

alter table public.campanas
  add column if not exists eliminada_el timestamptz;

create or replace function public.promociones_vigentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver las promociones.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id,
             'motivo', c.motivo,
             'tipo', c.tipo_servicio,
             'porcentaje', c.porcentaje,
             'vence_el', c.creada_el + make_interval(days => c.vigencia_dias),
             'enviados', c.destinatarios
           ) order by c.creada_el desc)
    from public.campanas c
    where c.eliminada_el is null
      and c.destinatarios > 0
      and c.creada_el + make_interval(days => c.vigencia_dias) > now()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.eliminar_campana(p_campana_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para eliminar promociones.';
  end if;

  update public.campanas
     set eliminada_el = now()
   where id = p_campana_id
     and eliminada_el is null
     and creada_el + make_interval(days => vigencia_dias) > now()
  returning id into v_id;

  if v_id is null then
    raise exception 'La promoción ya no está vigente.';
  end if;

  update public.cupones
     set vence_el = least(vence_el, '1970-01-01 00:00:00+00'::timestamptz)
   where campana_id = v_id
     and usado_el is null
     and vence_el > now();
end;
$$;

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
    if new.cupon_id is not null then
      select q.id, q.porcentaje into v_id, v_pct
        from public.cupones q
        left join public.campanas c on c.id = q.campana_id
       where q.id = new.cupon_id
         and q.usuario_id = new.user_id
         and q.usado_el is null
         and q.vence_el > now()
         and (q.tipo_servicio is null or q.tipo_servicio = new.tipo_servicio)
         and (q.campana_id is null or (
           c.id is not null
           and c.eliminada_el is null
           and c.creada_el + make_interval(days => c.vigencia_dias) > now()
         ))
       limit 1
       for update of q skip locked;

      if v_id is null then
        raise exception 'El cupón seleccionado ya no está disponible. Actualiza la lista e inténtalo nuevamente.';
      end if;
    else
      select q.id, q.porcentaje into v_id, v_pct
        from public.cupones q
        left join public.campanas c on c.id = q.campana_id
       where q.usuario_id = new.user_id
         and q.usado_el is null
         and q.vence_el > now()
         and (q.tipo_servicio is null or q.tipo_servicio = new.tipo_servicio)
         and (q.campana_id is null or (
           c.id is not null
           and c.eliminada_el is null
           and c.creada_el + make_interval(days => c.vigencia_dias) > now()
         ))
       order by q.porcentaje desc, q.vence_el asc
       limit 1
       for update of q skip locked;
    end if;

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

create or replace function public.resultados_campanas(p_limite integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para ver los resultados.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',          c.id,
             'motivo',      c.motivo,
             'tipo',        c.tipo_servicio,
             'porcentaje',  c.porcentaje,
             'creada_el',   c.creada_el,
             'vence_el',    c.creada_el + make_interval(days => c.vigencia_dias),
             'eliminada_el', c.eliminada_el,
             'enviados',    c.destinatarios,
             'usados',      coalesce(u.usados, 0),
             'completados', coalesce(u.completados, 0),
             'ingresos',    coalesce(u.ingresos, 0),
             'descuento',   coalesce(u.descuento, 0)
           ) order by c.creada_el desc)
    from (
      select * from public.campanas
       order by creada_el desc
       limit greatest(coalesce(p_limite, 20), 1)
    ) c
    left join lateral (
      select count(*) as usados,
             count(*) filter (where s.estado = 'completada') as completados,
             coalesce(sum(s.tarifa_acordada) filter (where s.estado = 'completada'), 0) as ingresos,
             coalesce(sum(s.descuento) filter (where s.estado = 'completada'), 0) as descuento
        from public.cupones q
        join public.servicios s on s.id = q.servicio_id
       where q.campana_id = c.id
         and q.usado_el is not null
    ) u on true
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.promociones_vigentes() from public, anon;
revoke all on function public.eliminar_campana(uuid) from public, anon;
revoke all on function public.resultados_campanas(integer) from public, anon;
grant execute on function public.promociones_vigentes() to authenticated;
grant execute on function public.eliminar_campana(uuid) to authenticated;
grant execute on function public.resultados_campanas(integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cupones'
     ) then
    execute 'alter publication supabase_realtime add table public.cupones';
  end if;
end;
$$;
