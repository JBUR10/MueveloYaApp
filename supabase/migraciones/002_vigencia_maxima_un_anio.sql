-- =====================================================================
-- Muévelo Ya · 002: SOAT y técnico-mecánica con vigencia máxima de 1 año
-- ---------------------------------------------------------------------
-- Ambos documentos se expiden por un año, así que su vencimiento no puede
-- quedar más allá de hoy + 1 año. Evita errores al digitar la fecha.
-- Se usa un trigger (no un CHECK) porque depende de la fecha actual.
-- Idempotente: se puede volver a ejecutar.
-- =====================================================================

create or replace function public.validar_vigencia_documentos()
returns trigger
language plpgsql
as $$
declare
  limite date := (current_date + interval '1 year')::date;
begin
  if new.soat_vence > limite then
    raise exception 'El SOAT no puede vencer en más de 1 año.';
  end if;
  if not new.tecnomecanica_exento and new.tecnomecanica_vence > limite then
    raise exception 'La revisión técnico-mecánica no puede vencer en más de 1 año.';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_vigencia_documentos on public.vehiculos;
create trigger validar_vigencia_documentos
  before insert or update on public.vehiculos
  for each row execute function public.validar_vigencia_documentos();
