import { forwardRef, type ComponentRef } from "react";
import {
  StyleSheet,
  Text as TextoNativo,
  TextInput as CampoNativo,
  useWindowDimensions,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";

/**
 * Tipografía adaptable de MueveloYa.
 *
 * Se usan en lugar de `Text` y `TextInput` de react-native. Hacen dos cosas:
 *
 * 1. Ajustan el tamaño de letra al ancho de la pantalla (base: 390 pt, el
 *    ancho de un celular típico), con un margen corto para que en pantallas
 *    muy pequeñas o muy grandes el texto siga cabiendo en su caja.
 * 2. Limitan cuánto puede crecer la letra cuando la persona sube el tamaño de
 *    fuente del sistema (accesibilidad). Sin tope, los botones y tarjetas se
 *    desbordan o cortan el texto.
 */
const ANCHO_BASE = 390;
const ESCALA_MIN = 0.9;
const ESCALA_MAX = 1.12;
/** Ninguna letra se dibuja por debajo de este tamaño (legibilidad en pantallas pequeñas). */
const TAMANO_MINIMO = 11;
/** Crecimiento máximo permitido por el tamaño de fuente del sistema. */
export const TOPE_FUENTE_SISTEMA = 1.2;

export function useEscala() {
  const { width } = useWindowDimensions();
  return Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, width / ANCHO_BASE));
}

function escalarEstilo(estilo: TextProps["style"], escala: number) {
  const plano = StyleSheet.flatten(estilo) as TextStyle | undefined;
  if (!plano || (plano.fontSize == null && plano.lineHeight == null)) {
    return estilo;
  }
  // TextStyle es de solo lectura en RN 0.87+: se arma un objeto editable.
  const ajustes: { fontSize?: number; lineHeight?: number } = {};
  let factor = escala;
  if (plano.fontSize != null) {
    const tamano = Math.max(TAMANO_MINIMO, plano.fontSize * escala);
    const fontSize = Math.round(tamano * 2) / 2;
    ajustes.fontSize = fontSize;
    // El interlineado sigue el mismo factor que la letra, incluida la subida al mínimo.
    factor = fontSize / plano.fontSize;
  }
  if (plano.lineHeight != null) {
    ajustes.lineHeight = Math.round(plano.lineHeight * factor * 2) / 2;
  }
  if (ajustes.fontSize === plano.fontSize && ajustes.lineHeight === plano.lineHeight) {
    return estilo;
  }
  return [estilo, ajustes];
}

export const Text = forwardRef<ComponentRef<typeof TextoNativo>, TextProps>(function Texto(
  { style, maxFontSizeMultiplier, ...resto },
  ref,
) {
  const escala = useEscala();
  return (
    <TextoNativo
      ref={ref}
      style={escalarEstilo(style, escala)}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? TOPE_FUENTE_SISTEMA}
      {...resto}
    />
  );
});

export const TextInput = forwardRef<ComponentRef<typeof CampoNativo>, TextInputProps>(
  function Campo({ style, maxFontSizeMultiplier, ...resto }, ref) {
    const escala = useEscala();
    return (
      <CampoNativo
        ref={ref}
        style={escalarEstilo(style as TextProps["style"], escala)}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? TOPE_FUENTE_SISTEMA}
        {...resto}
      />
    );
  },
);

export default Text;
