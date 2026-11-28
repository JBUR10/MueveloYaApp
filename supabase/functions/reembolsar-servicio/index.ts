import { corsHeaders } from "../_shared/cors.ts";
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
    if (!servicioId) return new Response("Solicitud inválida.", { status: 400, headers: cors });

    const { data: servicio, error: servicioError } = await admin
      .from("servicios")
      .select("id,user_id,estado,cancelada_por,pago_estado")
      .eq("id", servicioId)
      .eq("user_id", uid)
      .eq("estado", "cancelada")
      .eq("cancelada_por", "cliente")
      .eq("pago_estado", "pagado")
      .maybeSingle();
    if (servicioError || !servicio) {
      return new Response("Este servicio no puede reembolsarse.", { status: 400, headers: cors });
    }

    const { data: pago } = await admin
      .from("pagos")
      .select("id,estado,usuario_id,stripe_payment_intent_id,monto_reembolsado,monto")
      .eq("servicio_id", servicioId)
      .eq("usuario_id", uid)
      .eq("estado", "pagado")
      .maybeSingle();
    if (!pago) return new Response("No existe un pago pagado para reembolsar.", { status: 400, headers: cors });

    const stripe = crearClienteStripe();
    await stripe.refunds.create({
      payment_intent: pago.stripe_payment_intent_id,
      metadata: { servicio_id: servicioId, usuario_id: uid },
    }, { idempotencyKey: `refund-${pago.id}` });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("reembolsar-servicio falló:", String((error as Error).message ?? "Error"));
    return new Response("No se pudo solicitar el reembolso.", { status: 500, headers: cors });
  }
});
