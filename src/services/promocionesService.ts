// src/services/promocionesService.ts
//
// Promociones del panel de administrador (supabase/migraciones/013).
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
  enviados: number;
  usados: number;
  completados: number;
  ingresos: number;
  descuento: number;
}

const num = (v: unknown) => Number(v) || 0;

/** Cuántos clientes recibirían la promoción (sin enviarla). */
export const contarAudiencia = async (
  motivo: MotivoPromocion,
  tipo: string | null,
): Promise<number> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("contar_audiencia", {
    p_motivo: motivo,
    p_tipo: tipo,
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
}): Promise<{ destinatarios: number }> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("crear_campana", {
    p_motivo: datos.motivo,
    p_tipo: datos.tipo,
    p_porcentaje: datos.porcentaje,
    p_dias: datos.dias,
  });
  if (error) {
    console.error("Error al crear la promoción:", error);
    throw new Error(error.message || "No se pudo enviar la promoción.");
  }
  return { destinatarios: num((data as any)?.destinatarios) };
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
    enviados: num(c.enviados),
    usados: num(c.usados),
    completados: num(c.completados),
    ingresos: num(c.ingresos),
    descuento: num(c.descuento),
  }));
};
