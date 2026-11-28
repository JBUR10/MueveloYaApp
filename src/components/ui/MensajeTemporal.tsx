import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { Text } from "./Texto";
import { useEstilos, type Paleta } from "../../services/temaStore";

type TipoMensaje = "exito" | "error" | "advertencia" | "info";

type Props = {
  /** Texto a mostrar; null lo oculta. */
  mensaje: string | null;
  /** Se llama cuando el mensaje termina de ocultarse. */
  alTerminar: () => void;
  tipo?: TipoMensaje;
  duracion?: number;
};

// Aviso flotante que aparece unos segundos y se desvanece.
export default function MensajeTemporal({
  mensaje,
  alTerminar,
  tipo = "info",
  duracion = 5000,
}: Props) {
  const styles = useEstilos(crearEstilos);
  const [opacidad] = useState(() => new Animated.Value(0));
  const urgente = tipo === "error" || tipo === "advertencia";

  useEffect(() => {
    if (!mensaje) return;

    const tiempoVisible = Math.max(duracion, urgente ? 6000 : 0);
    opacidad.setValue(0);
    const animacion = Animated.sequence([
      Animated.timing(opacidad, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(tiempoVisible),
      Animated.timing(opacidad, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]);
    animacion.start(({ finished }) => {
      if (finished) alTerminar();
    });

    return () => animacion.stop();
  }, [mensaje, duracion, urgente, opacidad, alTerminar]);

  if (!mensaje) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessible
      accessibilityRole={urgente ? "alert" : "text"}
      accessibilityLabel={mensaje}
      accessibilityLiveRegion={urgente ? "assertive" : "polite"}
      role={urgente ? "alert" : "status"}
      aria-live={urgente ? "assertive" : "polite"}
      style={[
        styles.contenedor,
        {
          opacity: opacidad,
          transform: [
            {
              translateY: opacidad.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}>
      <Text accessible={false} style={styles.texto}>{mensaje}</Text>
    </Animated.View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  contenedor: {
    position: "absolute",
    top: 12,
    left: 20,
    right: 20,
    zIndex: 10,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.toastBorde,
    backgroundColor: p.toastFondo,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },

  texto: {
    color: p.texto,
    fontSize: 13,
    fontWeight: "800",
  },
});
