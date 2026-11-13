// src/services/estadisticasService.ts
//
// Estadísticas de pedidos para el panel de administrador. Todo el conteo lo
// hace la base de datos (supabase/migraciones/008): solo las cuentas de la
// tabla "administradores" pueden llamar a estadisticas_pedidos y la respuesta
// viene agregada, sin datos personales de los clientes.
import { asegurarSesion, supabase } from "../lib/supabase";

/** Últimos N días, o null para todo el historial. */
export type PeriodoEstadisticas = 7 | 30 | null;

export interface ConteoTipo {
  tipo: string;
  total: number;
}

export interface ConteoEstado {
  estado: string;
  total: number;
}

/** Cuadrícula de ~1,1 km con la cantidad de pedidos que salen de ella. */
export interface ZonaPedidos {
  lat: number;
  lng: number;
  total: number;
  /** Barrio más frecuente de la zona (puede venir vacío). */
  nombre: string | null;
}

export interface ConteoBarrio {
  nombre: string;
  total: number;
}

export interface Estadisticas {
  total: number;
  conUbicacion: number;
  porTipo: ConteoTipo[];
  porEstado: ConteoEstado[];
  zonas: ZonaPedidos[];
  barrios: ConteoBarrio[];
}

const numero = (v: unknown) => Number(v) || 0;

export const obtenerEstadisticas = async (
  dias: PeriodoEstadisticas,
): Promise<Estadisticas> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("estadisticas_pedidos", {
    p_dias: dias,
  });
  if (error) {
    console.error("Error al cargar las estadísticas:", error);
    // Los mensajes de la función SQL ya vienen en español.
    throw new Error(error.message || "No se pudieron cargar las estadísticas.");
  }

  const d = (data ?? {}) as Record<string, any>;
  return {
    total: numero(d.total),
    conUbicacion: numero(d.con_ubicacion),
    porTipo: (d.por_tipo ?? []).map((t: any) => ({
      tipo: String(t.tipo ?? "Sin tipo"),
      total: numero(t.total),
    })),
    porEstado: (d.por_estado ?? []).map((e: any) => ({
      estado: String(e.estado),
      total: numero(e.total),
    })),
    zonas: (d.zonas ?? []).map((z: any) => ({
      lat: numero(z.lat),
      lng: numero(z.lng),
      total: numero(z.total),
      nombre: z.nombre ?? null,
    })),
    barrios: (d.barrios ?? []).map((b: any) => ({
      nombre: String(b.nombre),
      total: numero(b.total),
    })),
  };
};
