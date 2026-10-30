import { asegurarSesion, supabase } from "../lib/supabase";

export interface SolicitudServicioDTO {
  id?: string;
  tipoServicio: string;
  origen: string;
  destino: string;
  /** Coordenadas exactas si el punto se marcó en el mapa. */
  origenCoords?: { lat: number; lng: number } | null;
  destinoCoords?: { lat: number; lng: number } | null;
  tipoProgramacion?: "inmediato" | "programado";
  fechaProgramada?: string;
  descripcion: string;
  ayudantes: number;
  pisosEscaleras: number;
  nombreContacto: string;
  telefonoContacto: string;
  fecha?: string;
}

// Fila tal como existe en la tabla (snake_case).
type FilaServicio = {
  id: string;
  tipo_servicio: string;
  origen: string;
  destino: string;
  origen_lat: number | null;
  origen_lng: number | null;
  destino_lat: number | null;
  destino_lng: number | null;
  tipo_programacion: "inmediato" | "programado" | null;
  fecha_programada: string | null;
  descripcion: string;
  ayudantes: number;
  pisos_escaleras: number;
  nombre_contacto: string;
  telefono_contacto: string;
  fecha: string;
};

const aCoords = (lat: number | null, lng: number | null) =>
  lat !== null && lng !== null ? { lat, lng } : null;

const deFila = (f: FilaServicio): SolicitudServicioDTO => ({
  id: f.id,
  tipoServicio: f.tipo_servicio,
  origen: f.origen,
  destino: f.destino,
  origenCoords: aCoords(f.origen_lat, f.origen_lng),
  destinoCoords: aCoords(f.destino_lat, f.destino_lng),
  tipoProgramacion: f.tipo_programacion ?? undefined,
  fechaProgramada: f.fecha_programada ?? undefined,
  descripcion: f.descripcion,
  ayudantes: f.ayudantes,
  pisosEscaleras: f.pisos_escaleras,
  nombreContacto: f.nombre_contacto,
  telefonoContacto: f.telefono_contacto,
  fecha: f.fecha,
});

// user_id no se envía: la columna lo toma de auth.uid() y RLS lo valida.
const aFila = (d: SolicitudServicioDTO) => ({
  tipo_servicio: d.tipoServicio,
  origen: d.origen,
  destino: d.destino,
  origen_lat: d.origenCoords?.lat ?? null,
  origen_lng: d.origenCoords?.lng ?? null,
  destino_lat: d.destinoCoords?.lat ?? null,
  destino_lng: d.destinoCoords?.lng ?? null,
  tipo_programacion: d.tipoProgramacion ?? null,
  fecha_programada: d.fechaProgramada ?? null,
  descripcion: d.descripcion,
  ayudantes: d.ayudantes,
  pisos_escaleras: d.pisosEscaleras,
  nombre_contacto: d.nombreContacto,
  telefono_contacto: d.telefonoContacto,
  fecha: d.fecha || new Date().toISOString(),
});

export const registrarServicio = async (
  datos: SolicitudServicioDTO,
  _token?: string,
) => {
  try {
    await asegurarSesion();

    const { data, error } = await supabase
      .from("servicios")
      .insert(aFila(datos))
      .select()
      .single();
    if (error) throw error;

    return {
      success: true,
      message: "Servicio registrado con éxito",
      data: deFila(data as FilaServicio),
    };
  } catch (error: any) {
    console.error("Error en servicioService (Supabase):", error);
    throw new Error("No se pudo guardar la solicitud. Revisa tu conexión.");
  }
};

export const obtenerMisServicios = async (
  _token?: string,
): Promise<SolicitudServicioDTO[]> => {
  try {
    await asegurarSesion();

    const { data, error } = await supabase
      .from("servicios")
      .select("*")
      .order("fecha", { ascending: false });
    if (error) throw error;

    return (data as FilaServicio[]).map(deFila);
  } catch (error: any) {
    console.error("Error al obtener servicios:", error);
    return [];
  }
};

export const eliminarServicio = async (id: string, _token?: string) => {
  try {
    await asegurarSesion();

    const { error } = await supabase.from("servicios").delete().eq("id", id);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar servicio:", error);
    throw new Error("No se pudo eliminar la solicitud.");
  }
};
