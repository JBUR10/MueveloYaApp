-- =====================================================================
-- Muévelo Ya · 021: retirar el trigger de pago heredado
-- =====================================================================

drop trigger if exists proteger_pago_servicio_insert on public.servicios;
drop function if exists public.proteger_pago_servicio_insert();
