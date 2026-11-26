// src/components/transportista/EvidenciaRecogida.tsx
//
// Al recoger la carga, el transportista toma fotos del estado de los
// artículos (1 a 10, solo con la cámara). Le sirven de soporte si luego el
// cliente reporta un daño que ya existía. Sin fotos no puede marcar recogido.
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { useEstilos, type Paleta } from "../../services/temaStore";
import SelectorFotos from "../ui/SelectorFotos";
import { Text } from "../ui/Texto";

export const MAX_FOTOS_RECOGIDA = 10;
const AZUL = "#2969e9";

type Props = {
  /** Fotos con las que se abre (la primera ya tomada). null = cerrado. */
  fotosIniciales: string[] | null;
  onCerrar: () => void;
  /** Sube las fotos y marca recogido. Si lanza un error, se muestra aquí. */
  onConfirmar: (fotos: string[]) => Promise<void>;
};

export default function EvidenciaRecogida({
  fotosIniciales,
  onCerrar,
  onConfirmar,
}: Props) {
  const styles = useEstilos(crearEstilos);
  // Se vuelve a montar en cada apertura (key en el padre), así arranca
  // con las fotos iniciales y sin errores previos.
  const [fotos, setFotos] = useState<string[]>(fotosIniciales ?? []);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const cerrar = () => {
    if (enviando) return;
    onCerrar();
  };

  const confirmar = async () => {
    if (!fotos.length || enviando) return;
    setEnviando(true);
    setError("");
    try {
      await onConfirmar(fotos);
    } catch (e: any) {
      setError(e?.message || "No se pudo marcar como recogido.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      visible={!!fotosIniciales}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cerrar}
    >
      <View style={styles.overlay}>
        <View style={styles.contenedor}>
          <ScrollView
            contentContainerStyle={styles.contenido}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.titulo}>Estado de los artículos</Text>
            <Text style={styles.subtitulo}>
              Toma fotos de los artículos, sobre todo de golpes, rayones o
              daños que ya tengan. Si el cliente reporta un daño, estas fotos
              son tu soporte.
            </Text>

            <SelectorFotos
              fotos={fotos}
              onChange={setFotos}
              maximo={MAX_FOTOS_RECOGIDA}
              permitirGaleria={false}
              deshabilitado={enviando}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.botones}>
              <Pressable
                onPress={cerrar}
                style={[styles.boton, styles.botonSecundario]}
                accessibilityRole="button"
              >
                <Text style={styles.textoBoton}>Aún no</Text>
              </Pressable>
              <Pressable
                onPress={confirmar}
                disabled={!fotos.length || enviando}
                style={[
                  styles.boton,
                  styles.botonPrincipal,
                  !fotos.length && styles.inactivo,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !fotos.length || enviando }}
              >
                {enviando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.textoBoton, styles.textoBlanco]}>
                    Confirmar recogida
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    contenedor: {
      width: "100%",
      maxWidth: 400,
      maxHeight: "92%",
      backgroundColor: p.superficie,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.bordeFuerte,
    },
    contenido: { padding: 22, gap: 12 },
    titulo: { color: p.texto, fontSize: 19, fontWeight: "800", textAlign: "center" },
    subtitulo: {
      color: p.textoTenue,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    error: { color: p.textoError, fontSize: 13, textAlign: "center" },
    botones: { flexDirection: "row", gap: 10, marginTop: 4 },
    boton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
    botonSecundario: { backgroundColor: p.velo(0.1) },
    botonPrincipal: { backgroundColor: AZUL },
    inactivo: { opacity: 0.5 },
    textoBoton: { color: p.texto, fontWeight: "800", fontSize: 14 },
    textoBlanco: { color: "#FFFFFF" },
  });
