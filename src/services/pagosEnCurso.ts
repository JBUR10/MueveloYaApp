// src/services/pagosEnCurso.ts
//
// Pagos que se están iniciando en esta app. Lo comparten Servicios y
// Solicitudes para no iniciar dos veces a la vez el pago de la misma solicitud.
// No protege entre dos pestañas o dos dispositivos: eso le toca al servidor.
const enCurso = new Set<string>();

/** Reserva el pago. Devuelve false si ya hay uno en curso para esa solicitud. */
export function reservarPago(servicioId: string): boolean {
  if (enCurso.has(servicioId)) return false;
  enCurso.add(servicioId);
  return true;
}

export function liberarPago(servicioId: string) {
  enCurso.delete(servicioId);
}

// Web: si se vuelve con «Atrás» desde la página de pago y el navegador restaura
// la app tal como estaba, las reservas ya no valen.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pageshow", (evento) => {
    if ((evento as PageTransitionEvent).persisted) enCurso.clear();
  });
}
