// src/services/calificacionService.ts
// Calificaciones mutuas (cliente <-> transportista) y quejas.
import { supabase } from "../lib/supabase";
import { subirFotos } from "./evidenciasService";

export interface DatosCalificacion {
  /** Estrellas para la otra persona (transportista o cliente). */
  estrellas: number;
  /** Solo el cliente: estrellas para la app. */
  estrellasApp?: number | null;
  /** Solo el cliente: ¿recomendaría el servicio? */
  recomendaria?: boolean | null;
  comentario: string;
  tuvoProblema: boolean;
}

export const calificarServicio = async (
  servicioId: string,
  d: DatosCalificacion,
) => {
  const { error } = await supabase.rpc("calificar_servicio", {
    p_servicio: servicioId,
    p_estrellas: d.estrellas,
    p_estrellas_app: d.estrellasApp ?? null,
    p_recomendaria: d.recomendaria ?? null,
    p_comentario: d.comentario.trim(),
    p_tuvo_problema: d.tuvoProblema,
  });
  if (error) {
    console.error("Error al calificar:", error);
    throw new Error(error.message || "No se pudo enviar la calificación.");
  }
};

export const TIPOS_QUEJA = [
  "Daño o pérdida",
  "Retraso",
  "Cobro indebido",
  "Mal trato",
  "Otro",
] as const;

export const TIPO_QUEJA_DANO = "Daño o pérdida";
export const MAX_FOTOS_QUEJA = 5;

/**
 * Envía la queja con sus fotos (uris locales). Primero sube las fotos y
 * luego crea la queja en la base de datos (migración 019).
 */
export const enviarQueja = async (
  servicioId: string | null,
  tipo: string,
  descripcion: string,
  fotos: string[] = [],
) => {
  const rutas = await subirFotos(fotos, "quejas");
  const { error } = await supabase.rpc("crear_queja", {
    p_servicio: servicioId,
    p_tipo: tipo,
    p_descripcion: descripcion.trim(),
    p_fotos: rutas,
  });
  if (error) {
    console.error("Error al enviar la queja:", error);
    throw new Error(
      error.message?.includes("crear_queja")
        ? "Falta ejecutar la migración 019 en Supabase."
        : error.message || "No se pudo enviar la queja. Revisa tu conexión.",
    );
  }
};
