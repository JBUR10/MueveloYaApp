// src/components/ui/AnuncioPantalla.tsx
//
// Solo web. Al cambiar de pantalla, lleva el foco a un encabezado invisible con
// su nombre: el lector de pantalla lo anuncia una vez y la lectura (flechas o
// Tab) continúa en la pantalla nueva. En Android/iOS no hace nada.
import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";

const NOMBRES: Record<string, string> = {
  "/": "Inicio",
  "/servicios": "Servicios",
  "/solicitudes": "Solicitudes",
  // Pestaña "Solicitudes" del modo transportista.
  "/transportista": "Solicitudes",
  "/perfil": "Perfil",
  "/login": "Inicio de sesión",
  "/registro": "Registro",
  "/recuperar": "Recuperar contraseña",
  "/verificar": "Verificación de correo",
  "/admin": "Panel de administración",
  "/vehiculo": "Vehículo",
  "/ayuda": "Ayuda",
  "/queja": "Queja",
};

/** Pausa (ms) para que la pantalla nueva termine de mostrarse. */
const ESPERA = 300;

// Fuera del componente: el layout lo desmonta mientras carga la sesión.
let ultimaRuta: string | null = null;
let publicar: ((nombre: string) => void) | null = null;

/** Para cambios de pantalla que no cambian de ruta (pasos de una pantalla). */
export function anunciarPantalla(nombre: string) {
  publicar?.(nombre);
}

/**
 * Guarda la ruta y devuelve el nombre a anunciar si de verdad cambió.
 * Debe quedar fuera del componente: React Compiler reordenaba esta lectura y
 * escritura de `ultimaRuta` y nunca se anunciaba nada.
 */
function registrarRuta(ruta: string): string | undefined {
  const anterior = ultimaRuta;
  ultimaRuta = ruta;
  // En la primera carga no se mueve el foco: no hubo cambio de pantalla.
  if (anterior === null || anterior === ruta) return undefined;
  return NOMBRES[ruta];
}

export default function AnuncioPantalla() {
  return Platform.OS === "web" ? <AnuncioWeb /> : null;
}

function AnuncioWeb() {
  const ruta = usePathname();
  const [anuncio, setAnuncio] = useState({ nombre: "", numero: 0 });
  const id = `anuncio-pantalla-${anuncio.numero}`;

  useEffect(() => {
    publicar = (nombre) =>
      setAnuncio((a) => ({ nombre, numero: a.numero + 1 }));
    return () => {
      publicar = null;
    };
  }, []);

  useEffect(() => {
    const nombre = registrarRuta(ruta);
    if (nombre) anunciarPantalla(nombre);
  }, [ruta]);

  useEffect(() => {
    if (!anuncio.numero) return;
    let temporizador: ReturnType<typeof setTimeout>;
    const enfocar = () => {
      // Con un diálogo abierto no se le quita el foco: se espera a que cierre.
      if (document.querySelector('[aria-modal="true"]')) {
        temporizador = setTimeout(enfocar, ESPERA);
        return;
      }
      document.getElementById(id)?.focus({ preventScroll: true });
    };
    temporizador = setTimeout(enfocar, ESPERA);
    return () => clearTimeout(temporizador);
  }, [anuncio.numero, id]);

  if (!anuncio.numero) return null;

  return (
    // Un elemento nuevo en cada cambio, para que el lector siempre lo anuncie.
    <Text
      key={anuncio.numero}
      nativeID={id}
      accessibilityRole="header"
      style={styles.soloLector}
      {...({ tabIndex: -1 } as object)}
    >
      {anuncio.nombre}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Invisible pero legible por el lector; al ser absoluto no altera el diseño.
  soloLector: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
});
