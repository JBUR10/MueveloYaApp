// src/components/ui/CalificarServicio.tsx
//
// Calificación al finalizar un servicio.
//  - Cliente: estrellas al transportista y a la app, ¿lo recomendarías?,
//    sugerencias y ¿tuviste algún problema? (si sí, se abre el formulario de quejas).
//  - Transportista: estrellas al cliente y un comentario.
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  calificarServicio,
  DatosCalificacion,
} from "../../services/calificacionService";

const AZUL = "#2969e9";

type Props = {
  /** Servicio a calificar; null = modal cerrado. */
  servicioId: string | null;
  rol: "cliente" | "transportista";
  /** Nombre de la persona que se califica. */
  nombreCalificado: string;
  onCerrar: () => void;
  /** Se llama tras guardar. tuvoProblema = el cliente reportó un problema. */
  onEnviado: (tuvoProblema: boolean) => void;
};

function Estrellas({
  valor,
  onCambiar,
  etiqueta,
}: {
  valor: number;
  onCambiar: (v: number) => void;
  etiqueta: string;
}) {
  return (
    <View style={styles.bloque}>
      <Text style={styles.pregunta}>{etiqueta}</Text>
      <View style={styles.filaEstrellas} accessibilityRole="adjustable">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onCambiar(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${n} estrella${n > 1 ? "s" : ""}`}
          >
            <Text style={[styles.estrella, n <= valor && styles.estrellaActiva]}>
              ★
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SiNo({
  valor,
  onCambiar,
  etiqueta,
}: {
  valor: boolean | null;
  onCambiar: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <View style={styles.bloque}>
      <Text style={styles.pregunta}>{etiqueta}</Text>
      <View style={styles.filaSiNo}>
        {[true, false].map((opcion) => {
          const activo = valor === opcion;
          return (
            <Pressable
              key={String(opcion)}
              onPress={() => onCambiar(opcion)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[styles.opcion, activo && styles.opcionActiva]}
            >
              <Text style={[styles.textoOpcion, activo && styles.textoOpcionActiva]}>
                {opcion ? "Sí" : "No"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function CalificarServicio({
  servicioId,
  rol,
  nombreCalificado,
  onCerrar,
  onEnviado,
}: Props) {
  const esCliente = rol === "cliente";
  const [estrellas, setEstrellas] = useState(0);
  const [estrellasApp, setEstrellasApp] = useState(0);
  const [recomendaria, setRecomendaria] = useState<boolean | null>(null);
  const [comentario, setComentario] = useState("");
  const [tuvoProblema, setTuvoProblema] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  // El error se muestra dentro del modal: una alerta aparte quedaría detrás.
  const [error, setError] = useState("");

  const limpiar = () => {
    setEstrellas(0);
    setEstrellasApp(0);
    setRecomendaria(null);
    setComentario("");
    setTuvoProblema(null);
    setError("");
  };

  const completo = esCliente
    ? estrellas > 0 && estrellasApp > 0 && recomendaria !== null && tuvoProblema !== null
    : estrellas > 0;

  const enviar = async () => {
    if (!servicioId || !completo) return;
    const datos: DatosCalificacion = {
      estrellas,
      estrellasApp: esCliente ? estrellasApp : null,
      recomendaria: esCliente ? recomendaria : null,
      comentario,
      tuvoProblema: esCliente ? !!tuvoProblema : false,
    };

    setEnviando(true);
    setError("");
    try {
      await calificarServicio(servicioId, datos);
    } catch (e: any) {
      setEnviando(false);
      setError(e?.message || "No se pudo enviar. Inténtalo de nuevo.");
      return;
    }
    setEnviando(false);
    limpiar();
    onEnviado(datos.tuvoProblema);
  };

  const cerrar = () => {
    limpiar();
    onCerrar();
  };

  return (
    <Modal
      visible={!!servicioId}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cerrar}
    >
      <View style={styles.overlay}>
        <View style={styles.contenedor}>
          <ScrollView
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.icono}>{esCliente ? "🎉" : "🤝"}</Text>
            <Text style={styles.titulo}>
              {esCliente ? "¿Qué tal el servicio?" : "Califica al cliente"}
            </Text>
            <Text style={styles.subtitulo}>
              {esCliente
                ? "Tu opinión nos ayuda a mejorar."
                : "Cuéntanos cómo fue trabajar con este cliente."}
            </Text>

            <Estrellas
              etiqueta={`${esCliente ? "Transportista" : "Cliente"}: ${nombreCalificado || "—"}`}
              valor={estrellas}
              onCambiar={setEstrellas}
            />

            {esCliente && (
              <>
                <Estrellas
                  etiqueta="La app Muévelo Ya"
                  valor={estrellasApp}
                  onCambiar={setEstrellasApp}
                />
                <SiNo
                  etiqueta="¿Recomendarías el servicio?"
                  valor={recomendaria}
                  onCambiar={setRecomendaria}
                />
              </>
            )}

            <View style={styles.bloque}>
              <Text style={styles.pregunta}>
                {esCliente ? "¿Alguna sugerencia? (opcional)" : "Comentario (opcional)"}
              </Text>
              <TextInput
                value={comentario}
                onChangeText={setComentario}
                placeholder="Escribe aquí…"
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                maxLength={500}
                style={[
                  styles.input,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
              />
            </View>

            {esCliente && (
              <SiNo
                etiqueta="¿Tuviste algún problema?"
                valor={tuvoProblema}
                onCambiar={setTuvoProblema}
              />
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.botones}>
              <Pressable onPress={cerrar} style={[styles.boton, styles.botonSecundario]}>
                <Text style={styles.textoBoton}>Más tarde</Text>
              </Pressable>
              <Pressable
                onPress={enviar}
                disabled={!completo || enviando}
                style={[styles.boton, styles.botonPrincipal, !completo && styles.inactivo]}
              >
                {enviando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.textoBoton}>Enviar</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contenedor: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "92%",
    backgroundColor: "#161b22",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  contenido: { padding: 22, gap: 16 },
  icono: { fontSize: 34, textAlign: "center" },
  titulo: { color: "#FFFFFF", fontSize: 19, fontWeight: "800", textAlign: "center" },
  subtitulo: { color: "#9BA7BA", fontSize: 13, textAlign: "center", marginTop: -10 },
  bloque: { gap: 8 },
  pregunta: { color: "#E7F0F4", fontSize: 13, fontWeight: "700" },
  filaEstrellas: { flexDirection: "row", gap: 8 },
  estrella: { fontSize: 32, color: "rgba(255,255,255,0.18)" },
  estrellaActiva: { color: "#fbbf24" },
  filaSiNo: { flexDirection: "row", gap: 10 },
  opcion: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  opcionActiva: { backgroundColor: AZUL, borderColor: AZUL },
  textoOpcion: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
  textoOpcionActiva: { color: "#FFFFFF" },
  input: {
    minHeight: 70,
    color: "#FFFFFF",
    fontSize: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0b0e14",
    textAlignVertical: "top",
  },
  botones: { flexDirection: "row", gap: 10, marginTop: 4 },
  boton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  botonSecundario: { backgroundColor: "rgba(255,255,255,0.1)" },
  botonPrincipal: { backgroundColor: AZUL },
  inactivo: { opacity: 0.5 },
  error: { color: "#fca5a5", fontSize: 13, textAlign: "center" },
  textoBoton: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
