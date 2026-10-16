import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const PESTAÑAS = [
  { id: "Inicio", icono: "⌂", ruta: "/" },
  { id: "Servicios", icono: "◇", ruta: "/servicios" },
  { id: "Solicitudes", icono: "▤", ruta: "/solicitudes" },
  { id: "Perfil", icono: "○", ruta: "/perfil" },
] as const;

export default function BarraNavegacion() {
  const router = useRouter();
  const rutaActual = usePathname();

  return (
    <View style={styles.barra}>
      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />

      <LinearGradient
        colors={[
          "rgba(255,255,255,0.18)",
          "rgba(235,242,248,0.08)",
          "rgba(215,226,238,0.04)",
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          "rgba(255,255,255,0.28)",
          "rgba(255,255,255,0.06)",
          "rgba(255,255,255,0)",
        ]}
        locations={[0, 0.5, 1]}
        style={styles.reflejo}
      />

      <View style={styles.lineaLuz} />

      <View style={styles.elementos}>
        {PESTAÑAS.map((pestaña) => {
          const activa = rutaActual === pestaña.ruta;

          return (
            <Pressable
              key={pestaña.id}
              onPress={() => {
                if (!activa) {
                  router.push(pestaña.ruta as "/");
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={pestaña.id}
              accessibilityState={{ selected: activa }}
              style={({ pressed }) => [
                styles.elemento,
                pressed && styles.presionado,
              ]}>
              {activa && (
                <View style={styles.cristalActivo}>
                  <LinearGradient
                    colors={[
                      "rgba(41,105,233,0.32)",
                      "rgba(255,255,255,0.11)",
                      "rgba(255,255,255,0.04)",
                    ]}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              )}

              <Text style={[styles.simbolo, activa && styles.activo]}>
                {pestaña.icono}
              </Text>

              <Text style={[styles.texto, activa && styles.textoActivo]}>
                {pestaña.id}
              </Text>

              {activa && <View style={styles.indicador} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    position: "absolute",
    bottom: 8,
    left: 20,
    right: 20,
    height: 76,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(17,19,24,0.65)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  reflejo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 31,
  },

  lineaLuz: {
    position: "absolute",
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  elementos: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },

  elemento: {
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

  simbolo: {
    color: "#F0F3F5",
    fontSize: 23,
    lineHeight: 27,
  },

  activo: {
    color: "#FFFFFF",
  },

  texto: {
    color: "#E5E9EC",
    fontSize: 10,
    fontWeight: "600",
  },

  textoActivo: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  indicador: {
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
