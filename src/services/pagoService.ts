import { asegurarSesion, supabase } from "../lib/supabase";

export type ResultadoPago = {
  estado: "pagado" | "cancelado" | "error";
  mensaje?: string;
};

export type PagoRegistrado = {
  id: string;
  servicio_id: string | null;
  monto: number;
  moneda: string;
  estado: "pendiente" | "pagado" | "fallido" | "reembolsado" | "reembolso_parcial" | "en_disputa";
  recibo_url: string | null;
  creado_el: string;
};

export async function esperarConfirmacionPago(
  servicioId: string,
  tiempoMaximoMs = 30_000,
): Promise<boolean> {
  const usuarioId = await asegurarSesion();
  const limite = Date.now() + tiempoMaximoMs;

  while (Date.now() < limite) {
    const { data, error } = await supabase
      .from("servicios")
      .select("pago_estado")
      .eq("id", servicioId)
      .eq("user_id", usuarioId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se encontró la solicitud.");
    if (data.pago_estado === "pagado") return true;
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return false;
}

export async function crearPago(servicioId: string, plataforma: "movil" | "web") {
  const { data, error } = await supabase.functions.invoke("crear-pago", {
    body: { servicio_id: servicioId, plataforma },
  });
  if (error) throw new Error("No se pudo iniciar el pago.");
  return data as {
    gratis?: boolean;
    paymentIntentClientSecret?: string;
    customerId?: string;
    ephemeralKeySecret?: string;
    checkoutUrl?: string;
  };
}

export async function pedirReembolso(servicioId: string) {
  const { data, error } = await supabase.functions.invoke("reembolsar-servicio", {
    body: { servicio_id: servicioId },
  });
  if (error) throw new Error("No se pudo solicitar el reembolso.");
  return data as { ok: boolean };
}

export async function obtenerMisPagos(limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from("pagos")
    .select("id,servicio_id,monto,moneda,estado,recibo_url,creado_el")
    .order("creado_el", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as PagoRegistrado[];
}

export function traducirErrorPago(error: unknown): string {
  const texto = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  if (texto.includes("card_declined") || texto.includes("rechaz")) return "Tu tarjeta fue rechazada.";
  if (texto.includes("insufficient") || texto.includes("fondos")) return "La tarjeta no tiene fondos suficientes.";
  if (texto.includes("authentication") || texto.includes("3d")) return "La autenticación de la tarjeta falló.";
  if (texto.includes("network") || texto.includes("conex")) return "Se perdió la conexión. Inténtalo nuevamente.";
  return "No se pudo completar el pago.";
}
