import Stripe from "npm:stripe@23.2.0";

export function crearClienteStripe(): Stripe {
  const clave = Deno.env.get("STRIPE_SECRET_KEY");
  if (!clave) throw new Error("Stripe no está configurado.");
  return new Stripe(clave, {
    apiVersion: "2025-12-15.clover",
    httpClient: Stripe.createFetchHttpClient(),
  });
}
