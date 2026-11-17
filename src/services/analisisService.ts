// src/services/analisisService.ts
//
// Análisis de datos para el panel de administrador. Igual que estadísticas:
// el cálculo lo hace la base (supabase/migraciones/011) y solo responde a
// las cuentas de la tabla "administradores".
import { asegurarSesion, supabase } from "../lib/supabase";
import type { PeriodoEstadisticas } from "./estadisticasService";

export interface Analisis {
  total: number;
  ingresos: number;
  tarifaPromedio: number;
  distanciaPromedio: number;
  completados: number;
  cancelados: number;
  minutosAceptacion: number | null;
  calificacionPromedio: number | null;
  totalAnterior: number | null;
  ingresosAnterior: number | null;
  porDia: { dia: string; total: number; ingresos: number }[];
  porHora: { hora: number; total: number }[];
  porDiaSemana: { dia: number; total: number }[]; // 1 = lunes … 7 = domingo
  motivosCancelacion: { motivo: string; total: number }[];
}

const num = (v: unknown) => Number(v) || 0;
const numONull = (v: unknown) => (v == null ? null : Number(v));

export const obtenerAnalisis = async (
  dias: PeriodoEstadisticas,
): Promise<Analisis> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("analisis_pedidos", { p_dias: dias });
  if (error) {
    console.error("Error al cargar el análisis:", error);
    throw new Error(error.message || "No se pudo cargar el análisis de datos.");
  }
  const d = (data ?? {}) as Record<string, any>;
  return {
    total: num(d.total),
    ingresos: num(d.ingresos),
    tarifaPromedio: num(d.tarifa_promedio),
    distanciaPromedio: num(d.distancia_promedio),
    completados: num(d.completados),
    cancelados: num(d.cancelados),
    minutosAceptacion: numONull(d.minutos_aceptacion),
    calificacionPromedio: numONull(d.calificacion_promedio),
    totalAnterior: numONull(d.total_anterior),
    ingresosAnterior: numONull(d.ingresos_anterior),
    porDia: (d.por_dia ?? []).map((x: any) => ({
      dia: String(x.dia),
      total: num(x.total),
      ingresos: num(x.ingresos),
    })),
    porHora: (d.por_hora ?? []).map((x: any) => ({
      hora: num(x.hora),
      total: num(x.total),
    })),
    porDiaSemana: (d.por_dia_semana ?? []).map((x: any) => ({
      dia: num(x.dia),
      total: num(x.total),
    })),
    motivosCancelacion: (d.motivos_cancelacion ?? []).map((x: any) => ({
      motivo: String(x.motivo),
      total: num(x.total),
    })),
  };
};

// ---------------------------------------------------------------------
// Análisis de negocio: mezcla de servicios y comportamiento de clientes
// (supabase/migraciones/012).
// ---------------------------------------------------------------------
export interface NegocioTipo {
  tipo: string;
  total: number;
  anterior: number | null;
  ingresos: number;
  tarifaPromedio: number;
  cancelados: number;
  clientes: number;
  clientesNunca: number;
}

export interface Negocio {
  porTipo: NegocioTipo[];
  clientesTotal: number;
  clientesActivos: number;
  clientesNuevos: number;
  clientesRecurrentes: number;
  clientesUnPedido: number;
  clientesInactivos: number;
  clientesUnTipo: number;
}

export const obtenerNegocio = async (
  dias: PeriodoEstadisticas,
): Promise<Negocio> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("analisis_negocio", { p_dias: dias });
  if (error) {
    console.error("Error al cargar el análisis de negocio:", error);
    throw new Error(error.message || "No se pudo cargar el análisis de negocio.");
  }
  const d = (data ?? {}) as Record<string, any>;
  return {
    porTipo: (d.por_tipo ?? []).map((t: any) => ({
      tipo: String(t.tipo ?? "Sin tipo"),
      total: num(t.total),
      anterior: numONull(t.anterior),
      ingresos: num(t.ingresos),
      tarifaPromedio: num(t.tarifa_promedio),
      cancelados: num(t.cancelados),
      clientes: num(t.clientes),
      clientesNunca: num(t.clientes_nunca),
    })),
    clientesTotal: num(d.clientes_total),
    clientesActivos: num(d.clientes_activos),
    clientesNuevos: num(d.clientes_nuevos),
    clientesRecurrentes: num(d.clientes_recurrentes),
    clientesUnPedido: num(d.clientes_un_pedido),
    clientesInactivos: num(d.clientes_inactivos),
    clientesUnTipo: num(d.clientes_un_tipo),
  };
};
