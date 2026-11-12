// src/services/notificacionesPush.ts
//
// Notificaciones push en Android (como WhatsApp o Instagram: llegan aunque
// la app esté cerrada). El servidor (Supabase) las envía con el servicio de
// Expo cuando se crea un aviso; aquí solo se registra el celular.
//  - Expo Go no recibe push en Android: hay que usar el APK.
//  - En web no hay push (ver notificacionesPush.web.ts).
//  - El interruptor "Notificaciones" del Perfil las apaga en este celular.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useSyncExternalStore } from "react";

import { supabase } from "../lib/supabase";

const CLAVE_ACTIVO = "@mueveloya_push_activo";
const CANAL = "default";

type Estado = {
  /** El celular puede recibir push (APK en Android, no Expo Go). */
  soportado: boolean;
  /** Preferencia del usuario en este celular (interruptor del Perfil). */
  activo: boolean;
  /** El sistema negó el permiso de notificaciones. */
  sinPermiso: boolean;
};

const soportado =
  Platform.OS === "android" &&
  Device.isDevice &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let estado: Estado = { soportado, activo: true, sinPermiso: false };
let tokenActual: string | null = null;
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

// Con la app abierta la notificación también se muestra (como en WhatsApp).
if (soportado) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Pide permiso y obtiene el token de Expo de este celular (null si no se puede). */
async function obtenerToken(pedirPermiso: boolean): Promise<string | null> {
  // En Android 13+ el permiso solo se puede pedir si ya existe un canal.
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: "Servicios",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2969e9",
  });

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && pedirPermiso) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") {
    actualizar({ sinPermiso: true });
    return null;
  }
  actualizar({ sinPermiso: false });

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** Se llama al iniciar sesión: registra este celular para la cuenta. */
export async function iniciarPush(uid: string | null) {
  if (!soportado || !uid) return;
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_ACTIVO);
    const activo = guardado !== "false";
    actualizar({ activo });

    // Si el usuario las apagó, no se le vuelve a pedir el permiso.
    const token = await obtenerToken(activo);
    if (!token) return;
    tokenActual = token;

    const { error } = await supabase.rpc("registrar_dispositivo", {
      p_token: token,
      p_activo: activo,
    });
    if (error) throw error;
  } catch (error) {
    // Sin google-services.json (Firebase) el token falla: la app sigue igual.
    console.warn("No se pudo activar las notificaciones push:", error);
  }
}

/** Interruptor del Perfil. Devuelve false si el sistema no dio permiso. */
export async function cambiarPushActivo(activo: boolean): Promise<boolean> {
  if (!soportado) return false;
  await AsyncStorage.setItem(CLAVE_ACTIVO, String(activo));
  actualizar({ activo });

  try {
    const token = tokenActual ?? (await obtenerToken(activo));
    if (!token) return !activo;
    tokenActual = token;
    const { error } = await supabase.rpc("registrar_dispositivo", {
      p_token: token,
      p_activo: activo,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("No se pudo cambiar las notificaciones:", error);
    return false;
  }
}

/** Antes de cerrar sesión: este celular deja de recibir push de la cuenta. */
export async function quitarDispositivoPush() {
  if (!soportado || !tokenActual) return;
  try {
    await supabase.rpc("quitar_dispositivo", { p_token: tokenActual });
  } catch (error) {
    console.warn("No se pudo quitar el dispositivo:", error);
  }
}

/** Al tocar una notificación, abre la pantalla que indica el servidor. */
export function escucharToquesNotificacion(abrir: (ruta: string) => void) {
  if (!soportado) return () => {};

  const alTocar = (respuesta: Notifications.NotificationResponse | null) => {
    const ruta = respuesta?.notification.request.content.data?.ruta;
    if (typeof ruta === "string" && ruta.startsWith("/")) abrir(ruta);
  };

  // La app estaba cerrada y se abrió tocando la notificación.
  Notifications.getLastNotificationResponseAsync()
    .then((respuesta) => {
      alTocar(respuesta);
      // Se borra para no volver a abrir esa pantalla en el siguiente inicio.
      if (respuesta) Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => {});

  const suscripcion = Notifications.addNotificationResponseReceivedListener(alTocar);
  return () => suscripcion.remove();
}

export function usePush(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
