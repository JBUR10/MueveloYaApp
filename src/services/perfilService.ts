// src/services/perfilService.ts
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { asegurarSesion, supabase } from "../lib/supabase";

const BUCKET_FOTOS_PERFIL = "perfil";
const CARPETA_FOTOS_PERFIL = "foto_perfil";
const LADO_MAXIMO_FOTO = 512;

export interface Perfil {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  creadoEl: string;
  fotoUrl: string | null;
}

export const obtenerMiPerfil = async (): Promise<Perfil | null> => {
  try {
    const uid = await asegurarSesion();
    const [{ data: usuario }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("perfiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    if (error) throw error;

    let fotoUrl: string | null = null;
    if (data?.foto_perfil) {
      const { data: foto, error: errorFoto } = await supabase.storage
        .from(BUCKET_FOTOS_PERFIL)
        .createSignedUrl(data.foto_perfil, 60 * 60);
      if (errorFoto) {
        console.error("Error al obtener la foto de perfil:", errorFoto);
      } else {
        fotoUrl = foto.signedUrl;
      }
    }

    return {
      id: uid,
      nombre: data?.nombre ?? "",
      telefono: data?.telefono ?? "",
      correo: usuario.user?.email ?? "",
      creadoEl: data?.creado_el ?? usuario.user?.created_at ?? "",
      fotoUrl,
    };
  } catch (error) {
    console.error("Error al obtener el perfil:", error);
    return null;
  }
};

/** Sube la foto elegida y actualiza la ruta guardada en el perfil. */
export const subirFotoPerfil = async (uri: string): Promise<string> => {
  const uid = await asegurarSesion();
  const { data: perfilActual, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("foto_perfil")
    .eq("id", uid)
    .maybeSingle();

  if (errorPerfil) {
    console.error("Error al consultar la foto de perfil:", errorPerfil);
    throw new Error(
      "No se pudo acceder al perfil. Verifica que la migración 024 esté ejecutada.",
    );
  }
  if (!perfilActual) throw new Error("No encontramos tu perfil en Supabase.");

  let rutaNueva: string | null = null;
  try {
    const ctx = ImageManipulator.manipulate(uri);
    const imagenOriginal = await ctx.renderAsync();
    const horizontal = imagenOriginal.width >= imagenOriginal.height;
    const lado = Math.max(imagenOriginal.width, imagenOriginal.height);
    if (lado > LADO_MAXIMO_FOTO) {
      ctx.resize(
        horizontal
          ? { width: LADO_MAXIMO_FOTO, height: null }
          : { width: null, height: LADO_MAXIMO_FOTO },
      );
    }
    const imagen = lado > LADO_MAXIMO_FOTO
      ? await ctx.renderAsync()
      : imagenOriginal;
    const comprimida = await imagen.saveAsync({
      compress: 0.75,
      format: SaveFormat.JPEG,
    });
    const bytes = await (await fetch(comprimida.uri)).arrayBuffer();

    rutaNueva = `${CARPETA_FOTOS_PERFIL}/${uid}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_FOTOS_PERFIL)
      .upload(rutaNueva, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (errorSubida) throw errorSubida;

    const { data: foto, error: errorUrl } = await supabase.storage
      .from(BUCKET_FOTOS_PERFIL)
      .createSignedUrl(rutaNueva, 60 * 60);
    if (errorUrl) throw errorUrl;

    const { data: perfilActualizado, error: errorActualizacion } =
      await supabase
        .from("perfiles")
        .update({ foto_perfil: rutaNueva })
        .eq("id", uid)
        .select("id")
        .maybeSingle();
    if (errorActualizacion) throw errorActualizacion;
    if (!perfilActualizado) {
      throw new Error("No se pudo guardar la foto en tu perfil.");
    }

    const rutaAnterior = perfilActual.foto_perfil;
    if (
      rutaAnterior &&
      rutaAnterior !== rutaNueva &&
      rutaAnterior.startsWith(`${CARPETA_FOTOS_PERFIL}/${uid}/`)
    ) {
      const { error: errorBorrado } = await supabase.storage
        .from(BUCKET_FOTOS_PERFIL)
        .remove([rutaAnterior]);
      if (errorBorrado) {
        console.error("No se pudo borrar la foto de perfil anterior:", errorBorrado);
      }
    }

    return foto.signedUrl;
  } catch (error) {
    console.error("Error al cambiar la foto de perfil:", error);
    if (rutaNueva) {
      const { error: errorLimpieza } = await supabase.storage
        .from(BUCKET_FOTOS_PERFIL)
        .remove([rutaNueva]);
      if (errorLimpieza) {
        console.error("No se pudo limpiar la foto de perfil incompleta:", errorLimpieza);
      }
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42703"
    ) {
      throw new Error(
        "Falta ejecutar la migración 024 de fotos de perfil en Supabase.",
      );
    }
    throw new Error(
      "No se pudo subir la foto. Verifica que la migración 024 esté ejecutada y que Storage permita acceder al bucket perfil.",
    );
  }
};

/** Solicitudes hechas como cliente y servicios finalizados como transportista. */
export const obtenerResumen = async () => {
  try {
    const uid = await asegurarSesion();
    const [solicitudes, servicios] = await Promise.all([
      supabase
        .from("servicios")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      supabase
        .from("servicios")
        .select("id", { count: "exact", head: true })
        .eq("transportista_id", uid)
        .eq("estado", "completada"),
    ]);
    return {
      solicitudes: solicitudes.count ?? 0,
      servicios: servicios.count ?? 0,
    };
  } catch (error) {
    console.error("Error al obtener el resumen:", error);
    return { solicitudes: 0, servicios: 0 };
  }
};

/** "3 meses", "12 días", "Nuevo"... desde la fecha de registro. */
export const textoAntiguedad = (iso: string) => {
  const inicio = new Date(iso);
  if (isNaN(inicio.getTime())) return "—";
  const dias = Math.floor((Date.now() - inicio.getTime()) / 86_400_000);
  if (dias < 1) return "Nuevo";
  if (dias < 30) return `${dias} d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} m`;
  return `${Math.floor(meses / 12)} a`;
};
