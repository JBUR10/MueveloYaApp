// src/services/transportistaService.ts
//
// Estado de las solicitudes desde el punto de vista del transportista
// (aceptadas / canceladas). Se guarda aparte de las solicitudes del usuario
// para no modificar sus datos. Versión local hasta que exista la base de datos.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SolicitudServicioDTO } from "./servicioService";

export type EstadoTransportista = "aceptada" | "cancelada";

export interface RegistroTransportista {
  estado: EstadoTransportista;
  aceptadaEl: string;
  canceladaEl?: string;
}

export type RegistrosTransportista = Record<string, RegistroTransportista>;

const STORAGE_KEY = "@mueveloya_transportista_solicitudes";

/** Una solicitud aceptada solo se puede cancelar con al menos este margen. */
export const HORAS_MINIMAS_CANCELACION = 48;
const MS_MINIMOS_CANCELACION = HORAS_MINIMAS_CANCELACION * 60 * 60 * 1000;

const leerRegistros = async (): Promise<RegistrosTransportista> => {
  const str = await AsyncStorage.getItem(STORAGE_KEY);
  if (!str) return {};
  try {
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const guardarRegistros = (registros: RegistrosTransportista) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(registros));

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

export const obtenerRegistrosTransportista = async () => {
  try {
    return await leerRegistros();
  } catch (error) {
    console.error("Error al obtener registros del transportista:", error);
    return {};
  }
};

export const aceptarSolicitud = async (id: string) => {
  const registros = await leerRegistros();
  registros[id] = { estado: "aceptada", aceptadaEl: new Date().toISOString() };
  await guardarRegistros(registros);
  return registros;
};

export const cancelarSolicitud = async (item: SolicitudServicioDTO) => {
  const id = String(item.id);
  const registros = await leerRegistros();
  const registro = registros[id];

  if (!registro || registro.estado !== "aceptada") {
    throw new Error("Esta solicitud no está aceptada.");
  }
  if (!puedeCancelar(item)) {
    throw new Error(
      `No puedes cancelar con menos de ${HORAS_MINIMAS_CANCELACION} horas de anticipación.`,
    );
  }

  registros[id] = {
    ...registro,
    estado: "cancelada",
    canceladaEl: new Date().toISOString(),
  };
  await guardarRegistros(registros);
  return registros;
};
