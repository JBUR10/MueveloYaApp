// src/services/servicioService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const STORAGE_KEY = "@mueveloya_servicios_local";

const generarId = (extra = "") =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extra}`;

// Lee la lista y garantiza que todos los servicios tengan un id
const leerServicios = async (): Promise<SolicitudServicioDTO[]> => {
  const str = await AsyncStorage.getItem(STORAGE_KEY);
  if (!str) return [];

  let lista: SolicitudServicioDTO[] = [];
  try {
    const parsed = JSON.parse(str);
    lista = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  let huboCambios = false;
  const normalizada = lista.map((item, index) => {
    if (item.id === undefined || item.id === null || item.id === "") {
      huboCambios = true;
      return { ...item, id: generarId(`-${index}`) };
    }
    return { ...item, id: String(item.id) };
  });

  if (huboCambios) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizada));
  }
  return normalizada;
};

export const registrarServicio = async (
  datos: SolicitudServicioDTO,
  token: string,
) => {
  try {
    const serviciosActuales = await leerServicios();

    const nuevoServicio: SolicitudServicioDTO = {
      ...datos,
      id: generarId(),
      fecha: datos.fecha || new Date().toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([nuevoServicio, ...serviciosActuales]),
    );

    return {
      success: true,
      message: "Servicio registrado con éxito",
      data: nuevoServicio,
    };
  } catch (error: any) {
    console.error("Error en servicioService (local):", error);
    throw new Error("No se pudo guardar la solicitud localmente.");
  }
};

export const obtenerMisServicios = async (
  token: string,
): Promise<SolicitudServicioDTO[]> => {
  try {
    return await leerServicios();
  } catch (error: any) {
    console.error("Error al obtener servicios:", error);
    return [];
  }
};

export const eliminarServicio = async (id: string, token: string) => {
  try {
    const servicios = await leerServicios();
    const filtrados = servicios.filter(
      (item) => String(item.id) !== String(id),
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
    return { success: true };
  } catch (error: any) {
    console.error("Error al eliminar servicio:", error);
    throw new Error("No se pudo eliminar la solicitud.");
  }
};
