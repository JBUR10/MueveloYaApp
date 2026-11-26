import * as Linking from "expo-linking";
import {
  initPaymentSheet,
  presentPaymentSheet,
} from "@stripe/stripe-react-native";
import type { Paleta } from "../constants/paleta";
import type { ResultadoPago } from "./pagoService";
import { traducirErrorPago } from "./pagoService";

export async function pagarServicioStripe(
  datos:
    | {
        paymentIntentClientSecret: string;
        customerId: string;
        ephemeralKeySecret: string;
      }
    | { checkoutUrl: string },
  paleta?: Paleta,
): Promise<ResultadoPago> {
  if (!("paymentIntentClientSecret" in datos)) {
    return { estado: "error", mensaje: "No se pudo iniciar el pago móvil." };
  }
  const returnURL = Linking.createURL("stripe-redirect");
  const init = await initPaymentSheet({
    merchantDisplayName: "Muévelo Ya",
    customerId: datos.customerId,
    customerEphemeralKeySecret: datos.ephemeralKeySecret,
    paymentIntentClientSecret: datos.paymentIntentClientSecret,
    returnURL,
    googlePay: {
      merchantCountryCode: "CO",
      testEnv: __DEV__,
    },
    appearance: {
      colors: {
        primary: "#2969e9",
        background: paleta?.superficie ?? "#161B22",
        componentBackground: paleta?.fondo ?? "#111318",
        componentBorder: paleta?.bordeCampo ?? "#1F2937",
        componentText: paleta?.texto ?? "#FFFFFF",
        primaryText: paleta?.texto ?? "#FFFFFF",
        secondaryText: paleta?.textoPista ?? "#E5E9EC",
      },
    },
  });
  if (init.error) {
    return { estado: "error", mensaje: traducirErrorPago(init.error) };
  }

  const resultado = await presentPaymentSheet();
  if (resultado.error) {
    if (resultado.error.code === "Canceled") {
      return { estado: "cancelado", mensaje: "Pago cancelado." };
    }
    return { estado: "error", mensaje: traducirErrorPago(resultado.error) };
  }
  return { estado: "pagado", mensaje: "Estamos confirmando tu pago." };
}
