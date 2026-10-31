// src/services/transportistaService.ts
//
// Flujo del transportista contra Supabase: solicitudes disponibles, las que
// tiene asignadas, su historial y los cambios de estado (aceptar, cancelar,
// recoger, finalizar). Los cambios se hacen con funciones RPC del servidor
// (ver supabase/migraciones/001_login_y_transportista.sql) para que dos
// transportistas no puedan tomar la misma solicitud.
import { asegurarSesion, supabase } from "../lib/supabase";
import {
  deFila,
  type FilaServicio,
  SELECT_CALIFICACIONES,
  SELECT_CLIENTE,
  SolicitudServicioDTO,
} from "./servicioService";

/** Una solicitud aceptada solo se puede cancelar con al menos este margen. */
export const HORAS_MINIMAS_CANCELACION = 48;
const MS_MINIMOS_CANCELACION = HORAS_MINIMAS_CANCELACION * 60 * 60 * 1000;

export interface Cancelacion {
  servicio: SolicitudServicioDTO;
  canceladaEl: string;
}

export interface DatosTransportista {
  /** Pendientes de otros clientes. */
  disponibles: SolicitudServicioDTO[];
  /** Aceptadas o en curso por mí. */
  asignadas: SolicitudServicioDTO[];
  /** Completadas por mí. */
  completadas: SolicitudServicioDTO[];
  /** Las que cancelé yo (volvieron a quedar pendientes). */
  cancelaciones: Cancelacion[];
  /** Las que canceló el cliente después de que yo las aceptara. */
  canceladasPorCliente: SolicitudServicioDTO[];
}

/** true si el servicio ya arrancó: inmediato aceptado o programado iniciado. */
export const estaIniciado = (item: SolicitudServicioDTO) =>
  !!item.iniciadaEl || item.estado === "en_curso";

export const esInmediato = (item: SolicitudServicioDTO) =>
  item.tipoProgramacion === "inmediato" ||
  item.fechaProgramada === "Inmediato" ||
  !item.fechaProgramada;

/**
 * Fecha en que se presta el servicio.
 * Programado: "dd/mm/aaaa hh:mm AM|PM" (formato de servicios.tsx).
 * Inmediato: la fecha en que se creó la solicitud.
 */
export const fechaDelServicio = (item: SolicitudServicioDTO): Date | null => {
  if (esInmediato(item)) {
    const d = item.fecha ? new Date(item.fecha) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }

  const coincide = item.fechaProgramada?.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (!coincide) return null;

  const [, dia, mes, anio, hora, minutos, ampm] = coincide;
  let horas = Number(hora) % 12;
  if (ampm.toUpperCase() === "PM") horas += 12;

  const d = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    horas,
    Number(minutos),
  );
  return isNaN(d.getTime()) ? null : d;
};

/** Se puede cancelar solo si faltan 48 h o más para el servicio. */
export const puedeCancelar = (
  item: SolicitudServicioDTO,
  ahora: Date = new Date(),
) => {
  const fecha = fechaDelServicio(item);
  if (!fecha) return false;
  return fecha.getTime() - ahora.getTime() >= MS_MINIMOS_CANCELACION;
};

export const obtenerDatosTransportista =
  async (): Promise<DatosTransportista> => {
    const uid = await asegurarSesion();

    const [pendientes, mias, canceladas] = await Promise.all([
      supabase
        .from("servicios")
        .select(`*, ${SELECT_CLIENTE}`)
        .eq("estado", "pendiente")
        .neq("user_id", uid)
        .order("fecha", { ascending: false }),
      supabase
        .from("servicios")
        .select(`*, ${SELECT_CLIENTE}, ${SELECT_CALIFICACIONES}`)
        .eq("transportista_id", uid)
        .order("aceptada_el", { ascending: false }),
      supabase
        .from("cancelaciones")
        .select("cancelada_el, servicio:servicios(*)")
        .eq("transportista_id", uid)
        .order("cancelada_el", { ascending: false }),
    ]);

    const error = pendientes.error || mias.error || canceladas.error;
    if (error) {
      console.error("Error al cargar datos del transportista:", error);
      throw new Error("No se pudieron cargar las solicitudes.");
    }

    const propias = (mias.data as FilaServicio[]).map(deFila);

    return {
      disponibles: (pendientes.data as FilaServicio[]).map(deFila),
      asignadas: propias.filter(
        (s) => s.estado === "aceptada" || s.estado === "en_curso",
      ),
      completadas: propias.filter((s) => s.estado === "completada"),
      canceladasPorCliente: propias.filter((s) => s.estado === "cancelada"),
      cancelaciones: (canceladas.data as any[])
        // Si la solicitud ya no es visible (la tomó otro), no se puede mostrar.
        .filter((c) => c.servicio)
        .map((c) => ({
          servicio: deFila(
            Array.isArray(c.servicio) ? c.servicio[0] : c.servicio,
          ),
          canceladaEl: c.cancelada_el,
        })),
    };
  };

const llamar = async (funcion: string, id: string) => {
  const { data, error } = await supabase.rpc(funcion, { p_servicio: id });
  if (error) {
    console.error(`Error en ${funcion}:`, error);
    // Los mensajes de las funciones SQL ya vienen en español.
    throw new Error(error.message || "No se pudo completar la acción.");
  }
  return deFila(data as FilaServicio);
};

export const aceptarSolicitud = (id: string) => llamar("aceptar_servicio", id);

export const cancelarSolicitud = (item: SolicitudServicioDTO) => {
  if (!puedeCancelar(item)) {
    return Promise.reject(
      new Error(
        `No puedes cancelar con menos de ${HORAS_MINIMAS_CANCELACION} horas de anticipación.`,
      ),
    );
  }
  return llamar("cancelar_servicio", String(item.id));
};

/** Programados: el conductor sale hacia el punto de recogida. */
export const iniciarServicio = (id: string) => llamar("iniciar_servicio", id);

export const marcarRecogido = (id: string) => llamar("marcar_recogido", id);

export const completarServicio = (id: string) =>
  llamar("completar_servicio", id);
