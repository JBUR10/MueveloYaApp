// src/services/promocionesService.ts
//
// Promociones del panel de administrador (supabase/migraciones/013, 017 y 022).
// Todo lo hace la base de datos y solo responde a las cuentas de la tabla
// "administradores".
import { asegurarSesion, supabase } from "../lib/supabase";

export type MotivoPromocion =
  | "primera_vez"
  | "segundo_pedido"
  | "reactivacion"
  | "todos";

export const MOTIVOS: { id: MotivoPromocion; titulo: string }[] = [
  { id: "primera_vez", titulo: "Primera vez" },
  { id: "segundo_pedido", titulo: "Segundo pedido" },
  { id: "reactivacion", titulo: "Reactivación" },
  { id: "todos", titulo: "Todos" },
];

export const NOMBRE_MOTIVO: Record<string, string> = {
  primera_vez: "Primera vez",
  segundo_pedido: "Segundo pedido",
  reactivacion: "Reactivación",
  todos: "Todos los clientes",
};

export interface ResultadoCampana {
  id: string;
  motivo: string;
  tipo: string | null;
  porcentaje: number;
  creadaEl: string;
  venceEl: string;
  eliminadaEl: string | null;
  enviados: number;
  usados: number;
  completados: number;
  ingresos: number;
  descuento: number;
}

export interface PromocionVigente {
  id: string;
  motivo: string;
  tipo: string | null;
  porcentaje: number;
  venceEl: string;
  enviados: number;
}

const num = (v: unknown) => Number(v) || 0;

/** Cuántos clientes recibirían la promoción (sin enviarla). */
export const contarAudiencia = async (
  motivo: MotivoPromocion,
  tipo: string | null,
  diasInactivo = 30,
  diasEntrePromociones = 7,
): Promise<number> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("contar_audiencia", {
    p_motivo: motivo,
    p_tipo: tipo,
    p_dias_inactivo: diasInactivo,
    p_dias_entre_promociones: diasEntrePromociones,
  });
  if (error) throw new Error(error.message || "No se pudo calcular el público.");
  return num(data);
};

/** Crea los cupones y avisa a cada cliente (aviso en la app + push). */
export const crearCampana = async (datos: {
  motivo: MotivoPromocion;
  tipo: string | null;
  porcentaje: number;
  dias: number;
  diasInactivo: number;
  diasEntrePromociones: number;
}): Promise<{ destinatarios: number }> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("crear_campana", {
    p_motivo: datos.motivo,
    p_tipo: datos.tipo,
    p_porcentaje: datos.porcentaje,
    p_dias: datos.dias,
    p_dias_inactivo: datos.diasInactivo,
    p_dias_entre_promociones: datos.diasEntrePromociones,
  });
  if (error) {
    console.error("Error al crear la promoción:", error);
    throw new Error(error.message || "No se pudo enviar la promoción.");
  }
  return { destinatarios: num((data as any)?.destinatarios) };
};

export const obtenerPromocionesVigentes = async (): Promise<
  PromocionVigente[]
> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("promociones_vigentes");
  if (error) throw new Error(error.message || "No se pudieron cargar las promociones vigentes.");
  return ((data as any[]) ?? []).map((c) => ({
    id: String(c.id),
    motivo: String(c.motivo),
    tipo: c.tipo ?? null,
    porcentaje: num(c.porcentaje),
    venceEl: String(c.vence_el),
    enviados: num(c.enviados),
  }));
};

export const eliminarCampana = async (id: string): Promise<void> => {
  await asegurarSesion();
  const { error } = await supabase.rpc("eliminar_campana", {
    p_campana_id: id,
  });
  if (error) throw new Error(error.message || "No se pudo dar de baja la promoción.");
};

export const obtenerResultadosCampanas = async (): Promise<ResultadoCampana[]> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("resultados_campanas", { p_limite: 20 });
  if (error) throw new Error(error.message || "No se pudieron cargar los resultados.");
  return ((data as any[]) ?? []).map((c) => ({
    id: String(c.id),
    motivo: String(c.motivo),
    tipo: c.tipo ?? null,
    porcentaje: num(c.porcentaje),
    creadaEl: String(c.creada_el),
    venceEl: String(c.vence_el),
    eliminadaEl: c.eliminada_el ?? null,
    enviados: num(c.enviados),
    usados: num(c.usados),
    completados: num(c.completados),
    ingresos: num(c.ingresos),
    descuento: num(c.descuento),
  }));
};
