import type { TextProps } from "react-native";

import type { Calificacion } from "../../services/servicioService";
import { textoCalificacion } from "../../services/servicioService";
import { Text } from "./Texto";
import TextoIcono from "./TextoIcono";
import { usePaleta } from "../../services/temaStore";

type Props = TextProps & {
  calificacion?: Calificacion | null;
  /** Texto antes del valor, por ejemplo "Cliente: ". */
  prefijo?: string;
};

/** "4,8 (12)" con una estrella dorada, o "Sin calificaciones" si no hay datos. */
export default function TextoCalificacion({
  calificacion,
  prefijo = "",
  ...resto
}: Props) {
  const p = usePaleta();
  if (calificacion?.promedio == null) {
    return (
      <Text {...resto}>
        {prefijo}
        {textoCalificacion(calificacion)}
      </Text>
    );
  }

  return (
    <TextoIcono icono="star" colorIcono={p.estrella} {...resto}>
      {prefijo}
      {textoCalificacion(calificacion)}
    </TextoIcono>
  );
}
