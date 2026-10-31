// src/services/vehiculoService.ts
//
// Vehículo del transportista y vigencia de sus documentos.
import { asegurarSesion, supabase } from "../lib/supabase";

export const TIPOS_VEHICULO = [
  "Motocarro",
  "Camioneta",
  "Furgón",
  "Camión",
] as const;

/** Con este margen (o menos) se avisa que un documento está por vencer. */
export const DIAS_AVISO_VENCIMIENTO = 30;

export interface Vehiculo {
  tipo: string;
  placa: string;
  marcaModelo: string;
  licenciaTransitoNumero: string;
  /** Fechas en formato AAAA-MM-DD. */
  soatVence: string;
  tecnomecanicaExento: boolean;
  tecnomecanicaVence: string | null;
  licenciaConduccionVence: string;
  seguroRcVence: string | null;
}

type FilaVehiculo = {
  tipo: string;
  placa: string;
  marca_modelo: string;
  licencia_transito_numero: string;
  soat_vence: string;
  tecnomecanica_exento: boolean;
  tecnomecanica_vence: string | null;
  licencia_conduccion_vence: string;
  seguro_rc_vence: string | null;
};

export const vehiculoDeFila = (f: FilaVehiculo): Vehiculo => ({
  tipo: f.tipo,
  placa: f.placa,
  marcaModelo: f.marca_modelo,
  licenciaTransitoNumero: f.licencia_transito_numero,
  soatVence: f.soat_vence,
  tecnomecanicaExento: f.tecnomecanica_exento,
  tecnomecanicaVence: f.tecnomecanica_vence,
  licenciaConduccionVence: f.licencia_conduccion_vence,
  seguroRcVence: f.seguro_rc_vence,
});

/** "2026-11-30" -> Date local a medianoche (sin corrimiento por zona horaria). */
export const fechaDeTexto = (texto: string | null | undefined) => {
  const m = texto?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const textoDeFecha = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const formatearFechaCorta = (texto: string | null | undefined) => {
  const d = fechaDeTexto(texto);
  return d
    ? d.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
};

/** SOAT y técnico-mecánica se expiden por un año: el vencimiento no puede
 *  pasar de hoy + 1 año (evita errores al digitar la fecha). */
export const fechaMaximaUnAnio = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

export const superaUnAnio = (texto: string | null | undefined) => {
  const fecha = fechaDeTexto(texto);
  return !!fecha && fecha.getTime() > fechaMaximaUnAnio().getTime();
};

export type EstadoDocumento = "vigente" | "por_vencer" | "vencido" | "falta";

/** Días que faltan para el vencimiento (negativo si ya venció). */
export const diasParaVencer = (texto: string | null | undefined) => {
  const fecha = fechaDeTexto(texto);
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
};

export const estadoDocumento = (
  texto: string | null | undefined,
): EstadoDocumento => {
  const dias = diasParaVencer(texto);
  if (dias === null) return "falta";
  if (dias < 0) return "vencido";
  if (dias <= DIAS_AVISO_VENCIMIENTO) return "por_vencer";
  return "vigente";
};

/** Revisa los documentos obligatorios. El seguro RC es opcional y no bloquea. */
export const revisarDocumentos = (v: Vehiculo) => {
  const obligatorios: { nombre: string; vence: string | null }[] = [
    { nombre: "SOAT", vence: v.soatVence },
    { nombre: "Licencia de conducción", vence: v.licenciaConduccionVence },
  ];
  if (!v.tecnomecanicaExento) {
    obligatorios.push({
      nombre: "Revisión técnico-mecánica",
      vence: v.tecnomecanicaVence,
    });
  }

  // "falta" cuenta como vencido: sin fecha no se puede validar.
  const vencidos = obligatorios
    .filter((d) => ["vencido", "falta"].includes(estadoDocumento(d.vence)))
    .map((d) => d.nombre);
  const porVencer = obligatorios
    .filter((d) => estadoDocumento(d.vence) === "por_vencer")
    .map((d) => d.nombre);

  return { vigentes: vencidos.length === 0, vencidos, porVencer };
};

export const obtenerMiVehiculo = async (): Promise<Vehiculo | null> => {
  const uid = await asegurarSesion();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("transportista_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ? vehiculoDeFila(data as FilaVehiculo) : null;
};

export const guardarMiVehiculo = async (v: Vehiculo) => {
  const uid = await asegurarSesion();
  const fila = {
    transportista_id: uid,
    tipo: v.tipo,
    placa: v.placa.trim().toUpperCase(),
    marca_modelo: v.marcaModelo.trim(),
    licencia_transito_numero: v.licenciaTransitoNumero.trim(),
    soat_vence: v.soatVence,
    tecnomecanica_exento: v.tecnomecanicaExento,
    tecnomecanica_vence: v.tecnomecanicaExento ? null : v.tecnomecanicaVence,
    licencia_conduccion_vence: v.licenciaConduccionVence,
    seguro_rc_vence: v.seguroRcVence,
    actualizado_el: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("vehiculos")
    .upsert(fila, { onConflict: "transportista_id" });
  if (error) {
    console.error("Error al guardar el vehículo:", error);
    // Los mensajes de validación de la base de datos ya vienen en español.
    throw new Error(
      error.message?.includes("no puede vencer")
        ? error.message
        : "No se pudo guardar el vehículo. Revisa tu conexión.",
    );
  }
};
