// src/services/modoStore.ts
//
// Modo de la app (usuario / transportista) y preferencias del transportista.
// Se guarda en AsyncStorage POR CUENTA: si en el mismo dispositivo entra otra
// persona, no hereda el modo de la anterior. Al cerrar y abrir la app se
// conserva el último modo elegido por esa cuenta.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { supabase } from "../lib/supabase";

export type Modo = "usuario" | "transportista";

type Estado = {
  modo: Modo;
  /** El transportista indica si cuenta con ayudantes para el servicio. */
  cuentaConAyudantes: boolean;
  /** true cuando ya se leyó lo guardado para la cuenta actual. */
  cargado: boolean;
};

const PREFIJO_MODO = "@mueveloya_modo";
const PREFIJO_AYUDANTES = "@mueveloya_transportista_ayudantes";

const INICIAL: Estado = {
  modo: "usuario",
  cuentaConAyudantes: false,
  cargado: false,
};

let estado: Estado = INICIAL;
/** Cuenta cuyo modo está cargado (null = sin sesión). */
let usuarioActual: string | null = null;
const oyentes = new Set<() => void>();

const claveModo = (uid: string) => `${PREFIJO_MODO}:${uid}`;
const claveAyudantes = (uid: string) => `${PREFIJO_AYUDANTES}:${uid}`;

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

/**
 * Carga el modo guardado de la cuenta. La llama sesionStore cada vez que
 * cambia la sesión (entrar, salir o cambiar de cuenta).
 */
export async function cargarModoDeUsuario(uid: string | null) {
  if (uid === usuarioActual && estado.cargado) return;
  usuarioActual = uid;

  // Mientras se lee, la cuenta nueva arranca como usuario (nunca hereda el modo).
  estado = { ...INICIAL, cargado: !uid };
  oyentes.forEach((oyente) => oyente());
  if (!uid) return;

  try {
    const [modo, ayudantes] = await Promise.all([
      AsyncStorage.getItem(claveModo(uid)),
      AsyncStorage.getItem(claveAyudantes(uid)),
    ]);
    // Sin preferencia guardada: quien tiene vehículo registrado es transportista.
    let modoInicial: Modo = modo === "transportista" ? "transportista" : "usuario";
    if (modo === null) {
      const { data } = await supabase
        .from("vehiculos")
        .select("transportista_id")
        .eq("transportista_id", uid)
        .maybeSingle();
      if (data) modoInicial = "transportista";
    }

    // Si mientras tanto cambió la cuenta, se descarta esta lectura.
    if (usuarioActual !== uid) return;
    actualizar({
      modo: modoInicial,
      cuentaConAyudantes: ayudantes === "true",
      cargado: true,
    });
  } catch {
    if (usuarioActual === uid) actualizar({ cargado: true });
  }
}

export const obtenerModo = () => estado;

export const cambiarModo = async (modo: Modo) => {
  actualizar({ modo });
  if (!usuarioActual) return;
  try {
    await AsyncStorage.setItem(claveModo(usuarioActual), modo);
  } catch (error) {
    console.error("No se pudo guardar el modo:", error);
  }
};

export const cambiarCuentaConAyudantes = async (valor: boolean) => {
  actualizar({ cuentaConAyudantes: valor });
  if (!usuarioActual) return;
  try {
    await AsyncStorage.setItem(claveAyudantes(usuarioActual), String(valor));
  } catch (error) {
    console.error("No se pudo guardar la opción de ayudantes:", error);
  }
};

/** Hook reactivo: el componente se actualiza cuando cambia el modo. */
export function useModo(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
