// src/services/quejasAdminService.ts
// Revisión de quejas en el panel de administrador (migración 019): ver la
// queja con las fotos del cliente y las de la recogida, descartarla o
// confirmarla con una gravedad (la sanción la aplica la base de datos).
import { supabase } from "../lib/supabase";

export type Gravedad = "minima" | "baja" | "media" | "severa";

export const GRAVEDADES: { id: Gravedad; titulo: string; descripcion: string }[] = [
  { id: "minima", titulo: "Mínima", descripcion: "Rayones, golpes mínimos, peladuras" },
  { id: "baja", titulo: "Baja", descripcion: "Daño leve que se puede reparar" },
  { id: "media", titulo: "Media", descripcion: "Daño importante" },
  { id: "severa", titulo: "Muy severa", descripcion: "Pérdida o daño grave" },
];

export interface QuejaAdmin {
  id: number;
  tipo: string;
  descripcion: string;
  estado: "abierta" | "confirmada" | "descartada";
  gravedad: Gravedad | null;
  notaAdmin: string | null;
  creadaEl: string;
  resueltaEl: string | null;
  autorEsCliente: boolean;
  servicio: {
    id: string;
    tipoServicio: string;
    origen: string;
    destino: string;
    recogidaEl: string | null;
  } | null;
  cliente: { nombre: string; telefono: string };
  transportista: {
    id: string;
    nombre: string;
    telefono: string;
    advertencias: number;
    suspendido: boolean;
    definitiva: boolean;
    suspendidoHasta: string | null;
    condicionado: boolean;
  } | null;
  fotosCliente: string[];
  fotosRecogida: string[];
  sancion: {
    id: number;
    accion: "advertencia" | "suspension" | "definitiva";
    dias: number | null;
    terminaEl: string | null;
    anuladaEl: string | null;
    estabaCondicionado: boolean;
    esLaUltima: boolean;
  } | null;
}

const error019 = (e: { message?: string }) =>
  new Error(
    e.message?.includes("function") && e.message?.includes("does not exist")
      ? "Falta ejecutar la migración 019 en Supabase."
      : e.message || "No se pudo completar la acción.",
  );

export const obtenerQuejas = async (
  filtro: "abiertas" | "revisadas",
): Promise<QuejaAdmin[]> => {
  const { data, error } = await supabase.rpc("quejas_admin", { p_filtro: filtro });
  if (error) {
    console.error("Error al cargar quejas:", error);
    throw error019(error);
  }
  return ((data as any[]) ?? []).map((q) => ({
    id: q.id,
    tipo: q.tipo,
    descripcion: q.descripcion,
    estado: q.estado,
    gravedad: q.gravedad ?? null,
    notaAdmin: q.nota_admin ?? null,
    creadaEl: q.creada_el,
    resueltaEl: q.resuelta_el ?? null,
    autorEsCliente: !!q.autor_es_cliente,
    servicio: q.servicio
      ? {
          id: q.servicio.id,
          tipoServicio: q.servicio.tipo_servicio ?? "",
          origen: q.servicio.origen ?? "",
          destino: q.servicio.destino ?? "",
          recogidaEl: q.servicio.recogida_el ?? null,
        }
      : null,
    cliente: {
      nombre: q.cliente?.nombre ?? "",
      telefono: q.cliente?.telefono ?? "",
    },
    transportista: q.transportista
      ? {
          id: q.transportista.id,
          nombre: q.transportista.nombre ?? "",
          telefono: q.transportista.telefono ?? "",
          advertencias: Number(q.transportista.advertencias ?? 0),
          suspendido: !!q.transportista.suspendido,
          definitiva: !!q.transportista.definitiva,
          suspendidoHasta: q.transportista.suspendido_hasta ?? null,
          condicionado: !!q.transportista.condicionado,
        }
      : null,
    fotosCliente: q.fotos_cliente ?? [],
    fotosRecogida: q.fotos_recogida ?? [],
    sancion: q.sancion
      ? {
          id: q.sancion.id,
          accion: q.sancion.accion,
          dias: q.sancion.dias ?? null,
          terminaEl: q.sancion.termina_el ?? null,
          anuladaEl: q.sancion.anulada_el ?? null,
          estabaCondicionado: !!q.sancion.estaba_condicionado,
          esLaUltima: !!q.sancion.es_la_ultima,
        }
      : null,
  }));
};

/** gravedad null = descartar la queja. */
export const resolverQueja = async (
  id: number,
  gravedad: Gravedad | null,
  nota: string,
) => {
  const { error } = await supabase.rpc("resolver_queja", {
    p_queja: id,
    p_gravedad: gravedad,
    p_nota: nota.trim() || null,
  });
  if (error) {
    console.error("Error al resolver la queja:", error);
    throw error019(error);
  }
};

export const anularSancion = async (id: number, nota: string) => {
  const { error } = await supabase.rpc("anular_sancion", {
    p_sancion: id,
    p_nota: nota.trim() || null,
  });
  if (error) {
    console.error("Error al anular la sanción:", error);
    throw error019(error);
  }
};

/**
 * Qué sanción se aplicaría (misma regla que resolver_queja en la base de
 * datos), para mostrársela al admin antes de confirmar.
 */
export const sancionPrevista = (
  gravedad: Gravedad,
  t: NonNullable<QuejaAdmin["transportista"]>,
) => {
  if (t.definitiva) return "Ya tiene suspensión definitiva.";
  const base = { minima: 0, baja: 1, media: 2, severa: 3 }[gravedad];
  const nivel = t.condicionado ? Math.min(base + 1, 3) : base;
  const extra = nivel > base ? " (aumentada: su cuenta está condicionada)" : "";
  if (nivel === 0) {
    return t.advertencias + 1 >= 3
      ? "3.ª advertencia: suspensión de 5 días."
      : `Advertencia ${t.advertencias + 1} de 3.`;
  }
  if (nivel === 1) return `Suspensión de 1 semana${extra}.`;
  if (nivel === 2) return `Suspensión de 2 semanas${extra}.`;
  return `Suspensión definitiva${extra}.`;
};
