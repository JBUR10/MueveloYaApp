export function corsHeaders(req: Request): HeadersInit {
  const origen = req.headers.get("origin") ?? "";
  const permitido = Deno.env.get("APP_WEB_URL")?.replace(/\/$/, "") === origen
    ? origen
    : "*";
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
