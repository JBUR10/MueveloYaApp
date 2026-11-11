// src/services/adminService.ts
//
// Panel de administración: revisar y aprobar/rechazar a los transportistas.
// La seguridad vive en la base de datos (supabase/migraciones/005): solo las
// cuentas de la tabla "administradores" pueden ver a todos y usar la función
// revisar_transportista. Aquí no se confía en nada del cliente.
import { asegurarSesion, supabase } from "../lib/supabase";
import {
  EstadoVerificacion,
  FilaVehiculo,
  Vehiculo,
  vehiculoDeFila,
} from "./vehiculoService";

export interface SolicitudTransportista {
  transportistaId: string;
  nombre: string;
  telefono: string;
  vehiculo: Vehiculo;
  actualizadoEl: string | null;
  revisadoEl: string | null;
}

/** true si la cuenta actual es administradora. */
export const soyAdmin = async (): Promise<boolean> => {
  try {
    await asegurarSesion();
    const { data, error } = await supabase.rpc("soy_admin");
    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error("Error comprobando si es administrador:", error);
    return false;
  }
};

/** Transportistas en el estado indicado (los pendientes, del más antiguo al más nuevo). */
export const obtenerTransportistas = async (
  estado: EstadoVerificacion,
): Promise<SolicitudTransportista[]> => {
  await asegurarSesion();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*, perfil:perfiles!transportista_id(nombre, telefono)")
    .eq("verificacion", estado)
    .order("actualizado_el", { ascending: estado === "pendiente" });

  if (error) {
    console.error("Error al cargar transportistas:", error);
    throw new Error("No se pudieron cargar los transportistas.");
  }

  return (data as any[]).map((f) => {
    const perfil = Array.isArray(f.perfil) ? f.perfil[0] : f.perfil;
    return {
      transportistaId: f.transportista_id,
      nombre: perfil?.nombre ?? "",
      telefono: perfil?.telefono ?? "",
      vehiculo: vehiculoDeFila(f as FilaVehiculo),
      actualizadoEl: f.actualizado_el ?? null,
      revisadoEl: f.revisado_el ?? null,
    };
  });
};

/** Aprueba o rechaza (con motivo) el perfil de un transportista. */
export const revisarTransportista = async (
  transportistaId: string,
  aprobar: boolean,
  motivo?: string,
) => {
  const { error } = await supabase.rpc("revisar_transportista", {
    p_transportista: transportistaId,
    p_aprobar: aprobar,
    p_motivo: motivo ?? null,
  });
  if (error) {
    console.error("Error al revisar transportista:", error);
    // Los mensajes de la función SQL ya vienen en español.
    throw new Error(error.message || "No se pudo guardar la revisión.");
  }
};
