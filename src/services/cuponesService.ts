// src/services/cuponesService.ts
//
// Cupones del cliente (supabase/migraciones/013). La base de datos aplica
// SOLA el mejor cupón al crear la solicitud; aquí solo se leen para
// mostrárselos al cliente y enseñarle el precio con descuento.
import { asegurarSesion, supabase } from "../lib/supabase";

export interface Cupon {
  id: string;
  /** null = vale para cualquier servicio. */
  tipoServicio: string | null;
  porcentaje: number;
  motivo: string;
  venceEl: string;
}

/** Cupones sin usar y vigentes del cliente, el de mayor descuento primero. */
export const obtenerCuponesDisponibles = async (): Promise<Cupon[]> => {
  try {
    await asegurarSesion();
    const { data, error } = await supabase
      .from("cupones")
      .select("id, tipo_servicio, porcentaje, motivo, vence_el")
      .is("usado_el", null)
      .gt("vence_el", new Date().toISOString())
      .order("porcentaje", { ascending: false })
      .order("vence_el", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: String(c.id),
      tipoServicio: c.tipo_servicio ?? null,
      porcentaje: Number(c.porcentaje) || 0,
      motivo: String(c.motivo),
      venceEl: String(c.vence_el),
    }));
  } catch (error) {
    // Sin cupones la app funciona igual: nunca debe bloquear la solicitud.
    console.error("Error al cargar los cupones:", error);
    return [];
  }
};

/** El mismo cupón que elegirá la base: mayor descuento y, si empatan, el que vence antes. */
export const mejorCupon = (cupones: Cupon[], tipoServicio: string): Cupon | null =>
  cupones
    .filter((c) => !c.tipoServicio || c.tipoServicio === tipoServicio)
    .sort(
      (a, b) =>
        b.porcentaje - a.porcentaje ||
        new Date(a.venceEl).getTime() - new Date(b.venceEl).getTime(),
    )[0] ?? null;

/** Igual que la base: round(total × % / 100). */
export const descuentoDe = (total: number, porcentaje: number) =>
  Math.round((total * porcentaje) / 100);

export const diasRestantes = (venceEl: string) =>
  Math.max(0, Math.ceil((new Date(venceEl).getTime() - Date.now()) / 86_400_000));
