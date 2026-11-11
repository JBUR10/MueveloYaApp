// src/services/avisoRevision.ts
//
// TEMPORAL: al iniciar sesión, si el transportista ya registró su vehículo y
// un administrador aún no aprueba su perfil, se muestra un pop-up avisando que
// la cuenta será revisada y que mientras tanto no recibe pedidos.
// Para quitarlo: borra este archivo y su llamada en sesionStore.ts.
import { aviso } from "../components/ui/AlertaPantalla";
import { supabase } from "../lib/supabase";

/** Cuenta a la que ya se le mostró el aviso en esta sesión de la app. */
let avisadoA: string | null = null;

export async function avisarRevisionPendiente(uid: string | null) {
  // Al cerrar sesión se olvida, para que el siguiente inicio vuelva a avisar.
  if (!uid) {
    avisadoA = null;
    return;
  }
  if (avisadoA === uid) return;
  avisadoA = uid;

  try {
    const { data } = await supabase
      .from("vehiculos")
      .select("verificacion, motivo_rechazo")
      .eq("transportista_id", uid)
      .maybeSingle();

    // Sin vehículo (no es transportista) o ya aprobado: no hay nada que avisar.
    if (!data || data.verificacion === "aprobado") return;

    if (data.verificacion === "rechazado") {
      await aviso(
        "Cuenta no aprobada",
        `${data.motivo_rechazo || "Revisa los datos de tu vehículo"}. Corrígelos en "Mi vehículo" para que tu cuenta sea revisada de nuevo. Mientras tanto no podrás recibir pedidos.`,
        "error",
      );
      return;
    }

    await aviso(
      "Cuenta en revisión",
      "Tu cuenta será revisada por un administrador. Mientras tanto no podrás recibir pedidos.",
      "info",
    );
  } catch (error) {
    console.error("No se pudo revisar el estado de la cuenta:", error);
  }
}
