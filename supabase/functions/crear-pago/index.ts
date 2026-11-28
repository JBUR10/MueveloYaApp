import { corsHeaders } from "../_shared/cors.ts";
import { copAPesosStripe, validarMontoCOP } from "../_shared/cop.ts";
import { crearClienteStripe } from "../_shared/stripe.ts";
import { crearClienteAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405, headers: cors });

  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return new Response("Debes iniciar sesión.", { status: 401, headers: cors });

    const admin = crearClienteAdmin();
    const { data: usuarioData, error: usuarioError } = await admin.auth.getUser(token);
    if (usuarioError || !usuarioData.user) {
      return new Response("Sesión inválida.", { status: 401, headers: cors });
    }
    const uid = usuarioData.user.id;
    const body = await req.json();
    const servicioId = String(body?.servicio_id ?? "");
    const plataforma = body?.plataforma === "web" ? "web" : "movil";
    if (!servicioId) return new Response("Solicitud inválida.", { status: 400, headers: cors });

    const { data: servicio, error } = await admin
      .from("servicios")
      .select("*")
      .eq("id", servicioId)
      .eq("user_id", uid)
      .eq("estado", "pendiente")
      .eq("pago_estado", "pendiente_pago")
      .maybeSingle();
    if (error || !servicio) {
      return new Response("No se encontró una solicitud pendiente por pagar.", { status: 404, headers: cors });
    }

    const pesos = Number(servicio.tarifa_acordada ?? 0);
    if (!Number.isInteger(pesos) || pesos < 0) {
      return new Response("No se pudo calcular el monto.", { status: 400, headers: cors });
    }
    if (pesos === 0) {
      const { error: gratisError } = await admin.rpc("marcar_servicio_pagado", { p_servicio: servicioId });
      if (gratisError) throw gratisError;
      return new Response(JSON.stringify({ gratis: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    validarMontoCOP(pesos);

    const stripe = crearClienteStripe();
    const { data: perfil } = await admin.from("perfiles").select("nombre").eq("id", uid).maybeSingle();
    let clienteId: string;
    const { data: clienteExistente } = await admin
      .from("clientes_stripe")
      .select("stripe_customer_id")
      .eq("usuario_id", uid)
      .maybeSingle();

    if (clienteExistente?.stripe_customer_id) {
      clienteId = clienteExistente.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: usuarioData.user.email,
        name: perfil?.nombre ?? undefined,
        metadata: { usuario_id: uid },
      });
      clienteId = customer.id;
      await admin.from("clientes_stripe").upsert({
        usuario_id: uid,
        stripe_customer_id: clienteId,
      });
    }

    const { data: pagoExistente } = await admin
      .from("pagos")
      .select("*")
      .eq("servicio_id", servicioId)
      .in("estado", ["pendiente", "fallido"])
      .maybeSingle();

    let intentId: string;
    let clientSecret: string | null = null;
    const amount = copAPesosStripe(pesos);
    if (pagoExistente?.stripe_payment_intent_id) {
      intentId = pagoExistente.stripe_payment_intent_id;
      const intent = await stripe.paymentIntents.update(intentId, {
        amount,
        customer: clienteId,
        metadata: { servicio_id: servicioId, usuario_id: uid },
      });
      clientSecret = intent.client_secret;
      await admin.from("pagos").update({
        monto: pesos,
        actualizado_el: new Date().toISOString(),
        estado: "pendiente",
      }).eq("id", pagoExistente.id);
    } else {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: "cop",
        customer: clienteId,
        automatic_payment_methods: { enabled: true },
        description: `Muévelo Ya – ${servicio.tipo_servicio}`,
        metadata: { servicio_id: servicioId, usuario_id: uid },
      }, { idempotencyKey: `pi-${servicioId}` });
      intentId = intent.id;
      clientSecret = intent.client_secret;
      await admin.from("pagos").insert({
        servicio_id: servicioId,
        usuario_id: uid,
        stripe_payment_intent_id: intentId,
        monto: pesos,
        moneda: "cop",
        estado: "pendiente",
      });
    }

    if (plataforma === "web") {
      const appUrl = Deno.env.get("APP_WEB_URL");
      if (!appUrl) throw new Error("APP_WEB_URL no está configurada.");
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: servicioId,
        customer: clienteId,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "cop",
            unit_amount: amount,
            product_data: { name: `Muévelo Ya – ${servicio.tipo_servicio}` },
          },
        }],
        payment_intent_data: {
          metadata: { servicio_id: servicioId, usuario_id: uid },
        },
        success_url: `${appUrl.replace(/\/$/, "")}/solicitudes?pago=ok&servicio_id=${encodeURIComponent(servicioId)}`,
        cancel_url: `${appUrl.replace(/\/$/, "")}/solicitudes?pago=cancelado&servicio_id=${encodeURIComponent(servicioId)}`,
      });
      return new Response(JSON.stringify({ checkoutUrl: session.url }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const epk = await stripe.ephemeralKeys.create(
      { customer: clienteId },
      { apiVersion: "2025-12-15.clover" },
    );
    return new Response(JSON.stringify({
      paymentIntentClientSecret: clientSecret,
      customerId: clienteId,
      ephemeralKeySecret: epk.secret,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("crear-pago falló:", String((error as Error).message ?? "Error"));
    return new Response("No se pudo iniciar el pago.", { status: 500, headers: cors });
  }
});
