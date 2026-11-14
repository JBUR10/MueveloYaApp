-- =====================================================================
-- Muévelo Ya · 009: tarifa de los servicios y catálogo de consultas
--                   (Q01 a Q10) para el panel de administrador
-- ---------------------------------------------------------------------
-- Requiere 001 y 005. Idempotente: se puede volver a ejecutar.
--
-- Tarifa (pesos colombianos):
--   120.000 por los primeros 5 km
-- + 20.000 por cada km adicional (proporcional: 2,3 km = 46.000)
-- + 20.000 por cada ayudante
-- + 10.000 por cada piso
-- La distancia es la de la ruta en calles (OSRM), la calcula la app al
-- crear la solicitud. La tarifa la calcula SIEMPRE la base de datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) COLUMNAS
-- ---------------------------------------------------------------------
alter table public.servicios
  add column if not exists distancia_km    numeric(8, 2),
  add column if not exists tarifa_acordada integer;

-- ---------------------------------------------------------------------
-- 2) CÁLCULO DE LA TARIFA
-- ---------------------------------------------------------------------
create or replace function public.calcular_tarifa(
  p_km numeric, p_ayudantes integer, p_pisos integer
)
returns integer
language sql
immutable
as $$
  select round(
           120000
         + greatest(coalesce(p_km, 0) - 5, 0) * 20000
         + greatest(coalesce(p_ayudantes, 0), 0) * 20000
         + greatest(coalesce(p_pisos, 0), 0) * 10000
         )::integer;
$$;

-- Se recalcula al crear la solicitud o si cambian distancia, ayudantes o
-- pisos. Aunque la app envíe otra tarifa, manda la fórmula.
create or replace function public.servicios_calcular_tarifa()
returns trigger
language plpgsql
as $$
begin
  new.tarifa_acordada :=
    public.calcular_tarifa(new.distancia_km, new.ayudantes, new.pisos_escaleras);
  return new;
end;
$$;

drop trigger if exists servicios_calcular_tarifa on public.servicios;
create trigger servicios_calcular_tarifa
  before insert or update of distancia_km, ayudantes, pisos_escaleras, tarifa_acordada
  on public.servicios
  for each row execute function public.servicios_calcular_tarifa();

-- ---------------------------------------------------------------------
-- 3) SERVICIOS QUE YA EXISTÍAN
--    No tienen distancia de ruta: se estima en línea recta con sus
--    coordenadas. Los que no tienen coordenadas quedan con la tarifa base
--    (+ ayudantes y pisos). El trigger calcula la tarifa en cada update.
-- ---------------------------------------------------------------------
update public.servicios
   set distancia_km = round((
         2 * 6371 * asin(sqrt(
             power(sin(radians(destino_lat - origen_lat) / 2), 2)
           + cos(radians(origen_lat)) * cos(radians(destino_lat))
             * power(sin(radians(destino_lng - origen_lng) / 2), 2)
         ))
       )::numeric, 2)
 where distancia_km is null
   and origen_lat is not null and origen_lng is not null
   and destino_lat is not null and destino_lng is not null;

update public.servicios
   set tarifa_acordada = null   -- el trigger la reemplaza por la calculada
 where tarifa_acordada is null;

-- ---------------------------------------------------------------------
-- 4) CATÁLOGO DE CONSULTAS Q01–Q10 (solo administradores)
--    Devuelve siempre un arreglo JSON de filas. Las métricas únicas
--    (Q05, Q07, Q08) devuelven una sola fila con la columna "valor".
-- ---------------------------------------------------------------------
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

    -- Q01: servicios pendientes, de mayor a menor tarifa
    when 'Q01' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada desc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, tarifa_acordada, estado
                from public.servicios
               where estado = 'pendiente') t;

    -- Q02: mudanzas, de menor a mayor tarifa
    when 'Q02' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada asc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, destino, estado, tarifa_acordada
                from public.servicios
               where tipo_servicio = 'Mudanza') t;

    -- Q03: servicios en curso
    when 'Q03' then
      select jsonb_agg(to_jsonb(t))
        into v_res
        from (select id, tipo_servicio, origen, tarifa_acordada, estado
                from public.servicios
               where estado = 'en_curso') t;

    -- Q04: cantidad de servicios por estado
    when 'Q04' then
      select jsonb_agg(to_jsonb(t) order by t.total desc, t.estado)
        into v_res
        from (select estado, count(*) as total
                from public.servicios
               group by estado) t;

    -- Q05: tarifa promedio
    when 'Q05' then
      select jsonb_build_array(jsonb_build_object(
               'valor', round(avg(tarifa_acordada))))
        into v_res
        from public.servicios;

    -- Q06: servicios de más de 5 km (desde ahí se cobra el km adicional),
    --      de mayor a menor tarifa
    when 'Q06' then
      select jsonb_agg(to_jsonb(t) order by t.tarifa_acordada desc nulls last)
        into v_res
        from (select id, tipo_servicio, origen, destino, distancia_km,
                     tarifa_acordada, estado
                from public.servicios
               where distancia_km > 5) t;

    -- Q07: total de servicios registrados
    when 'Q07' then
      select jsonb_build_array(jsonb_build_object('valor', count(*)))
        into v_res
        from public.servicios;

    -- Q08: suma de todas las tarifas
    when 'Q08' then
      select jsonb_build_array(jsonb_build_object(
               'valor', coalesce(sum(tarifa_acordada), 0)))
        into v_res
        from public.servicios;

    -- Q09: el servicio con la tarifa más alta
    when 'Q09' then
      select jsonb_agg(to_jsonb(t))
        into v_res
        from (select id, tipo_servicio, origen, destino, tarifa_acordada, estado
                from public.servicios
               where tarifa_acordada is not null
               order by tarifa_acordada desc
               limit 1) t;

    -- Q10: cantidad de servicios por tipo
    when 'Q10' then
      select jsonb_agg(to_jsonb(t) order by t.total desc, t.tipo_servicio)
        into v_res
        from (select tipo_servicio, count(*) as total
                from public.servicios
               group by tipo_servicio) t;

    else
      raise exception 'Consulta no válida: %', p_codigo;
  end case;

  return coalesce(v_res, '[]'::jsonb);
end;
$$;

revoke all on function public.consulta_admin(text) from public, anon;
grant execute on function public.consulta_admin(text) to authenticated;
