import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { usePaleta } from "../../services/temaStore";

/** Nombres válidos de Ionicons (autocompletado y verificación de tipos). */
export type NombreIcono = ComponentProps<typeof Ionicons>["name"];

type Props = {
  nombre: NombreIcono;
  /** Tamaño en puntos. Por defecto 18. */
  tamano?: number;
  /** Color del icono. Por defecto blanco. */
  color?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Icono vectorial único de la app. Reemplaza a los emojis y símbolos de
 * texto: se ve igual en Android, iOS y web, y toma el color que se le dé.
 * No crece con el tamaño de letra del sistema, así nunca se desacomoda.
 */
export default function Icono({
  nombre,
  tamano = 18,
  color,
  style,
}: Props) {
  const p = usePaleta();
  return (
    <Ionicons
      name={nombre}
      size={tamano}
      color={color ?? p.texto}
      style={style}
      allowFontScaling={false}
      accessible={false}
    />
  );
}
