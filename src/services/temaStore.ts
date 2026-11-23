// src/services/temaStore.ts
//
// Tema de la app (oscuro / claro). El OSCURO es el principal y el que se usa
// por defecto. La elección se guarda en el dispositivo (AsyncStorage) y se
// conserva al cerrar y abrir la app.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useSyncExternalStore } from "react";
import {
  Appearance,
  Platform,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import {
  PALETAS,
  type NombreTema,
  type Paleta,
} from "../constants/paleta";

export type { NombreTema, Paleta } from "../constants/paleta";

const CLAVE = "@mueveloya_tema";

type Estado = {
  tema: NombreTema;
  /** true cuando ya se leyó la preferencia guardada. */
  cargado: boolean;
};

let estado: Estado = { tema: "oscuro", cargado: false };
const oyentes = new Set<() => void>();

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Deja el navegador y los componentes nativos (alertas, selector de fecha,
 *  teclado) en el mismo tema que la app. */
function aplicarAlSistema(tema: NombreTema) {
  try {
    Appearance.setColorScheme(tema === "claro" ? "light" : "dark");
  } catch {}

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const raiz = document.documentElement;
    raiz.setAttribute("data-tema", tema);
    raiz.style.colorScheme = tema === "claro" ? "light" : "dark";
    document.body.style.backgroundColor = PALETAS[tema].fondo;
  }
}

function actualizar(parcial: Partial<Estado>) {
  const anterior = estado.tema;
  estado = { ...estado, ...parcial };
  if (estado.tema !== anterior) aplicarAlSistema(estado.tema);
  oyentes.forEach((oyente) => oyente());
}

// Lectura inicial. En el render estático de web no hay almacenamiento.
if (typeof window !== "undefined") {
  AsyncStorage.getItem(CLAVE)
    .then((guardado) => {
      const tema: NombreTema = guardado === "claro" ? "claro" : "oscuro";
      aplicarAlSistema(tema);
      actualizar({ tema, cargado: true });
    })
    .catch(() => actualizar({ cargado: true }));
} else {
  estado = { ...estado, cargado: true };
}

export const obtenerTema = () => estado.tema;

export async function cambiarTema(tema: NombreTema) {
  actualizar({ tema });
  try {
    await AsyncStorage.setItem(CLAVE, tema);
  } catch (error) {
    console.error("No se pudo guardar el tema:", error);
  }
}

export const alternarTema = () =>
  cambiarTema(estado.tema === "claro" ? "oscuro" : "claro");

/** Estado completo del tema (nombre + si ya se cargó lo guardado). */
export function useEstadoTema(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}

/** Nombre del tema activo: "oscuro" | "claro". */
export function useTema(): NombreTema {
  return useEstadoTema().tema;
}

/** Paleta de colores del tema activo. El componente se redibuja al cambiar. */
export function usePaleta(): Paleta {
  return PALETAS[useTema()];
}

type Fabrica<T> = (p: Paleta) => T;
/** Reemplaza a StyleSheet.NamedStyles, que RN 0.87+ ya no exporta. */
type EstilosNombrados = Record<string, ViewStyle | TextStyle | ImageStyle>;
const cache = new WeakMap<Fabrica<unknown>, Partial<Record<NombreTema, unknown>>>();

/**
 * Crea los estilos de un componente para el tema activo.
 *
 *   const styles = useEstilos(crearEstilos);
 *   ...
 *   const crearEstilos = (p: Paleta) => StyleSheet.create({ ... });
 *
 * Los estilos de cada tema se crean una sola vez y se reutilizan.
 */
export function useEstilos<T extends EstilosNombrados>(fabrica: Fabrica<T>): T {
  const tema = useTema();
  return useMemo(() => {
    let porTema = cache.get(fabrica as Fabrica<unknown>);
    if (!porTema) {
      porTema = {};
      cache.set(fabrica as Fabrica<unknown>, porTema);
    }
    if (!porTema[tema]) porTema[tema] = fabrica(PALETAS[tema]);
    return porTema[tema] as T;
  }, [fabrica, tema]);
}
