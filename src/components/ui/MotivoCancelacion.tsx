// src/components/ui/MotivoCancelacion.tsx
//
// Al cancelar un servicio aceptado o programado hay que dar un motivo:
// se elige de la lista o se escribe en "Otro". El motivo le llega a la otra
// persona en la notificación y queda en el historial.
import { useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "./Texto";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const MOTIVOS = {
  conductor: [
    "No tengo disponibilidad",
    "Problema con el vehículo",
    "Calamidad o emergencia",
    "El servicio no es lo que esperaba",
  ],
  usuario: [
    "Cambio de fecha",
    "Ya no necesito el servicio",
    "Conseguí otra opción",
    "Error en los datos de la solicitud",
  ],
} as const;

const OTRO = "Otro";
const MINIMO_OTRO = 5;

type Props = {
  /** true = el modal está abierto. */
  visible: boolean;
  /** Quién cancela: cambia la lista de motivos. */
  rol: "conductor" | "usuario";
  onCerrar: () => void;
  /** Recibe el motivo final. Si lanza un error, se muestra dentro del modal. */
  onConfirmar: (motivo: string) => Promise<void>;
};

export default function MotivoCancelacion({
  visible,
  rol,
  onCerrar,
  onConfirmar,
}: Props) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const [elegido, setElegido] = useState<string | null>(null);
  const [otro, setOtro] = useState("");
  const [enviando, setEnviando] = useState(false);
  // El error se muestra dentro del modal: una alerta aparte quedaría detrás.
  const [error, setError] = useState("");
  const id = useId().replace(/:/g, "");
  const tituloId = `motivo-cancelacion-titulo-${id}`;
  const subtituloId = `motivo-cancelacion-descripcion-${id}`;
  const otroId = `motivo-cancelacion-otro-${id}`;
  const primerMotivo = useRef<View>(null);

  const motivo = elegido === OTRO ? otro.trim() : elegido;
  const valido =
    !!elegido && (elegido !== OTRO || otro.trim().length >= MINIMO_OTRO);

  const limpiar = () => {
    setElegido(null);
    setOtro("");
    setError("");
  };

  const cerrar = () => {
    if (enviando) return;
    limpiar();
    onCerrar();
  };

  const confirmar = async () => {
    if (!valido || !motivo) return;
    setEnviando(true);
    setError("");
    try {
      await onConfirmar(motivo);
      limpiar();
    } catch (e: any) {
      setError(e?.message || "No se pudo cancelar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const enfocarPrimerMotivo = () => {
    if (Platform.OS === "web" || !primerMotivo.current) return;
    const etiqueta = findNodeHandle(primerMotivo.current);
    if (etiqueta !== null) AccessibilityInfo.setAccessibilityFocus(etiqueta);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityLabelledBy={tituloId}
      aria-labelledby={tituloId}
      {...(Platform.OS === "web"
        ? { "aria-describedby": subtituloId }
        : {})}
      accessibilityHint="Elige un motivo y confirma la cancelación."
      onShow={enfocarPrimerMotivo}
      onRequestClose={cerrar}
    >
      <View
        style={styles.overlay}
        accessibilityViewIsModal
        aria-modal
      >
        <View style={styles.contenedor}>
          <ScrollView
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text
              nativeID={tituloId}
              accessibilityRole="header"
              style={styles.titulo}
            >
              ¿Por qué cancelas?
            </Text>
            <Text nativeID={subtituloId} style={styles.subtitulo}>
              {rol === "conductor"
                ? "Le contaremos el motivo al usuario y su solicitud volverá a estar disponible para otros transportistas."
                : "Le contaremos el motivo al transportista."}
            </Text>

            <View
              style={styles.grupoMotivos}
              accessibilityRole="radiogroup"
              accessibilityLabelledBy={tituloId}
              aria-labelledby={tituloId}
            >
              {[...MOTIVOS[rol], OTRO].map((opcion, indice) => {
                const activo = elegido === opcion;
                return (
                  <Pressable
                    key={opcion}
                    ref={indice === 0 ? primerMotivo : undefined}
                    onPress={() => {
                      setElegido(opcion);
                      setError("");
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: activo }}
                    accessibilityLabel={opcion}
                    style={[styles.opcion, activo && styles.opcionActiva]}
                  >
                    <View style={[styles.radio, activo && styles.radioActivo]}>
                      {activo && <View style={styles.radioPunto} />}
                    </View>
                    <Text style={styles.textoOpcion}>{opcion}</Text>
                  </Pressable>
                );
              })}
            </View>

            {elegido === OTRO && (
              <>
                <Text nativeID={otroId} style={styles.textoOpcion}>
                  Motivo adicional (obligatorio)
                </Text>
                <TextInput
                  nativeID={`motivo-cancelacion-input-${id}`}
                  accessibilityLabelledBy={otroId}
                  aria-labelledby={otroId}
                  accessibilityHint="Escribe al menos cinco caracteres."
                  aria-required
                  value={otro}
                  onChangeText={setOtro}
                  placeholder="Escribe el motivo…"
                  placeholderTextColor={p.textoAlfa(0.35)}
                  multiline
                  maxLength={200}
                  autoFocus
                  style={[
                    styles.input,
                    Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                  ]}
                />
              </>
            )}

            {!!error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                aria-live="assertive"
                style={styles.error}
              >
                {error}
              </Text>
            )}

            <View style={styles.botones}>
              <Pressable
                onPress={cerrar}
                style={[styles.boton, styles.botonSecundario]}
                accessibilityRole="button"
              >
                <Text style={styles.textoBoton}>Volver</Text>
              </Pressable>
              <Pressable
                onPress={confirmar}
                disabled={!valido || enviando}
                style={[styles.boton, styles.botonCancelar, !valido && styles.inactivo]}
                accessibilityRole="button"
                accessibilityLabel={enviando ? "Cancelando servicio" : "Cancelar servicio"}
                accessibilityState={{ disabled: !valido || enviando, busy: enviando }}
              >
                {enviando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.textoBoton, styles.textoBotonAcento]}>
                      Cancelar servicio
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

const crearEstilos = (p: Paleta) => StyleSheet.create({
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
    backgroundColor: p.superficie,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: p.bordeFuerte,
  },
  contenido: { padding: 22, gap: 10 },
  titulo: { color: p.texto, fontSize: 19, fontWeight: "800", textAlign: "center" },
  subtitulo: {
    color: p.textoTenue,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 6,
  },
  grupoMotivos: { gap: 10 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.linea(0.12),
    backgroundColor: p.velo(0.03),
  },
  opcionActiva: {
    borderColor: "rgba(239,68,68,0.6)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: p.linea(0.35),
    alignItems: "center",
    justifyContent: "center",
  },
  radioActivo: { borderColor: "#ef4444" },
  radioPunto: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.rellenoError },
  textoOpcion: { color: p.textoSuave, fontSize: 14, fontWeight: "600", flex: 1 },
  input: {
    minHeight: 70,
    color: p.texto,
    fontSize: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.bordeCampo,
    backgroundColor: p.fondoProfundo,
    textAlignVertical: "top",
  },
  error: { color: p.textoError, fontSize: 13, textAlign: "center" },
  botones: { flexDirection: "row", gap: 10, marginTop: 8 },
  boton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  botonSecundario: { backgroundColor: p.velo(0.1) },
  botonCancelar: { backgroundColor: p.rellenoError },
  inactivo: { opacity: 0.5 },
  textoBoton: { color: p.texto, fontWeight: "800", fontSize: 14 },
  // "Cancelar servicio" va sobre el botón rojo sólido: texto blanco.
  textoBotonAcento: { color: "#FFFFFF" },
});
