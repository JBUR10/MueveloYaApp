// src/services/ubicacionStore.ts
//
// Almacén en memoria para compartir ubicaciones entre pantallas
// (index/mapa y servicios) sin pasar datos por la URL.
// Se reinicia al cerrar la app (a propósito: un destino viejo no debe reaparecer).
import { useSyncExternalStore } from "react";

export type PuntoMapa = { lat: number; lng: number; nombre: string };

type Estado = {
  /** Ubicación actual del cliente (GPS). La guarda el index. */
  miUbicacion: PuntoMapa | null;
  /** Punto de recogida marcado a mano en el mapa. */
  origen: PuntoMapa | null;
  /** Destino marcado/buscado en el index. */
  destino: PuntoMapa | null;
};

let estado: Estado = { miUbicacion: null, origen: null, destino: null };
const oyentes = new Set<() => void>();

function actualizar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export const obtenerUbicaciones = () => estado;

export const guardarMiUbicacion = (punto: PuntoMapa | null) =>
  actualizar({ miUbicacion: punto });

export const guardarOrigen = (punto: PuntoMapa | null) =>
  actualizar({ origen: punto });

export const guardarDestino = (punto: PuntoMapa | null) =>
  actualizar({ destino: punto });

/** Hook reactivo: el componente se actualiza cuando cambia cualquier ubicación. */
export function useUbicaciones(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
