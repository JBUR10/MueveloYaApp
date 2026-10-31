import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Se aceptan URLs copiadas con "/rest/v1/" al final: el cliente necesita solo la base.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(
  /\/(rest\/v1\/?)?$/,
  "",
);
// La clave anon (formato antiguo) también sirve como clave pública.
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Copia .env.example a .env y reinicia con `npx expo start -c`.",
  );
}

// En web, Expo genera cada página primero en el servidor (Node), donde no
// existe `window` y AsyncStorage no funciona. Ahí el cliente trabaja sin
// guardar sesión; en el navegador y en el celular sí la guarda.
const enServidor = typeof window === "undefined";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: enServidor ? undefined : AsyncStorage,
    autoRefreshToken: !enServidor,
    persistSession: !enServidor,
    detectSessionInUrl: false,
  },
});

/** Id del usuario con sesión iniciada. Falla si no hay sesión (las pantallas
 *  de la app solo se muestran con sesión, así que es un caso excepcional). */
export async function asegurarSesion(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  return id;
}

/** Traduce los mensajes de error de Supabase Auth al español. */
export function mensajeErrorAuth(error: unknown): string {
  const msg = String((error as any)?.message ?? error ?? "").toLowerCase();

  if (msg.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (msg.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de entrar.";
  if (msg.includes("user already registered"))
    return "Ya existe una cuenta con este correo.";
  if (msg.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("token has expired") || msg.includes("invalid"))
    return "El código no es válido o ya expiró.";
  // El correo gratuito de Supabase solo envía a miembros del equipo del proyecto.
  if (msg.includes("not authorized") || (error as any)?.code === "email_address_not_authorized")
    return "Este correo no está autorizado para recibir códigos. Usa un correo del equipo del proyecto o pide que configuren un SMTP propio.";
  if (msg.includes("rate limit") || msg.includes("security purposes"))
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Sin conexión. Revisa tu internet.";
  return (error as any)?.message || "Ocurrió un error inesperado.";
}
