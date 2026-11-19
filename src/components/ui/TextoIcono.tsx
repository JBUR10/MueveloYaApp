import type { ReactNode } from "react";
import { StyleSheet, type TextProps, type TextStyle } from "react-native";

import Icono, { type NombreIcono } from "./Icono";
import { Text, useEscala } from "./Texto";
import { usePaleta } from "../../services/temaStore";

type Props = TextProps & {
  icono: NombreIcono;
  children?: ReactNode;
  /** Color del icono. Si no se da, usa el color del texto. */
  colorIcono?: string;
  /** Tamaño del icono. Si no se da, sigue el tamaño de la letra. */
  tamanoIcono?: number;
  /** Poner el icono después del texto (flechas "Siguiente →"). */
  alFinal?: boolean;
};

/**
 * Texto con un icono en línea (reemplaza a "⚡ Inmediato", "📞 Llamar", etc.).
 * El icono va dentro del mismo <Text>, así que respeta `numberOfLines`,
 * `textAlign` y el salto de línea igual que cualquier texto.
 */
export default function TextoIcono({
  icono,
  children,
  colorIcono,
  tamanoIcono,
  alFinal = false,
  style,
  ...resto
}: Props) {
  const p = usePaleta();
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const color = colorIcono ?? (typeof plano.color === "string" ? plano.color : p.texto);
  const base = plano.fontSize ?? 14;
  const escala = useEscala();
  const tamano = tamanoIcono ?? Math.round(base * escala * 1.15);

  const marca = <Icono nombre={icono} tamano={tamano} color={color} />;

  return (
    <Text style={style} {...resto}>
      {!alFinal && marca}
      {!alFinal && children != null && "  "}
      {children}
      {alFinal && children != null && "  "}
      {alFinal && marca}
    </Text>
  );
}
