// src/services/consultasAdminService.ts
//
// Reportes de tarifas y servicios para la pestaña "Reportes" del panel de
// administrador. Cada reporte es una consulta SQL de la función
// consulta_admin de Supabase (migración 009), que solo responde a
// administradores; los códigos Q.. son internos. Total de servicios, por
// tipo y por estado no están aquí porque ya los muestra "Estadísticas".
import { supabase } from "../lib/supabase";

export type CodigoConsulta =
  | "Q01"
  | "Q02"
  | "Q03"
  | "Q04"
  | "Q05"
  | "Q06"
  | "Q07"
  | "Q08"
  | "Q09"
  | "Q10";

/** Cómo se muestra el valor de una columna. */
export type FormatoColumna = "texto" | "id" | "pesos" | "estado" | "numero" | "km";

export interface Columna {
  clave: string;
  titulo: string;
  formato?: FormatoColumna;
}

export interface Consulta {
  codigo: CodigoConsulta;
  titulo: string;
  descripcion: string;
  /** kpi = una sola métrica en tarjeta; tabla = filas. */
  tipo: "kpi" | "tabla";
  columnas?: Columna[];
  formatoKpi?: "pesos" | "numero";
}

const COL_ID: Columna = { clave: "id", titulo: "ID", formato: "id" };
const COL_TIPO: Columna = { clave: "tipo_servicio", titulo: "Tipo" };
const COL_ORIGEN: Columna = { clave: "origen", titulo: "Origen" };
const COL_DESTINO: Columna = { clave: "destino", titulo: "Destino" };
const COL_TARIFA: Columna = {
  clave: "tarifa_acordada",
  titulo: "Tarifa",
  formato: "pesos",
};
const COL_SUBTOTAL: Columna = {
  clave: "tarifa_base",
  titulo: "Subtotal",
  formato: "pesos",
};
const COL_DESCUENTO: Columna = {
  clave: "descuento",
  titulo: "Descuento",
  formato: "pesos",
};
const COL_RECARGO: Columna = {
  clave: "recargo_carga",
  titulo: "Carga especial",
  formato: "pesos",
};
const COL_ESTADO: Columna = { clave: "estado", titulo: "Estado", formato: "estado" };

/** Métricas en tarjeta (se cargan solas) y listados (con botón). */
export const CONSULTAS: Consulta[] = [
  {
    codigo: "Q01",
    titulo: "Pendientes por tarifa",
    descripcion: "Servicios pendientes, de mayor a menor tarifa.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_SUBTOTAL, COL_RECARGO, COL_DESCUENTO, COL_TARIFA, COL_ESTADO],
  },
  {
    codigo: "Q02",
    titulo: "Mudanzas",
    descripcion: "Servicios de tipo Mudanza, de menor a mayor tarifa.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_DESTINO, COL_SUBTOTAL, COL_RECARGO, COL_DESCUENTO, COL_ESTADO, COL_TARIFA],
  },
  {
    codigo: "Q03",
    titulo: "En curso",
    descripcion: "Servicios que se están realizando ahora.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_SUBTOTAL, COL_RECARGO, COL_DESCUENTO, COL_TARIFA, COL_ESTADO],
  },
  {
    codigo: "Q05",
    titulo: "Tarifa promedio",
    descripcion: "Promedio de las tarifas de todos los servicios.",
    tipo: "kpi",
    formatoKpi: "pesos",
  },
  {
    codigo: "Q06",
    titulo: "Más de 5 km",
    descripcion:
      "Servicios de más de 5 km de ruta (pagan km adicional), de mayor a menor tarifa.",
    tipo: "tabla",
    columnas: [
      COL_ID,
      COL_TIPO,
      COL_ORIGEN,
      COL_DESTINO,
      { clave: "distancia_km", titulo: "Km", formato: "km" },
      COL_SUBTOTAL,
      COL_RECARGO,
      COL_DESCUENTO,
      COL_TARIFA,
      COL_ESTADO,
    ],
  },
  {
    codigo: "Q08",
    titulo: "Valor total",
    descripcion: "Suma de las tarifas de todos los servicios.",
    tipo: "kpi",
    formatoKpi: "pesos",
  },
  {
    codigo: "Q09",
    titulo: "Servicio más caro",
    descripcion: "El servicio con la tarifa más alta.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_DESTINO, COL_SUBTOTAL, COL_RECARGO, COL_DESCUENTO, COL_TARIFA, COL_ESTADO],
  },
];

export type FilaConsulta = Record<string, unknown>;

/** Ejecuta una consulta. Lanza un error con mensaje en español si falla. */
export async function ejecutarConsulta(
  codigo: CodigoConsulta,
): Promise<FilaConsulta[]> {
  const { data, error } = await supabase.rpc("consulta_admin", {
    p_codigo: codigo,
  });
  if (error) {
    console.error(`Error en la consulta ${codigo}:`, error);
    throw new Error(
      error.message?.includes("consulta_admin")
        ? "Falta ejecutar la migración 009 en Supabase."
        : error.message || "No se pudo ejecutar la consulta.",
    );
  }
  return Array.isArray(data) ? (data as FilaConsulta[]) : [];
}
