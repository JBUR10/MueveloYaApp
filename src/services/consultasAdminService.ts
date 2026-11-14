// src/services/consultasAdminService.ts
//
// Catálogo de consultas Q01–Q10 sobre la tabla "servicios" para el panel de
// administrador. Cada consulta está escrita en SQL en la función
// consulta_admin de Supabase (migración 009), que solo responde a
// administradores. Aquí se define cómo se muestra cada resultado.
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
const COL_ESTADO: Columna = { clave: "estado", titulo: "Estado", formato: "estado" };
const COL_TOTAL: Columna = { clave: "total", titulo: "Total", formato: "numero" };

export const CONSULTAS: Consulta[] = [
  {
    codigo: "Q01",
    titulo: "Pendientes por tarifa",
    descripcion: "Servicios pendientes, de mayor a menor tarifa.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_TARIFA, COL_ESTADO],
  },
  {
    codigo: "Q02",
    titulo: "Mudanzas",
    descripcion: "Servicios de tipo Mudanza, de menor a mayor tarifa.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_DESTINO, COL_ESTADO, COL_TARIFA],
  },
  {
    codigo: "Q03",
    titulo: "En curso",
    descripcion: "Servicios que se están realizando ahora.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_TARIFA, COL_ESTADO],
  },
  {
    codigo: "Q04",
    titulo: "Por estado",
    descripcion: "Cantidad de servicios en cada estado.",
    tipo: "tabla",
    columnas: [COL_ESTADO, COL_TOTAL],
  },
  {
    codigo: "Q05",
    titulo: "Tarifa promedio",
    descripcion: "Promedio de la tarifa de todos los servicios.",
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
      COL_TARIFA,
      COL_ESTADO,
    ],
  },
  {
    codigo: "Q07",
    titulo: "Total de servicios",
    descripcion: "Cantidad de registros en la tabla de servicios.",
    tipo: "kpi",
    formatoKpi: "numero",
  },
  {
    codigo: "Q08",
    titulo: "Suma de tarifas",
    descripcion: "Valor total de todas las tarifas.",
    tipo: "kpi",
    formatoKpi: "pesos",
  },
  {
    codigo: "Q09",
    titulo: "Tarifa más alta",
    descripcion: "El servicio con la tarifa más alta.",
    tipo: "tabla",
    columnas: [COL_ID, COL_TIPO, COL_ORIGEN, COL_DESTINO, COL_TARIFA, COL_ESTADO],
  },
  {
    codigo: "Q10",
    titulo: "Por tipo",
    descripcion: "Cantidad de servicios de cada tipo.",
    tipo: "tabla",
    columnas: [COL_TIPO, COL_TOTAL],
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
