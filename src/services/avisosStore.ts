// src/services/avisosStore.ts
//
// Avisos dentro de la app: el contador de "no leídos" de la pestaña
// Solicitudes y las alertas que se muestran al abrirla.
//  - noLeidas: notificaciones nuevas (aceptada, cancelada, iniciada, finalizada...).
//  - proximos: servicios programados que empiezan en las próximas 24 h.
//  - nuevasDisponibles: (conductor) solicitudes nuevas desde la última visita.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { aviso, TipoAlerta } from "../components/ui/AlertaPantalla";
import { supabase } from "../lib/supabase";
import { deFila, type FilaServicio } from "./servicioService";
import { fechaDelServicio } from "./transportistaService";

type Estado = { noLeidas: number; proximos: number; nuevasDisponibles: number };

const VACIO: Estado = { noLeidas: 0, proximos: 0, nuevasDisponibles: 0 };
const HORAS_RECORDATORIO = 24;
const RECARGA_MS = 60_000;
const claveVista = (uid: string) => `@mueveloya_disponibles_vistas:${uid}`;

let estado: Estado = VACIO;
let uidActual: string | null = null;
let detener: (() => void) | null = null;
const oyentes = new Set<() => void>();

function actualizar(nuevo: Estado) {
  estado = nuevo;
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export async function refrescarAvisos() {
  const uid = uidActual;
  if (!uid) return actualizar(VACIO);

  try {
    // Última vez que el conductor abrió el panel (la primera vez cuenta desde ahora).
    let vista = await AsyncStorage.getItem(claveVista(uid));
    if (!vista) {
      vista = new Date().toISOString();
      await AsyncStorage.setItem(claveVista(uid), vista);
    }

    const [noLeidas, programados, nuevas] = await Promise.all([
      supabase
        .from("notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", uid)
        .eq("leida", false),
      supabase
        .from("servicios")
        .select("*")
        .eq("estado", "aceptada")
        .eq("tipo_programacion", "programado")
        .is("iniciada_el", null)
        .or(`user_id.eq.${uid},transportista_id.eq.${uid}`),
      // RLS solo deja ver pendientes a conductores con documentos vigentes.
      supabase
        .from("servicios")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente")
        .neq("user_id", uid)
        .gt("fecha", vista),
    ]);

    if (uid !== uidActual) return;

    const ahora = Date.now();
    const limite = ahora + HORAS_RECORDATORIO * 3_600_000;
    const proximos = ((programados.data ?? []) as FilaServicio[])
      .map(deFila)
      .filter((s) => {
        const t = fechaDelServicio(s)?.getTime();
        return t != null && t >= ahora && t <= limite;
      }).length;

    actualizar({
      noLeidas: noLeidas.count ?? 0,
      proximos,
      nuevasDisponibles: nuevas.count ?? 0,
    });
  } catch (error) {
    console.error("Error al cargar los avisos:", error);
  }
}

/** Al abrir el panel del conductor, las disponibles dejan de contarse como nuevas. */
export async function marcarDisponiblesVistas() {
  if (!uidActual) return;
  await AsyncStorage.setItem(claveVista(uidActual), new Date().toISOString());
  refrescarAvisos();
}

/** La llama sesionStore al entrar, salir o cambiar de cuenta. */
export function iniciarAvisos(uid: string | null) {
  if (uid === uidActual) return;
  detener?.();
  detener = null;
  uidActual = uid;
  actualizar(VACIO);
  if (!uid) return;

  refrescarAvisos();

  let espera: ReturnType<typeof setTimeout> | null = null;
  const programar = () => {
    if (espera) clearTimeout(espera);
    espera = setTimeout(refrescarAvisos, 500);
  };

  const canal = supabase
    .channel(`avisos-${uid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notificaciones",
        filter: `usuario_id=eq.${uid}`,
      },
      programar,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "servicios" },
      programar,
    )
    .subscribe();

  // El recordatorio de 24 h depende de la hora: se recalcula cada minuto.
  const intervalo = setInterval(refrescarAvisos, RECARGA_MS);

  detener = () => {
    if (espera) clearTimeout(espera);
    clearInterval(intervalo);
    supabase.removeChannel(canal);
  };
}

const TIPO_ALERTA: Record<string, TipoAlerta> = {
  cancelada_conductor: "error",
  cancelada_cliente: "error",
  completada: "exito",
  aceptada: "exito",
};

let mostrando = false;

/**
 * Muestra en pantalla las notificaciones no leídas, una tras otra, y las
 * marca como leídas. Si una es "servicio finalizado", llama a alCompletar
 * con el id del servicio (para abrir la calificación).
 */
export async function mostrarAvisosPendientes(
  alCompletar?: (servicioId: string) => void,
) {
  const uid = uidActual;
  if (!uid || mostrando) return;
  mostrando = true;

  try {
    const { data, error } = await supabase
      .from("notificaciones")
      .select("id, servicio_id, tipo, titulo, mensaje")
      .eq("usuario_id", uid)
      .eq("leida", false)
      .order("creada_el", { ascending: true });
    if (error || !data?.length) return;

    // Se marcan antes de mostrarlas para no repetirlas si se cambia de pantalla.
    await supabase
      .from("notificaciones")
      .update({ leida: true })
      .in(
        "id",
        data.map((n) => n.id),
      );
    refrescarAvisos();

    for (const n of data) {
      await aviso(n.titulo, n.mensaje, TIPO_ALERTA[n.tipo] ?? "info");
      if (n.tipo === "completada" && n.servicio_id) alCompletar?.(n.servicio_id);
    }
  } catch (error) {
    console.error("Error al mostrar los avisos:", error);
  } finally {
    mostrando = false;
  }
}

export function useAvisos(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
