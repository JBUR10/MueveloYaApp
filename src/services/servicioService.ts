import { asegurarSesion, supabase } from "../lib/supabase";

export type EstadoServicio =
  | "pendiente"
  | "aceptada"
  | "en_curso"
  | "completada"
  | "cancelada";

export interface Calificacion {
  promedio: number | null;
  total: number;
}

export interface TransportistaAsignado {
  nombre: string;
  telefono: string;
  vehiculo: { tipo: string; placa: string; marcaModelo: string } | null;
  calificacion: Calificacion;
}

/** Datos públicos del cliente que ve el transportista. */
export interface ClienteServicio {
  nombre: string;
  calificacion: Calificacion;
}

/** Relaciones que se piden junto con cada servicio. */
export const SELECT_TRANSPORTISTA =
  "transportista:perfiles!transportista_id(nombre, telefono, calificacion_promedio, calificaciones_total, vehiculos(tipo, placa, marca_modelo))";
export const SELECT_CLIENTE =
  "cliente:perfiles!user_id(nombre, calificacion_promedio, calificaciones_total)";
export const SELECT_CALIFICACIONES = "calificaciones(autor_id)";

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
  estado?: EstadoServicio;
  userId?: string;
  transportistaId?: string | null;
  aceptadaEl?: string | null;
  recogidaEl?: string | null;
  completadaEl?: string | null;
  /** Programados: cuándo el conductor lo inició. Inmediatos: al aceptar. */
  iniciadaEl?: string | null;
  canceladaEl?: string | null;
  canceladaPor?: string | null;
  /** Solo se llena en las solicitudes del cliente (obtenerMisServicios). */
  transportista?: TransportistaAsignado | null;
  /** Solo se llena en las consultas del transportista. */
  cliente?: ClienteServicio | null;
  /** Ids de quienes ya calificaron este servicio. */
  calificadoPor?: string[];
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
  estado?: EstadoServicio | null;
  user_id?: string;
  transportista_id?: string | null;
  aceptada_el?: string | null;
  recogida_el?: string | null;
  completada_el?: string | null;
  iniciada_el?: string | null;
  cancelada_el?: string | null;
  cancelada_por?: string | null;
  transportista?: FilaTransportista | FilaTransportista[] | null;
  cliente?: FilaCliente | FilaCliente[] | null;
  calificaciones?: { autor_id: string }[] | null;
};

type FilaCalificacion = {
  calificacion_promedio?: number | string | null;
  calificaciones_total?: number | null;
};

type FilaTransportista = FilaCalificacion & {
  nombre: string;
  telefono: string;
  vehiculos?: FilaVehiculoCorta | FilaVehiculoCorta[] | null;
};

type FilaCliente = FilaCalificacion & { nombre: string };

const calificacionDeFila = (f: FilaCalificacion): Calificacion => ({
  promedio:
    f.calificacion_promedio == null ? null : Number(f.calificacion_promedio),
  total: f.calificaciones_total ?? 0,
});

type FilaVehiculoCorta = { tipo: string; placa: string; marca_modelo: string };

// PostgREST devuelve objeto o arreglo según detecte la relación.
const uno = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const transportistaDeFila = (
  f: FilaTransportista | null,
): TransportistaAsignado | null => {
  if (!f) return null;
  const v = uno(f.vehiculos);
  return {
    nombre: f.nombre,
    telefono: f.telefono,
    vehiculo: v
      ? { tipo: v.tipo, placa: v.placa, marcaModelo: v.marca_modelo }
      : null,
    calificacion: calificacionDeFila(f),
  };
};

const aCoords = (lat: number | null, lng: number | null) =>
  lat !== null && lng !== null ? { lat, lng } : null;

export const deFila = (f: FilaServicio): SolicitudServicioDTO => ({
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
  estado: f.estado ?? "pendiente",
  userId: f.user_id,
  transportistaId: f.transportista_id ?? null,
  aceptadaEl: f.aceptada_el ?? null,
  recogidaEl: f.recogida_el ?? null,
  completadaEl: f.completada_el ?? null,
  iniciadaEl: f.iniciada_el ?? null,
  canceladaEl: f.cancelada_el ?? null,
  canceladaPor: f.cancelada_por ?? null,
  transportista: transportistaDeFila(uno(f.transportista)),
  cliente: (() => {
    const c = uno(f.cliente);
    return c ? { nombre: c.nombre, calificacion: calificacionDeFila(c) } : null;
  })(),
  calificadoPor: (f.calificaciones ?? []).map((c) => c.autor_id),
});

/** Texto corto de una calificación: "★ 4.8 (12)" o "Sin calificaciones". */
export const textoCalificacion = (c?: Calificacion | null) =>
  c?.promedio != null
    ? `★ ${c.promedio.toFixed(1)} (${c.total})`
    : "Sin calificaciones";

export type { FilaServicio };

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
    const uid = await asegurarSesion();

    // Filtro explícito: un transportista también puede leer solicitudes ajenas.
    const { data, error } = await supabase
      .from("servicios")
      .select(`*, ${SELECT_TRANSPORTISTA}, ${SELECT_CALIFICACIONES}`)
      .eq("user_id", uid)
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

    const { data, error } = await supabase
      .from("servicios")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw error;
    // RLS solo deja borrar pendientes: si no borró nada, ya fue tomada.
    if (!data?.length) {
      throw new Error(
        "Un transportista ya aceptó esta solicitud, por eso no se puede eliminar.",
      );
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar servicio:", error);
    throw new Error(
      error?.message?.startsWith("Un transportista")
        ? error.message
        : "No se pudo eliminar la solicitud.",
    );
  }
};

/**
 * Avisa cada vez que cambia algo en la tabla de servicios (crear, aceptar,
 * cancelar...). Supabase solo entrega los cambios que el usuario puede ver.
 * Devuelve la función para dejar de escuchar.
 */
export const escucharCambiosServicios = (alCambiar: () => void) => {
  const canal = supabase
    .channel(`servicios-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "servicios" },
      () => alCambiar(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
};

/** El cliente cancela un servicio ya aceptado (mínimo 48 h antes y sin iniciar). */
export const cancelarServicioCliente = async (id: string) => {
  const { error } = await supabase.rpc("cancelar_servicio_cliente", {
    p_servicio: id,
  });
  if (error) {
    console.error("Error al cancelar el servicio:", error);
    throw new Error(error.message || "No se pudo cancelar el servicio.");
  }
};
