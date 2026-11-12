// src/services/disponibilidadStore.ts
//
// Interruptor "Disponible" del conductor (como en Uber o InDrive). Mientras
// está disponible le llegan push de solicitudes nuevas aunque tenga la app
// cerrada. Se guarda en Supabase (perfiles.disponible) porque es el servidor
// quien decide a quién enviar cada push.
// Se apaga solo al pasar a modo usuario, al cerrar sesión y tras 12 h sin
// abrir la app (lo revisa la función registrar_actividad del servidor).
import { AppState } from "react-native";
import { useSyncExternalStore } from "react";

import { supabase } from "../lib/supabase";

type Estado = { disponible: boolean; cargado: boolean };

let estado: Estado = { disponible: false, cargado: false };
let uidActual: string | null = null;
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

/** Marca que la app se abrió y lee el estado (puede venir apagado por las 12 h). */
async function registrarActividad() {
  const uid = uidActual;
  if (!uid) return;
  const { data, error } = await supabase.rpc("registrar_actividad");
  if (uid !== uidActual) return;
  if (error) {
    console.warn("No se pudo registrar la actividad:", error);
    actualizar({ cargado: true });
    return;
  }
  actualizar({ disponible: !!data, cargado: true });
}

/** La llama sesionStore al entrar, salir o cambiar de cuenta. */
export function cargarDisponibilidad(uid: string | null) {
  if (uid === uidActual) return;
  uidActual = uid;
  actualizar({ disponible: false, cargado: !uid });
  if (uid) registrarActividad();
}

// Cada vez que la app vuelve a primer plano cuenta como actividad.
if (typeof window !== "undefined") {
  AppState.addEventListener("change", (nuevo) => {
    if (nuevo === "active") registrarActividad();
  });
}

/** Lanza un error con el mensaje del servidor si no se puede activar. */
export async function cambiarDisponibilidad(disponible: boolean) {
  const { error } = await supabase.rpc("cambiar_disponibilidad", {
    p_disponible: disponible,
  });
  if (error) throw new Error(error.message || "No se pudo cambiar tu disponibilidad.");
  actualizar({ disponible });
}

/** Apaga "Disponible" sin mostrar errores (modo usuario, cerrar sesión). */
export async function apagarDisponibilidad() {
  if (!estado.disponible) return;
  try {
    await cambiarDisponibilidad(false);
  } catch (error) {
    console.warn("No se pudo apagar la disponibilidad:", error);
  }
}

export function useDisponibilidad(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
