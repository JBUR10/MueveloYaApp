-- =====================================================================
-- Muévelo Ya · 004: corrige estado de servicios (default y constraint)
-- ---------------------------------------------------------------------
-- Soluciona: new row for relation "servicios" violates check constraint
-- "servicios_estado_valido". Idempotente: se puede volver a ejecutar.
-- Requiere 003 (estado 'cancelada').
-- =====================================================================

alter table public.servicios drop constraint if exists servicios_estado_valido;

update public.servicios
   set estado = lower(trim(estado))
 where estado is not null;

update public.servicios
   set estado = 'pendiente'
 where estado is null
    or estado not in ('pendiente','aceptada','en_curso','completada','cancelada');

alter table public.servicios
  alter column estado set default 'pendiente',
  alter column estado set not null;

alter table public.servicios
  add constraint servicios_estado_valido
  check (estado in ('pendiente','aceptada','en_curso','completada','cancelada'));
