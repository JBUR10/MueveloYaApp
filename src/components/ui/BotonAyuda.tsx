// src/components/ui/BotonAyuda.tsx
//
// Botón redondo con el símbolo "?" que abre la pantalla de ayuda.
import { Href, useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Texto";
import { useEstilos, type Paleta } from "../../services/temaStore";

export default function BotonAyuda() {
  const styles = useEstilos(crearEstilos);
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/ayuda" as Href)}
      accessibilityRole="button"
      accessibilityLabel="Ayuda"
      hitSlop={8}
      style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
    >
      <Text style={styles.simbolo}>?</Text>
    </Pressable>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  boton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.panel(0.72),
    borderWidth: 1,
    borderColor: p.linea(0.28),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  presionado: {
    opacity: 0.7,
  },
  simbolo: {
    color: p.texto,
    fontSize: 20,
    fontWeight: "800",
    marginTop: -1,
  },
});
