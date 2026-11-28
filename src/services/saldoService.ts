// src/services/saldoService.ts
//
// Saldo del transportista y comisión de la app.
//  - La comisión es del 5 % de la tarifa final de cada pedido.
//  - El saldo SOLO cambia cuando el servicio se finaliza (lo hace la función
//    SQL completar_servicio, migración 025); aquí únicamente se lee.
//  - Tarjeta: la app cobró al cliente -> el saldo sube (tarifa - comisión).
//  - Efectivo: el conductor cobró todo en mano -> el saldo baja (comisión).
import { asegurarSesion, supabase } from "../lib/supabase";
import type {
  MetodoPagoServicio,
  SolicitudServicioDTO,
} from "./servicioService";
import { formatearPesos } from "./tarifa";

/** Debe coincidir con comision_app_porcentaje() de la migración 025. */
export const COMISION_PORCENTAJE = 5;

export const calcularComision = (tarifa: number | null | undefined) =>
  Math.round(((tarifa ?? 0) * COMISION_PORCENTAJE) / 100);

export const calcularNeto = (tarifa: number | null | undefined) =>
  Math.max(tarifa ?? 0, 0) - calcularComision(tarifa);

export const textoMetodoPago = (m?: MetodoPagoServicio | null) =>
  m === "efectivo" ? "Efectivo" : "Tarjeta (pagado en la app)";

/** Con signo: -$ 1.000 en lugar de $ -1.000. */
export const formatearSaldo = (valor: number | null | undefined) =>
  valor != null && valor < 0
    ? `-${formatearPesos(-valor)}`
    : formatearPesos(valor);

/**
 * Texto para el aviso antes de aceptar: método de pago, comisión y lo que
 * realmente le queda al conductor.
 */
export const textoAvisoComision = (item: SolicitudServicioDTO) => {
  const tarifa = item.tarifaAcordada ?? 0;
  const comision = calcularComision(tarifa);
  const efectivo = item.metodoPago === "efectivo";
  const detalle = efectivo
    ? "Cobras el valor total en efectivo al cliente y la comisión se descuenta de tu saldo al finalizar el servicio."
    : "El cliente ya pagó en la app. Tu saldo se actualiza cuando finalices el servicio.";
  return (
    `Método de pago: ${textoMetodoPago(item.metodoPago)}.\n` +
    `Tarifa: ${formatearPesos(tarifa)}\n` +
    `Comisión de la app (${COMISION_PORCENTAJE}%): -${formatearPesos(comision)}\n` +
    `Tu ganancia neta: ${formatearPesos(tarifa - comision)}\n` +
    detalle
  );
};

/** Recordatorio al finalizar (en efectivo: cobrar al cliente). */
export const textoAvisoFinalizar = (item: SolicitudServicioDTO) => {
  const tarifa = item.tarifaAcordada ?? 0;
  const comision = calcularComision(tarifa);
  return item.metodoPago === "efectivo"
    ? `\n\nRecuerda cobrar ${formatearPesos(tarifa)} en efectivo al cliente. Al finalizar se descontará la comisión (${formatearPesos(comision)}) de tu saldo.`
    : `\n\nAl finalizar, tu saldo aumentará en ${formatearPesos(tarifa - comision)}.`;
};

export interface ResumenSaldo {
  saldo: number;
  gananciasNetas: number;
  comisiones: number;
  servicios: number;
  saldoTarjeta: number;
  saldoEfectivo: number;
  porcentaje: number;
}

export interface MovimientoSaldo {
  id: string;
  servicioId: string | null;
  tipo: "servicio" | "reversion";
  metodoPago: MetodoPagoServicio;
  tipoServicio: string;
  montoBruto: number;
  comision: number;
  neto: number;
  saldoDelta: number;
  creadoEl: string;
}

const migracionFaltante = (error: any) =>
  error?.code === "PGRST202" ||
  error?.code === "42883" ||
  error?.code === "42P01" ||
  error?.code === "PGRST205";

export const obtenerMiSaldo = async (): Promise<ResumenSaldo> => {
  await asegurarSesion();
  const { data, error } = await supabase.rpc("mi_saldo_transportista");
  if (error) {
    console.error("Error al leer el saldo:", error);
    throw new Error(
      migracionFaltante(error)
        ? "Falta ejecutar la migración 025 en Supabase."
        : "No se pudo cargar tu saldo.",
    );
  }
  const d = (data ?? {}) as Record<string, any>;
  return {
    saldo: Number(d.saldo ?? 0),
    gananciasNetas: Number(d.ganancias_netas ?? 0),
    comisiones: Number(d.comisiones ?? 0),
    servicios: Number(d.servicios ?? 0),
    saldoTarjeta: Number(d.saldo_tarjeta ?? 0),
    saldoEfectivo: Number(d.saldo_efectivo ?? 0),
    porcentaje: Number(d.porcentaje ?? COMISION_PORCENTAJE),
  };
};

export const obtenerMisMovimientos = async (
  limite = 10,
): Promise<MovimientoSaldo[]> => {
  const uid = await asegurarSesion();
  const { data, error } = await supabase
    .from("transportista_movimientos")
    .select(
      "id, servicio_id, tipo, metodo_pago, tipo_servicio, monto_bruto, comision, neto, saldo_delta, creado_el",
    )
    .eq("transportista_id", uid)
    .order("creado_el", { ascending: false })
    .limit(limite);
  if (error) {
    console.error("Error al leer los movimientos:", error);
    throw new Error("No se pudieron cargar tus movimientos.");
  }
  return (data ?? []).map((m: any) => ({
    id: m.id,
    servicioId: m.servicio_id ?? null,
    tipo: m.tipo,
    metodoPago: m.metodo_pago,
    tipoServicio: m.tipo_servicio ?? "",
    montoBruto: Number(m.monto_bruto),
    comision: Number(m.comision),
    neto: Number(m.neto),
    saldoDelta: Number(m.saldo_delta),
    creadoEl: m.creado_el,
  }));
};
