// src/services/servicioService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SolicitudServicioDTO {
  id?: string;
  tipoServicio: string;
  origen: string;
  destino: string;
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

export const registrarServicio = async (
  datos: SolicitudServicioDTO,
  token: string,
) => {
  try {
    // Simulamos una base de datos local guardando en AsyncStorage
    const serviciosActualesStr = await AsyncStorage.getItem(STORAGE_KEY);
    const serviciosActuales: SolicitudServicioDTO[] = serviciosActualesStr
      ? JSON.parse(serviciosActualesStr)
      : [];

    const nuevoServicio: SolicitudServicioDTO = {
      ...datos,
      id: Date.now().toString(),
      fecha: datos.fecha || new Date().toISOString(),
    };

    const serviciosActualizados = [nuevoServicio, ...serviciosActuales];
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serviciosActualizados),
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
    const serviciosStr = await AsyncStorage.getItem(STORAGE_KEY);
    if (!serviciosStr) return [];
    return JSON.parse(serviciosStr);
  } catch (error: any) {
    console.error("Error al obtener servicios:", error);
    return [];
  }
};
