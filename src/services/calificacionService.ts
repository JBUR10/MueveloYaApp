// src/services/calificacionService.ts
// Calificaciones mutuas (cliente <-> transportista) y quejas.
import { asegurarSesion, supabase } from "../lib/supabase";

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

export const enviarQueja = async (
  servicioId: string | null,
  tipo: string,
  descripcion: string,
) => {
  const uid = await asegurarSesion();
  const { error } = await supabase.from("quejas").insert({
    servicio_id: servicioId,
    autor_id: uid,
    tipo,
    descripcion: descripcion.trim(),
  });
  if (error) {
    console.error("Error al enviar la queja:", error);
    throw new Error("No se pudo enviar la queja. Revisa tu conexión.");
  }
};
