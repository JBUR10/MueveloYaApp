// src/services/evidenciasService.ts
// Fotos de evidencia: el cliente las adjunta a una queja y el transportista
// las toma al recoger los artículos. Se comprimen antes de subirlas al bucket
// privado "evidencias" de Supabase Storage (migración 019).
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { asegurarSesion, supabase } from "../lib/supabase";

const BUCKET = "evidencias";
/** Lado más largo de la foto ya comprimida (px). */
const LADO_MAXIMO = 1280;

/** Abre la cámara. Devuelve la uri de la foto o null si se canceló. */
export const tomarFoto = async (): Promise<string | null> => {
  if (Platform.OS !== "web") {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      throw new Error(
        "Necesitamos permiso para usar la cámara. Actívalo en los ajustes del teléfono.",
      );
    }
  }
  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
};

/** Abre la galería para elegir hasta `limite` fotos. */
export const elegirDeGaleria = async (limite: number): Promise<string[]> => {
  if (limite <= 0) return [];
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: limite,
    quality: 0.8,
  });
  return r.canceled ? [] : r.assets.slice(0, limite).map((a) => a.uri);
};

/** Reduce la foto (máx. 1280 px) y la guarda como JPEG comprimido. */
const comprimir = async (uri: string) => {
  const ctx = ImageManipulator.manipulate(uri);
  const original = await ctx.renderAsync();
  const horizontal = original.width >= original.height;
  const lado = Math.max(original.width, original.height);
  if (lado > LADO_MAXIMO) {
    ctx.resize(horizontal ? { width: LADO_MAXIMO, height: null } : { width: null, height: LADO_MAXIMO });
  }
  const imagen = lado > LADO_MAXIMO ? await ctx.renderAsync() : original;
  const res = await imagen.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return res.uri;
};

const nombreAleatorio = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

/**
 * Comprime y sube las fotos. Devuelve sus rutas dentro del bucket
 * (<uid>/<carpeta>/<archivo>.jpg), que luego se envían a la base de datos.
 */
export const subirFotos = async (
  uris: string[],
  carpeta: "quejas" | "recogidas",
): Promise<string[]> => {
  const uid = await asegurarSesion();
  const rutas: string[] = [];
  for (const uri of uris) {
    const comprimida = await comprimir(uri);
    const datos = await (await fetch(comprimida)).arrayBuffer();
    const ruta = `${uid}/${carpeta}/${nombreAleatorio()}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, datos, { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("Error al subir la foto:", error);
      throw new Error(
        error.message?.toLowerCase().includes("bucket")
          ? "Falta ejecutar la migración 019 en Supabase."
          : "No se pudo subir una foto. Revisa tu conexión e inténtalo de nuevo.",
      );
    }
    rutas.push(ruta);
  }
  return rutas;
};

/** Enlaces temporales (1 hora) para mostrar fotos del bucket privado. */
export const enlacesDeFotos = async (
  rutas: string[],
): Promise<Record<string, string>> => {
  if (!rutas.length) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rutas, 60 * 60);
  if (error) {
    console.error("Error al obtener las fotos:", error);
    return {};
  }
  const mapa: Record<string, string> = {};
  for (const f of data ?? []) {
    if (f.path && f.signedUrl) mapa[f.path] = f.signedUrl;
  }
  return mapa;
};
