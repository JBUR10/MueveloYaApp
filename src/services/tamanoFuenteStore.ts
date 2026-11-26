import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { useSyncExternalStore } from "react";

export type NivelTamanoFuente = "pequeno" | "normal" | "grande";
export type EstadoCargaTamanoFuente = "idle" | "loading" | "ready" | "error";

export const NIVELES_TAMANO_FUENTE: readonly {
  id: NivelTamanoFuente;
  nombre: string;
  porcentaje: number;
  factor: number;
}[] = [
  { id: "pequeno", nombre: "Pequeño", porcentaje: 90, factor: 0.9 },
  { id: "normal", nombre: "Normal", porcentaje: 100, factor: 1 },
  { id: "grande", nombre: "Grande", porcentaje: 110, factor: 1.1 },
];

type EstadoTamanoFuente = {
  uid: string | null;
  carga: EstadoCargaTamanoFuente;
  guardado: NivelTamanoFuente;
  borrador: NivelTamanoFuente;
  guardando: boolean;
  error: string | null;
};

const PREFIJO = "@mueveloya_tamano_fuente";
const INICIAL: EstadoTamanoFuente = {
  uid: null,
  carga: "idle",
  guardado: "normal",
  borrador: "normal",
  guardando: false,
  error: null,
};

let estado = INICIAL;
let generacion = 0;
let promesaGuardado: Promise<boolean> | null = null;
const oyentes = new Set<() => void>();
const oyentesFactor = new Set<() => void>();
const borradoresEnMemoria = new Map<string, NivelTamanoFuente>();

const factorDeNivel = (nivel: NivelTamanoFuente) =>
  NIVELES_TAMANO_FUENTE.find((opcion) => opcion.id === nivel)?.factor ?? 1;

function emitir() {
  oyentes.forEach((oyente) => oyente());
}

function emitirFactorSiCambio(anterior: NivelTamanoFuente) {
  if (factorDeNivel(anterior) === factorDeNivel(estado.borrador)) return;
  oyentesFactor.forEach((oyente) => oyente());
}

function actualizar(parcial: Partial<EstadoTamanoFuente>) {
  const nivelAnterior = estado.borrador;
  estado = { ...estado, ...parcial };
  emitir();
  emitirFactorSiCambio(nivelAnterior);
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function suscribirFactorTamanoFuente(oyente: () => void) {
  oyentesFactor.add(oyente);
  return () => oyentesFactor.delete(oyente);
}

export const obtenerFactorTamanoFuente = () =>
  factorDeNivel(estado.borrador);

export const obtenerEstadoTamanoFuente = () => estado;

const claveDeUsuario = (uid: string) =>
  `${PREFIJO}:${Platform.OS}:${uid}`;

function esNivelTamanoFuente(valor: string | null): valor is NivelTamanoFuente {
  return NIVELES_TAMANO_FUENTE.some((opcion) => opcion.id === valor);
}

export async function cargarTamanoFuente(uid: string | null, reintentar = false) {
  if (!reintentar && uid === estado.uid && estado.carga === "ready") return;
  if (!reintentar && uid === estado.uid && estado.carga === "loading") return;

  if (
    estado.uid &&
    estado.uid !== uid &&
    estado.carga === "ready" &&
    estado.borrador !== estado.guardado
  ) {
    borradoresEnMemoria.set(estado.uid, estado.borrador);
  }

  const solicitud = ++generacion;
  actualizar({
    uid,
    carga: uid ? "loading" : "ready",
    guardado: "normal",
    borrador: "normal",
    guardando: false,
    error: null,
  });

  if (!uid) return;

  try {
    const valor = await AsyncStorage.getItem(claveDeUsuario(uid));
    if (solicitud !== generacion || estado.uid !== uid) return;
    if (valor !== null && !esNivelTamanoFuente(valor)) {
      throw new Error("La preferencia de tamaño de fuente guardada no es válida.");
    }

    const nivel = valor ?? "normal";
    const borradorPendiente = borradoresEnMemoria.get(uid);
    borradoresEnMemoria.delete(uid);
    actualizar({
      carga: "ready",
      guardado: nivel,
      borrador: borradorPendiente ?? nivel,
      error: null,
    });
  } catch (error) {
    if (solicitud !== generacion || estado.uid !== uid) return;
    console.error("No se pudo cargar el tamaño de fuente:", error);
    actualizar({
      carga: "error",
      guardado: "normal",
      borrador: "normal",
      error: "No se pudo cargar el tamaño guardado. Inténtalo de nuevo.",
    });
  }
}

export function reintentarCargaTamanoFuente() {
  return cargarTamanoFuente(estado.uid, true);
}

export function cambiarBorradorTamanoFuente(nivel: NivelTamanoFuente) {
  if (estado.carga !== "ready" || estado.guardando) return;
  if (estado.uid) {
    if (nivel === estado.guardado) borradoresEnMemoria.delete(estado.uid);
    else borradoresEnMemoria.set(estado.uid, nivel);
  }
  actualizar({ borrador: nivel, error: null });
}

export function descartarBorradorTamanoFuente() {
  if (estado.carga !== "ready" || estado.guardando) return;
  if (estado.uid) borradoresEnMemoria.delete(estado.uid);
  actualizar({ borrador: estado.guardado, error: null });
}

export function guardarTamanoFuente(): Promise<boolean> {
  if (estado.guardando) return promesaGuardado ?? Promise.resolve(false);
  const { uid, carga, guardado, borrador } = estado;
  if (carga !== "ready" || !uid) return Promise.resolve(false);
  if (borrador === guardado) return Promise.resolve(true);

  const solicitud = generacion;
  actualizar({ guardando: true, error: null });

  let operacion: Promise<boolean>;
  operacion = Promise.resolve()
    .then(() => AsyncStorage.setItem(claveDeUsuario(uid), borrador))
    .then(() => {
      if (solicitud !== generacion || estado.uid !== uid) return false;
      borradoresEnMemoria.delete(uid);
      actualizar({ guardado: borrador, guardando: false, error: null });
      return true;
    })
    .catch((error) => {
      if (solicitud !== generacion || estado.uid !== uid) return false;
      console.error("No se pudo guardar el tamaño de fuente:", error);
      actualizar({
        guardando: false,
        error: "No se pudo guardar el tamaño. El borrador se conservó.",
      });
      return false;
    })
    .finally(() => {
      if (promesaGuardado === operacion) promesaGuardado = null;
    });
  promesaGuardado = operacion;
  return operacion;
}

export function useTamanoFuente(): EstadoTamanoFuente {
  return useSyncExternalStore(suscribir, () => estado, () => estado);
}

export function useClaveCargaTamanoFuente() {
  return useSyncExternalStore(
    suscribir,
    () => `${estado.uid ?? ""}:${estado.carga}`,
    () => `${estado.uid ?? ""}:${estado.carga}`,
  );
}
