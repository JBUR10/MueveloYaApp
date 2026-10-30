// src/services/modoStore.ts
//
// Modo de la app (usuario / transportista) y preferencias del transportista.
// Se guarda en AsyncStorage para que, al cerrar y abrir la app, se conserve
// el último modo elegido. Cuando exista backend, solo se cambia este archivo.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export type Modo = "usuario" | "transportista";

type Estado = {
  modo: Modo;
  /** El transportista indica si cuenta con ayudantes para el servicio. */
  cuentaConAyudantes: boolean;
  /** true cuando ya se leyó lo guardado en el dispositivo. */
  cargado: boolean;
};

const CLAVE_MODO = "@mueveloya_modo";
const CLAVE_AYUDANTES = "@mueveloya_transportista_ayudantes";

let estado: Estado = {
  modo: "usuario",
  cuentaConAyudantes: false,
  cargado: false,
};
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

// Lee el último modo guardado al iniciar la app.
async function cargarGuardado() {
  try {
    const [modo, ayudantes] = await Promise.all([
      AsyncStorage.getItem(CLAVE_MODO),
      AsyncStorage.getItem(CLAVE_AYUDANTES),
    ]);
    actualizar({
      modo: modo === "transportista" ? "transportista" : "usuario",
      cuentaConAyudantes: ayudantes === "true",
      cargado: true,
    });
  } catch {
    actualizar({ cargado: true });
  }
}

// En el render estático de web no hay almacenamiento disponible.
if (typeof window !== "undefined") {
  cargarGuardado();
}

export const obtenerModo = () => estado;

export const cambiarModo = async (modo: Modo) => {
  actualizar({ modo });
  try {
    await AsyncStorage.setItem(CLAVE_MODO, modo);
  } catch (error) {
    console.error("No se pudo guardar el modo:", error);
  }
};

export const cambiarCuentaConAyudantes = async (valor: boolean) => {
  actualizar({ cuentaConAyudantes: valor });
  try {
    await AsyncStorage.setItem(CLAVE_AYUDANTES, String(valor));
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
