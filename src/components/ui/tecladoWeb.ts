// src/components/ui/tecladoWeb.ts
//
// Solo web. react-native-web no traslada accessibilityState al navegador y no
// responde a Espacio ni a las flechas en opciones, pestañas y casillas. Estas
// funciones devuelven las propiedades que faltan; en Android/iOS devuelven {}.
// Enter no se maneja aquí (salvo en enlaces): la librería ya llama a onPress.
import { useState } from "react";
import { Platform } from "react-native";

/** Cuánto avanza el foco con cada flecha. Las pestañas solo usan las horizontales. */
const PASO_FLECHA: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

type Rol = "radio" | "tab";
type Valor = string | number | boolean | null;

const conModificador = (e: KeyboardEvent) => e.altKey || e.ctrlKey || e.metaKey;

/** Ejecuta la acción con la tecla indicada, sin repetirla si se mantiene pulsada. */
function alPulsar(evento: KeyboardEvent, tecla: string, accion: () => void) {
  if (conModificador(evento) || evento.key !== tecla) return false;
  evento.preventDefault();
  if (!evento.repeat) accion();
  return true;
}

function moverFoco(evento: KeyboardEvent, rol: Rol) {
  const paso = PASO_FLECHA[evento.key];
  if (!paso || conModificador(evento)) return;
  // En unas pestañas, Arriba y Abajo siguen desplazando la página.
  if (rol === "tab" && (evento.key === "ArrowUp" || evento.key === "ArrowDown")) {
    return;
  }
  evento.preventDefault();
  const actual = evento.currentTarget as HTMLElement;
  const opciones = Array.from(
    actual.parentElement?.querySelectorAll<HTMLElement>(`[role="${rol}"]`) ?? [],
  );
  const destino =
    (opciones.indexOf(actual) + paso + opciones.length) % opciones.length;
  opciones[destino]?.focus();
}

/**
 * Grupo de elección única (opciones o pestañas): indica cuál está elegida, deja
 * una sola parada de Tab, mueve el foco con las flechas y elige con Espacio.
 * Devuelve una función con las propiedades de cada opción.
 */
export function useTecladoGrupo<T extends Valor>(
  rol: Rol,
  opciones: readonly T[],
  seleccionada: T,
) {
  // Se guarda dentro de un objeto porque null también puede ser una opción.
  const [enfocada, setEnfocada] = useState<{ valor: T } | null>(null);
  // Tab entra por la elegida; si no hay ninguna, por la primera.
  const paradaTab =
    enfocada && opciones.includes(enfocada.valor)
      ? enfocada.valor
      : opciones.includes(seleccionada)
        ? seleccionada
        : opciones[0];

  return (valor: T, elegir: () => void): object => {
    if (Platform.OS !== "web") return {};
    return {
      [rol === "tab" ? "aria-selected" : "aria-checked"]: valor === seleccionada,
      tabIndex: valor === paradaTab ? 0 : -1,
      onFocus: () => setEnfocada({ valor }),
      onBlur: () => setEnfocada(null),
      onKeyDown: (evento: KeyboardEvent) => {
        if (!alPulsar(evento, " ", elegir)) moverFoco(evento, rol);
      },
    };
  };
}

/** Casilla: indica si está marcada y se cambia con Espacio. */
export function propsCasillaWeb(marcada: boolean, alternar: () => void): object {
  if (Platform.OS !== "web") return {};
  return {
    "aria-checked": marcada,
    onKeyDown: (evento: KeyboardEvent) => {
      alPulsar(evento, " ", alternar);
    },
  };
}

/** Enlace sin dirección: react-native-web no lo activa con Enter. */
export function propsEnlaceWeb(abrir: () => void): object {
  if (Platform.OS !== "web") return {};
  return {
    onKeyDown: (evento: KeyboardEvent) => {
      alPulsar(evento, "Enter", abrir);
    },
  };
}
