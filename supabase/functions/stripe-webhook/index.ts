import Stripe from "npm:stripe@23.2.0";
import { crearClienteStripe } from "../_shared/stripe.ts";
import { crearClienteAdmin } from "../_shared/supabase.ts";

const proveedorCrypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  const secreto = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const firma = req.headers.get("stripe-signature");
  if (!secreto || !firma) return new Response("Firma requerida.", { status: 400 });

  let evento: Stripe.Event;
  try {
    const cuerpo = await req.text();
    const stripe = crearClienteStripe();
    evento = await stripe.webhooks.constructEventAsync(
      cuerpo,
      firma,
      secreto,
      undefined,
      proveedorCrypto,
    );
  } catch {
    return new Response("Firma de webhook inválida.", { status: 400 });
  }

  const admin = crearClienteAdmin();
  const { error: eventoError } = await admin
    .from("stripe_eventos")
    .insert({ id: evento.id, tipo: evento.type });
  if (eventoError) {
    if (eventoError.code !== "23505") {
      return new Response("No se pudo registrar el evento.", { status: 500 });
    }

    const { data: anterior, error: consultaError } = await admin
      .from("stripe_eventos")
      .select("procesado_el,error")
      .eq("id", evento.id)
      .maybeSingle();
    if (consultaError) return new Response("No se pudo consultar el evento.", { status: 500 });
    if (anterior?.procesado_el && !anterior.error) {
      if (
        evento.type === "payment_intent.succeeded" ||
        evento.type === "payment_intent.payment_failed"
      ) {
        const intent = evento.data.object as Stripe.PaymentIntent;
        const servicioId = intent.metadata?.servicio_id;
        if (servicioId) {
          const { data: pago, error: pagoError } = await admin
            .from("pagos")
            .select("estado,stripe_payment_intent_id")
            .eq("servicio_id", servicioId)
            .maybeSingle();
          if (pagoError) {
            return new Response("No se pudo consultar el pago.", { status: 500 });
          }
          const estadoEsperado = evento.type === "payment_intent.succeeded"
            ? "pagado"
            : "fallido";
          if (
            pago?.estado === estadoEsperado &&
            pago.stripe_payment_intent_id === intent.id
          ) {
            return new Response("ok", { status: 200 });
          }
        }
      } else {
        return new Response("ok", { status: 200 });
      }
    }

    const { error: reintentoError } = await admin
      .from("stripe_eventos")
      .update({ error: null })
      .eq("id", evento.id);
    if (reintentoError) return new Response("No se pudo reintentar el evento.", { status: 500 });
  }

  try {
    if (evento.type === "payment_intent.succeeded") {
      const intent = evento.data.object as Stripe.PaymentIntent;
      const servicioId = intent.metadata?.servicio_id;
      if (!servicioId) throw new Error("El PaymentIntent no tiene servicio_id.");

      let chargeId: string | null = null;
      let receiptUrl: string | null = null;
      if (typeof intent.latest_charge === "string") chargeId = intent.latest_charge;
      if (typeof intent.latest_charge === "object" && intent.latest_charge) {
        chargeId = intent.latest_charge.id;
        receiptUrl = intent.latest_charge.receipt_url ?? null;
      }

      const update = await admin.from("pagos").update({
        stripe_payment_intent_id: intent.id,
        estado: "pagado",
        stripe_charge_id: chargeId,
        recibo_url: receiptUrl,
        actualizado_el: new Date().toISOString(),
      }).eq("servicio_id", servicioId).select("id").maybeSingle();
      if (update.error) throw update.error;
      if (!update.data) throw new Error("No se encontró el pago del servicio.");

      const marcado = await admin.rpc("marcar_servicio_pagado", { p_servicio: servicioId });
      if (marcado.error) throw marcado.error;
    }

    if (evento.type === "payment_intent.payment_failed") {
      const intent = evento.data.object as Stripe.PaymentIntent;
      const servicioId = intent.metadata?.servicio_id;
      if (!servicioId) throw new Error("El PaymentIntent no tiene servicio_id.");

      const update = await admin.from("pagos").update({
        stripe_payment_intent_id: intent.id,
        estado: "fallido",
        actualizado_el: new Date().toISOString(),
      }).eq("servicio_id", servicioId).select("id").maybeSingle();
      if (update.error) throw update.error;
      if (!update.data) throw new Error("No se encontró el pago del servicio.");

      const { data: servicio, error: servicioError } = await admin
        .from("servicios").select("user_id").eq("id", servicioId).maybeSingle();
      if (servicioError) throw servicioError;
      if (servicio?.user_id) {
        const { error: notificacionError } = await admin.rpc("notificar", {
          p_usuario: servicio.user_id,
          p_servicio: servicioId,
          p_tipo: "pago_fallido",
          p_titulo: "Pago rechazado",
          p_mensaje: "No pudimos completar el pago. Puedes intentarlo nuevamente.",
        });
        if (notificacionError) throw notificacionError;
      }
    }

    if (evento.type === "charge.refunded" || evento.type === "refund.updated") {
      const objeto = evento.data.object as Stripe.Charge | Stripe.Refund;
      const chargeId = evento.type === "charge.refunded"
        ? (objeto as Stripe.Charge).id
        : (objeto as Stripe.Refund).charge;
      if (!chargeId) throw new Error("El reembolso no tiene cargo asociado.");

      const charge = await (crearClienteStripe()).charges.retrieve(String(chargeId));
      const refundTotal = Number(charge.amount_refunded ?? 0);
      const amount = Number(charge.amount ?? 0);

      const { data: pago } = await admin
        .from("pagos")
        .select("id, servicio_id, monto")
        .eq("stripe_charge_id", String(chargeId))
        .maybeSingle();
      if (!pago) throw new Error("No se encontró el pago reembolsado.");

      const reembolsadoPesos = Math.round(refundTotal / 100);
      const esTotal = refundTotal >= amount;
      await admin.from("pagos").update({
        estado: esTotal ? "reembolsado" : "reembolso_parcial",
        monto_reembolsado: reembolsadoPesos,
        actualizado_el: new Date().toISOString(),
      }).eq("id", pago.id);

      if (esTotal && pago.servicio_id) {
        await admin.rpc("marcar_servicio_reembolsado", { p_servicio: pago.servicio_id });
      }
    }

    if (evento.type === "charge.dispute.created") {
      const charge = evento.data.object as Stripe.Charge;
      await admin.from("pagos").update({
        estado: "en_disputa",
        actualizado_el: new Date().toISOString(),
      }).eq("stripe_charge_id", String(charge.id));
    }

    await admin.from("stripe_eventos").update({
      procesado_el: new Date().toISOString(),
    }).eq("id", evento.id);
    return new Response("ok", { status: 200 });
  } catch (error) {
    const mensaje = String((error as Error).message ?? "Error al procesar el evento.");
    await admin.from("stripe_eventos").update({ error: mensaje }).eq("id", evento.id);
    console.error("stripe-webhook falló:", mensaje);
    return new Response("Error temporal.", { status: 500 });
  }
});
