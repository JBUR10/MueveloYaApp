import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { useRef } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

type Pestaña = "Inicio" | "Servicios" | "Solicitudes" | "Perfil";

const PESTAÑAS = [
  { id: "Inicio", icono: "⌂", ruta: "/" },
  { id: "Servicios", icono: "◇", ruta: "/servicios" },
  { id: "Solicitudes", icono: "▤", ruta: "/solicitudes" },
  { id: "Perfil", icono: "○", ruta: "/perfil" },
] as const;

const DISTANCIA_DESLIZAMIENTO = 45;

export default function BarraNavegacion() {
  const router = useRouter();
  const rutaActual = usePathname();

  const indiceActivo = Math.max(
    0,
    PESTAÑAS.findIndex((pestaña) => pestaña.ruta === rutaActual),
  );

  const pestañaActiva: Pestaña = PESTAÑAS[indiceActivo].id;

  // Referencias para evitar que el gesto utilice un índice desactualizado.
  const indiceActivoRef = useRef(indiceActivo);
  indiceActivoRef.current = indiceActivo;

  const navegarAIndice = (indice: number) => {
    if (indice < 0 || indice >= PESTAÑAS.length) return;

    const seleccionada = PESTAÑAS[indice];

    if (seleccionada.ruta !== rutaActual) {
      router.push(seleccionada.ruta);
    }
  };

  const manejarPestaña = (pestaña: Pestaña) => {
    const indice = PESTAÑAS.findIndex((item) => item.id === pestaña);

    navegarAIndice(indice);
  };

  // Gesto horizontal para avanzar o retroceder entre pestañas.
  const responderDeslizamiento = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesto) =>
        Math.abs(gesto.dx) > 12 &&
        Math.abs(gesto.dx) > Math.abs(gesto.dy) * 1.2,

      onPanResponderRelease: (_, gesto) => {
        if (Math.abs(gesto.dx) < DISTANCIA_DESLIZAMIENTO) {
          return;
        }

        const indiceActual = indiceActivoRef.current;

        if (gesto.dx < 0) {
          // Deslizar hacia la izquierda: siguiente pestaña.
          navegarAIndice(indiceActual + 1);
        } else {
          // Deslizar hacia la derecha: pestaña anterior.
          navegarAIndice(indiceActual - 1);
        }
      },
    }),
  ).current;

  return (
    <View style={styles.barraNavegacion}>
      <BlurView
        intensity={24}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={styles.fondoBlurBarra}
      />

      <View style={styles.sombraCristalBarra} />

      <LinearGradient
        colors={[
          "rgba(255,255,255,0.18)",
          "rgba(235,242,248,0.08)",
          "rgba(215,226,238,0.04)",
        ]}
        locations={[0, 0.45, 1]}
        style={styles.cristalBarra}
      >
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.28)",
            "rgba(255,255,255,0.06)",
            "rgba(255,255,255,0)",
          ]}
          locations={[0, 0.5, 1]}
          style={styles.reflejoBarra}
        />

        <View style={styles.lineaLuzBarra} />

        <View
          style={styles.elementosBarra}
          {...responderDeslizamiento.panHandlers}
        >
          {PESTAÑAS.map((pestaña) => {
            const activa = pestañaActiva === pestaña.id;

            return (
              <Pressable
                key={pestaña.id}
                style={({ pressed }) => [
                  styles.elementoNavegacion,
                  pressed && styles.presionado,
                ]}
                onPress={() => manejarPestaña(pestaña.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: activa }}
                accessibilityLabel={pestaña.id}
              >
                {activa && (
                  <View style={styles.cristalActivo}>
                    <LinearGradient
                      colors={[
                        "rgba(255,255,255,0.30)",
                        "rgba(255,255,255,0.11)",
                        "rgba(255,255,255,0.04)",
                      ]}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                )}

                <Text
                  style={[
                    styles.simboloNavegacion,
                    activa && styles.simboloNavegacionActivo,
                  ]}
                >
                  {pestaña.icono}
                </Text>

                <Text
                  style={[
                    styles.textoNavegacion,
                    activa && styles.textoNavegacionActivo,
                  ]}
                >
                  {pestaña.id}
                </Text>

                {activa && <View style={styles.indicadorActivo} />}
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  barraNavegacion: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 8,
    zIndex: 5,
    height: 76,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(17,19,24,0.36)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  fondoBlurBarra: {
    ...StyleSheet.absoluteFill,
    borderRadius: 27,
  },

  sombraCristalBarra: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(17,19,24,0.30)",
  },

  cristalBarra: {
    flex: 1,
    borderRadius: 27,
    overflow: "hidden",
    backgroundColor: "rgba(17,19,24,0.08)",
  },

  reflejoBarra: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 31,
  },

  lineaLuzBarra: {
    position: "absolute",
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  elementosBarra: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
    zIndex: 1,
  },

  elementoNavegacion: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  cristalActivo: {
    position: "absolute",
    top: 7,
    bottom: 7,
    left: 4,
    right: 4,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
  },

  simboloNavegacion: {
    color: "#F0F3F5",
    fontSize: 23,
    lineHeight: 27,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  simboloNavegacionActivo: {
    color: "#FFFFFF",
  },

  textoNavegacion: {
    color: "#E5E9EC",
    fontSize: 10,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  textoNavegacionActivo: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  indicadorActivo: {
    position: "absolute",
    bottom: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },

  presionado: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
