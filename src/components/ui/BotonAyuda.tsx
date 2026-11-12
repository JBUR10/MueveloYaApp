// src/components/ui/BotonAyuda.tsx
//
// Botón redondo con el símbolo "?" que abre la pantalla de ayuda.
import { Href, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

export default function BotonAyuda() {
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

const styles = StyleSheet.create({
  boton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,19,24,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
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
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: -1,
  },
});
