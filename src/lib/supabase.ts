import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Copia .env.example a .env y reinicia con `npx expo start -c`.",
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let sesionEnCurso: Promise<string> | null = null;

export function asegurarSesion(): Promise<string> {
  if (!sesionEnCurso) {
    sesionEnCurso = (async () => {
      const { data: actual } = await supabase.auth.getSession();
      if (actual.session) return actual.session.user.id;

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        throw new Error(
          error?.message || "No se pudo iniciar la sesión anónima.",
        );
      }
      return data.user.id;
    })().finally(() => {
      sesionEnCurso = null;
    });
  }
  return sesionEnCurso;
}
