import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Props = {
  /** Texto a mostrar; null lo oculta. */
  mensaje: string | null;
  /** Se llama cuando el mensaje termina de ocultarse. */
  alTerminar: () => void;
  duracion?: number;
};

// Aviso flotante que aparece unos segundos y se desvanece.
export default function MensajeTemporal({
  mensaje,
  alTerminar,
  duracion = 2200,
}: Props) {
  const [opacidad] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!mensaje) return;

    opacidad.setValue(0);
    const animacion = Animated.sequence([
      Animated.timing(opacidad, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(duracion),
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
  }, [mensaje, duracion, opacidad, alTerminar]);

  if (!mensaje) return null;

  return (
    <Animated.View
      pointerEvents="none"
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
      <Text style={styles.texto}>{mensaje}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: "rgba(141,178,255,0.65)",
    backgroundColor: "rgba(23,40,78,0.96)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },

  texto: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
