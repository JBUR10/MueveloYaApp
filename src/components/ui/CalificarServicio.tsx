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
  View,
} from "react-native";
import { Text, TextInput } from "./Texto";

import {
  calificarServicio,
  DatosCalificacion,
} from "../../services/calificacionService";
import Icono from "./Icono";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

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
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
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
            <Icono
              nombre={n <= valor ? "star" : "star-outline"}
              tamano={36}
              color={n <= valor ? p.estrella : p.textoAlfa(0.35)}
            />
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
  const styles = useEstilos(crearEstilos);
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
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
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
            <Icono
              nombre={esCliente ? "happy-outline" : "people-outline"}
              tamano={44}
              color={p.texto}
              style={styles.icono}
            />
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
                placeholderTextColor={p.textoAlfa(0.35)}
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
                  <Text style={[styles.textoBoton, styles.textoBotonAcento]}>Enviar</Text>
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
  contenido: { padding: 22, gap: 16 },
  icono: { textAlign: "center", alignSelf: "center" },
  titulo: { color: p.texto, fontSize: 19, fontWeight: "800", textAlign: "center" },
  subtitulo: { color: p.textoTenue, fontSize: 13, textAlign: "center", marginTop: -10 },
  bloque: { gap: 8 },
  pregunta: { color: p.textoSuave, fontSize: 13, fontWeight: "700" },
  filaEstrellas: { flexDirection: "row", gap: 8 },
  filaSiNo: { flexDirection: "row", gap: 10 },
  opcion: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.velo(0.04),
  },
  opcionActiva: { backgroundColor: AZUL, borderColor: AZUL },
  textoOpcion: { color: p.textoAlfa(0.75), fontWeight: "700" },
  textoOpcionActiva: { color: "#FFFFFF" },
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
  botones: { flexDirection: "row", gap: 10, marginTop: 4 },
  boton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  botonSecundario: { backgroundColor: p.velo(0.1) },
  botonPrincipal: { backgroundColor: AZUL },
  inactivo: { opacity: 0.5 },
  error: { color: p.textoError, fontSize: 13, textAlign: "center" },
  textoBoton: { color: p.texto, fontWeight: "800", fontSize: 14 },
  // "Enviar" va sobre el botón azul sólido: texto blanco.
  textoBotonAcento: { color: "#FFFFFF" },
});
