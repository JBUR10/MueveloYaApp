import type { ResultadoPago } from "./pagoService";

export async function pagarServicioStripe(
  datos:
    | { checkoutUrl: string }
    | { paymentIntentClientSecret: string; customerId: string; ephemeralKeySecret: string },
): Promise<ResultadoPago> {
  if (!("checkoutUrl" in datos) || !datos.checkoutUrl) {
    return { estado: "error", mensaje: "No se pudo abrir el pago." };
  }
  if (typeof window !== "undefined") window.location.assign(datos.checkoutUrl);
  return { estado: "cancelado", mensaje: "Redirigiendo al pago seguro." };
}
