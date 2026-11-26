-- Muévelo Ya · 022: control administrativo del límite de 7 días

create or replace function public.audiencia_campana(
  p_motivo text,
  p_tipo text,
  p_ignorar_limite boolean
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select p.id as user_id,
           count(s.user_id)       as n,
           max(s.fecha::timestamptz) as ultimo
      from public.perfiles p
      left join public.servicios s on s.user_id = p.id
     where not exists (
       select 1 from public.administradores a where a.user_id = p.id
     )
     group by p.id
  )
  select c.user_id
    from c
   where exists (select 1 from public.perfiles p where p.id = c.user_id)
     and case p_motivo
           when 'primera_vez' then not exists (
             select 1
               from public.servicios s
              where s.user_id = c.user_id
                and s.tipo_servicio = p_tipo
           )
           when 'segundo_pedido' then c.n = 1
           when 'reactivacion' then c.ultimo < now() - interval '30 days'
           when 'todos' then true
           else false
         end
     and (
       coalesce(p_ignorar_limite, false)
       or not exists (
         select 1
           from public.cupones q
          where q.usuario_id = c.user_id
            and q.creado_el > now() - interval '7 days'
       )
     );
$$;

revoke all on function public.audiencia_campana(text, text, boolean)
  from public, anon, authenticated;

create or replace function public.contar_audiencia(
  p_motivo text,
  p_tipo text,
  p_ignorar_limite boolean
)
returns integer
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
    raise exception 'No tienes permiso para ver esta información.';
  end if;

  return (
    select count(*)::integer
      from public.audiencia_campana(p_motivo, p_tipo, p_ignorar_limite)
  );
end;
$$;

create or replace function public.contar_audiencia(p_motivo text, p_tipo text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.contar_audiencia(p_motivo, p_tipo, false);
end;
$$;

create or replace function public.crear_campana(
  p_motivo text,
  p_tipo text,
  p_porcentaje integer,
  p_dias integer,
  p_ignorar_limite boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_n      integer;
  v_vence  timestamptz;
  v_titulo text;
  v_msg    text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if not public.soy_admin() then
    raise exception 'No tienes permiso para enviar promociones.';
  end if;
  if coalesce(p_motivo, '') not in ('primera_vez', 'segundo_pedido', 'reactivacion', 'todos') then
    raise exception 'Tipo de promoción no válido.';
  end if;
  if p_tipo is not null and p_tipo not in ('Envío', 'Acarreo', 'Trasteo', 'Mudanza') then
    raise exception 'Servicio no válido.';
  end if;
  if p_motivo = 'primera_vez' and p_tipo is null then
    raise exception 'Elige el servicio que quieres promover.';
  end if;
  if p_porcentaje is null or p_porcentaje not between 5 and 50 then
    raise exception 'El descuento debe estar entre 5 %% y 50 %%.';
  end if;
  if p_dias is null or p_dias not between 1 and 90 then
    raise exception 'La vigencia debe estar entre 1 y 90 días.';
  end if;

  v_vence := now() + make_interval(days => p_dias);

  insert into public.campanas (motivo, tipo_servicio, porcentaje, vigencia_dias)
  values (p_motivo, p_tipo, p_porcentaje, p_dias)
  returning id into v_id;

  insert into public.cupones (usuario_id, campana_id, tipo_servicio, porcentaje, motivo, vence_el)
  select u, v_id, p_tipo, p_porcentaje, p_motivo, v_vence
    from public.audiencia_campana(p_motivo, p_tipo, p_ignorar_limite) as u;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    delete from public.campanas where id = v_id;
    return jsonb_build_object('campana_id', null, 'destinatarios', 0);
  end if;

  update public.campanas set destinatarios = v_n where id = v_id;

  v_titulo := '🎁 Tienes un cupón de ' || p_porcentaje || ' %';
  v_msg := case p_motivo
    when 'primera_vez' then 'Prueba ' || lower(p_tipo) || ' con ' || p_porcentaje || ' % de descuento.'
    when 'segundo_pedido' then 'Tu próximo pedido tiene ' || p_porcentaje || ' % de descuento'
                               || coalesce(' en ' || lower(p_tipo), '') || '.'
    when 'reactivacion' then 'Te extrañamos: ' || p_porcentaje || ' % de descuento en tu próximo pedido'
                               || coalesce(' de ' || lower(p_tipo), '') || '.'
    else p_porcentaje || ' % de descuento '
         || coalesce('en ' || lower(p_tipo), 'en tu próximo pedido') || '.'
  end
  || ' Vence el ' || to_char(v_vence at time zone 'America/Bogota', 'DD/MM') || '.';

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
  select usuario_id, 'cupon', v_titulo, v_msg
    from public.cupones
   where campana_id = v_id;

  return jsonb_build_object('campana_id', v_id, 'destinatarios', v_n);
end;
$$;

create or replace function public.crear_campana(
  p_motivo text,
  p_tipo text,
  p_porcentaje integer,
  p_dias integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.crear_campana(
    p_motivo,
    p_tipo,
    p_porcentaje,
    p_dias,
    false
  );
end;
$$;

revoke all on function public.contar_audiencia(text, text, boolean) from public, anon;
revoke all on function public.crear_campana(text, text, integer, integer, boolean) from public, anon;
grant execute on function public.contar_audiencia(text, text, boolean) to authenticated;
grant execute on function public.crear_campana(text, text, integer, integer, boolean) to authenticated;
