// src/services/sesionStore.ts
//
// Sesión de Supabase Auth compartida por toda la app. El _layout la usa para
// decidir si muestra las pantallas de login o las de la app.
import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { supabase } from "../lib/supabase";
import { iniciarAvisos } from "./avisosStore";
import { cargarModoDeUsuario } from "./modoStore";

type Estado = {
  sesion: Session | null;
  /** true cuando ya se leyó la sesión guardada en el dispositivo. */
  cargado: boolean;
  /** Al verificar el código de recuperación Supabase abre sesión, pero el
   *  usuario aún debe escribir su nueva contraseña: se sigue en el login. */
  recuperandoClave: boolean;
};

let estado: Estado = { sesion: null, cargado: false, recuperandoClave: false };
const oyentes = new Set<() => void>();

function actualizar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

// Cada cuenta tiene su propio modo (usuario / transportista).
function aplicarSesion(sesion: Session | null) {
  cargarModoDeUsuario(sesion?.user.id ?? null);
  iniciarAvisos(sesion?.user.id ?? null);
  actualizar({ sesion, cargado: true });
}

// En el render estático de web no hay almacenamiento disponible.
if (typeof window !== "undefined") {
  supabase.auth
    .getSession()
    .then(({ data }) => aplicarSesion(data.session))
    .catch(() => actualizar({ cargado: true }));

  supabase.auth.onAuthStateChange((_evento, sesion) => aplicarSesion(sesion));
}

export const obtenerSesion = () => estado;

export const marcarRecuperandoClave = (valor: boolean) =>
  actualizar({ recuperandoClave: valor });

export function useSesion(): Estado {
  return useSyncExternalStore(
    suscribir,
    () => estado,
    () => estado,
  );
}
