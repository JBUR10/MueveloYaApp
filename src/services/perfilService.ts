// src/services/perfilService.ts
import { asegurarSesion, supabase } from "../lib/supabase";

export interface Perfil {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  creadoEl: string;
}

export const obtenerMiPerfil = async (): Promise<Perfil | null> => {
  try {
    const uid = await asegurarSesion();
    const [{ data: usuario }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("perfiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    if (error) throw error;

    return {
      id: uid,
      nombre: data?.nombre ?? "",
      telefono: data?.telefono ?? "",
      correo: usuario.user?.email ?? "",
      creadoEl: data?.creado_el ?? usuario.user?.created_at ?? "",
    };
  } catch (error) {
    console.error("Error al obtener el perfil:", error);
    return null;
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
