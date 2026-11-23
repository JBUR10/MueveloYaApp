// src/app/queja.tsx
// Formulario de quejas. Se abre cuando el cliente marca que tuvo un problema
// al calificar (?servicio=<id>), y se guarda en la tabla "quejas".
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";

import { BotonPrincipal } from "../components/auth/FormularioAuth";
import { aviso } from "../components/ui/AlertaPantalla";
import { enviarQueja, TIPOS_QUEJA } from "../services/calificacionService";
import TextoIcono from "../components/ui/TextoIcono";
import { usePaleta, useEstilos, type Paleta } from "../services/temaStore";

const AZUL = "#2969e9";

export default function QuejaScreen() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const router = useRouter();
  const { servicio } = useLocalSearchParams<{ servicio?: string }>();
  const [tipo, setTipo] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState<{ tipo?: string; descripcion?: string }>({});
  const [enviando, setEnviando] = useState(false);

  const volver = () =>
    router.canGoBack() ? router.back() : router.replace("/solicitudes");

  const enviar = async () => {
    const nuevos: typeof errores = {};
    if (!tipo) nuevos.tipo = "Elige el tipo de problema.";
    if (descripcion.trim().length < 10)
      nuevos.descripcion = "Cuéntanos qué pasó (mínimo 10 caracteres).";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    try {
      await enviarQueja(servicio ?? null, tipo!, descripcion);
    } catch (e: any) {
      setEnviando(false);
      await aviso("Error", e?.message || "No se pudo enviar.", "error");
      return;
    }
    setEnviando(false);

    await aviso(
      "Queja recibida",
      "Lamentamos lo ocurrido. Revisaremos tu caso y te contactaremos por teléfono o correo. ¡Gracias por ayudarnos a mejorar!",
      "exito",
    );
    volver();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={p.barraEstado} />
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={volver} style={styles.btnBack}>
            <TextoIcono icono="arrow-back" style={styles.btnBackText}>
              Volver
            </TextoIcono>
          </Pressable>
        </View>

        <Text style={styles.subtitulo}>SOPORTE</Text>
        <Text style={styles.titulo}>
          Reportar un <Text style={styles.azul}>problema</Text>
        </Text>
        <Text style={styles.descripcion}>
          Cuéntanos qué pasó con tu servicio para poder ayudarte.
        </Text>

        <View style={styles.tarjeta}>
          <Text style={styles.etiqueta}>Tipo de problema</Text>
          <View style={styles.chips}>
            {TIPOS_QUEJA.map((t) => {
              const activo = tipo === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    setTipo(t);
                    setErrores((e) => ({ ...e, tipo: undefined }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  style={[styles.chip, activo && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!!errores.tipo && <Text style={styles.error}>{errores.tipo}</Text>}

          <Text style={styles.etiqueta}>¿Qué pasó?</Text>
          <TextInput
            value={descripcion}
            onChangeText={(t) => {
              setDescripcion(t);
              setErrores((e) => ({ ...e, descripcion: undefined }));
            }}
            placeholder="Describe el problema con el mayor detalle posible…"
            placeholderTextColor={p.textoAlfa(0.35)}
            multiline
            maxLength={1000}
            style={[
              styles.input,
              !!errores.descripcion && styles.inputError,
              Platform.OS === "web" && ({ outlineStyle: "none" } as any),
            ]}
          />
          {!!errores.descripcion && (
            <Text style={styles.error}>{errores.descripcion}</Text>
          )}
        </View>

        <BotonPrincipal texto="Enviar queja" onPress={enviar} cargando={enviando} />
      </ScrollView>
    </SafeAreaView>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: p.fondo },
  contenido: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },
  topBar: { flexDirection: "row" },
  btnBack: {
    backgroundColor: p.velo(0.1),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnBackText: { color: p.texto, fontWeight: "700", fontSize: 13 },
  subtitulo: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: -12,
  },
  titulo: { color: p.textoTitulo, fontSize: 28, fontWeight: "900" },
  azul: { color: AZUL },
  descripcion: { color: p.textoTenue, fontSize: 13, lineHeight: 19, marginTop: -8 },
  tarjeta: {
    padding: 16,
    gap: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  etiqueta: { color: p.textoAlfa(0.7), fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.velo(0.04),
  },
  chipActivo: { backgroundColor: AZUL, borderColor: AZUL },
  chipTexto: { color: p.textoAlfa(0.75), fontSize: 13, fontWeight: "700" },
  chipTextoActivo: { color: "#FFFFFF" },
  input: {
    minHeight: 120,
    color: p.texto,
    fontSize: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.bordeCampo,
    backgroundColor: p.fondoProfundo,
    textAlignVertical: "top",
  },
  inputError: { borderColor: "rgba(239,68,68,0.7)" },
  error: { color: p.textoError, fontSize: 11, marginTop: -6 },
});
