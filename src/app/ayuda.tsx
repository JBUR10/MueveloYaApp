// src/app/ayuda.tsx
//
// Centro de ayuda: tutorial guiado de cada parte de la app y preguntas frecuentes.
// El contenido vive en src/constants/ayudaContenido.ts.
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CATEGORIAS_FAQ,
  PREGUNTAS_FRECUENTES,
  SECCIONES_TUTORIAL,
} from "../constants/ayudaContenido";

const AZUL = "#2969e9";
const FONDO = "#111318";
const TARJETA = "rgba(255,255,255,0.06)";
const BORDE = "rgba(255,255,255,0.12)";

type Pestaña = "tutorial" | "faq";

// Todos los pasos en una sola lista para poder avanzar de sección en sección.
const PASOS = SECCIONES_TUTORIAL.flatMap((seccion, indiceSeccion) =>
  seccion.pasos.map((paso, indicePaso) => ({
    ...paso,
    seccionId: seccion.id,
    indiceSeccion,
    indicePaso,
    totalEnSeccion: seccion.pasos.length,
  })),
);

const quitarTildes = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function AyudaScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [pestaña, setPestaña] = useState<Pestaña>(
    tab === "faq" ? "faq" : "tutorial",
  );

  const volver = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <View style={styles.encabezado}>
        <Pressable
          onPress={volver}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.botonVolver}
        >
          <Text style={styles.textoVolver}>←</Text>
        </Pressable>

        <View>
          <Text style={styles.etiquetaSuperior}>CENTRO DE AYUDA</Text>
          <Text style={styles.titulo}>
            ¿Cómo te <Text style={styles.textoAzul}>ayudamos?</Text>
          </Text>
        </View>
      </View>

      <View style={styles.selector}>
        {(
          [
            { id: "tutorial", texto: "Tutorial guiado" },
            { id: "faq", texto: "Preguntas frecuentes" },
          ] as const
        ).map((opcion) => {
          const activa = pestaña === opcion.id;
          return (
            <Pressable
              key={opcion.id}
              onPress={() => setPestaña(opcion.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={[styles.opcionSelector, activa && styles.opcionActiva]}
            >
              <Text
                style={[styles.textoSelector, activa && styles.textoSelectorActivo]}
              >
                {opcion.texto}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {pestaña === "tutorial" ? <Tutorial /> : <PreguntasFrecuentes />}
    </SafeAreaView>
  );
}

/* ───────────────────────── Tutorial guiado ───────────────────────── */

function Tutorial() {
  const router = useRouter();
  const [indice, setIndice] = useState(0);

  const paso = PASOS[indice];
  const seccion = SECCIONES_TUTORIAL[paso.indiceSeccion];
  const esUltimo = indice === PASOS.length - 1;

  const irASeccion = (id: string) => {
    const primero = PASOS.findIndex((p) => p.seccionId === id);
    if (primero >= 0) setIndice(primero);
  };

  return (
    <View style={styles.flex}>
      {/* Secciones del sistema */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filaChips}
        contentContainerStyle={styles.contenidoChips}
      >
        {SECCIONES_TUTORIAL.map((s) => {
          const activa = s.id === paso.seccionId;
          return (
            <Pressable
              key={s.id}
              onPress={() => irASeccion(s.id)}
              style={[styles.chip, activa && styles.chipActivo]}
            >
              <Text style={styles.chipIcono}>{s.icono}</Text>
              <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]}>
                {s.nombre}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contenidoScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Progreso dentro de la sección */}
        <View style={styles.progreso}>
          {Array.from({ length: paso.totalEnSeccion }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.segmento,
                i <= paso.indicePaso && styles.segmentoLleno,
              ]}
            />
          ))}
        </View>
        <Text style={styles.contadorPaso}>
          {seccion.nombre.toUpperCase()} · PASO {paso.indicePaso + 1} DE{" "}
          {paso.totalEnSeccion}
        </Text>

        <View style={styles.tarjetaPaso}>
          <View style={styles.iconoPaso}>
            <Text style={styles.iconoPasoTexto}>{seccion.icono}</Text>
          </View>

          <Text style={styles.tituloPaso}>{paso.titulo}</Text>
          <Text style={styles.textoPaso}>{paso.texto}</Text>

          {paso.consejos?.map((consejo) => (
            <View key={consejo} style={styles.consejo}>
              <Text style={styles.consejoIcono}>💡</Text>
              <Text style={styles.consejoTexto}>{consejo}</Text>
            </View>
          ))}

          {paso.ruta ? (
            <Pressable
              onPress={() => router.push(paso.ruta as Href)}
              style={styles.botonIr}
            >
              <Text style={styles.textoIr}>Ir a {seccion.nombre} ›</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Navegación del tutorial */}
      <View style={styles.navegacion}>
        <Pressable
          onPress={() => setIndice((i) => Math.max(0, i - 1))}
          disabled={indice === 0}
          style={[styles.botonAnterior, indice === 0 && styles.deshabilitado]}
        >
          <Text style={styles.textoAnterior}>← Anterior</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (esUltimo) router.replace("/");
            else setIndice((i) => i + 1);
          }}
          style={styles.botonSiguiente}
        >
          <Text style={styles.textoSiguiente}>
            {esUltimo ? "Terminar" : "Siguiente →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ───────────────────────── Preguntas frecuentes ───────────────────────── */

function PreguntasFrecuentes() {
  const [categoria, setCategoria] =
    useState<(typeof CATEGORIAS_FAQ)[number]>("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termino = quitarTildes(busqueda.trim());
    return PREGUNTAS_FRECUENTES.filter((p) => {
      if (categoria !== "Todas" && p.categoria !== categoria) return false;
      if (!termino) return true;
      return quitarTildes(`${p.pregunta} ${p.respuesta}`).includes(termino);
    });
  }, [categoria, busqueda]);

  return (
    <View style={styles.flex}>
      <View style={styles.contenedorBusqueda}>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar una pregunta…"
          placeholderTextColor="rgba(255,255,255,0.45)"
          style={styles.campoBusqueda}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filaChips}
        contentContainerStyle={styles.contenidoChips}
      >
        {CATEGORIAS_FAQ.map((c) => {
          const activa = c === categoria;
          return (
            <Pressable
              key={c}
              onPress={() => setCategoria(c)}
              style={[styles.chip, activa && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contenidoScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtradas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>Sin resultados</Text>
            <Text style={styles.vacioTexto}>
              Prueba con otras palabras o revisa el tutorial guiado.
            </Text>
          </View>
        ) : (
          filtradas.map((p) => {
            const estaAbierta = abierta === p.pregunta;
            return (
              <Pressable
                key={p.pregunta}
                onPress={() => setAbierta(estaAbierta ? null : p.pregunta)}
                accessibilityRole="button"
                accessibilityState={{ expanded: estaAbierta }}
                style={styles.pregunta}
              >
                <View style={styles.filaPregunta}>
                  <Text style={styles.textoPregunta}>{p.pregunta}</Text>
                  <Text style={styles.flecha}>{estaAbierta ? "−" : "+"}</Text>
                </View>
                {estaAbierta ? (
                  <Text style={styles.respuesta}>{p.respuesta}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: FONDO },

  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  botonVolver: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TARJETA,
    borderWidth: 1,
    borderColor: BORDE,
  },
  textoVolver: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  etiquetaSuperior: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  titulo: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  textoAzul: { color: AZUL },

  selector: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 16,
    backgroundColor: TARJETA,
    borderWidth: 1,
    borderColor: BORDE,
  },
  opcionSelector: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  opcionActiva: { backgroundColor: AZUL },
  textoSelector: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "700",
  },
  textoSelectorActivo: { color: "#FFFFFF" },

  filaChips: { flexGrow: 0, marginTop: 14 },
  contenidoChips: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: TARJETA,
    borderWidth: 1,
    borderColor: BORDE,
  },
  chipActivo: { backgroundColor: "rgba(41,105,233,0.22)", borderColor: AZUL },
  chipIcono: { color: "#FFFFFF", fontSize: 13 },
  chipTexto: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700" },
  chipTextoActivo: { color: "#FFFFFF" },

  contenidoScroll: { padding: 20, paddingBottom: 28 },

  progreso: { flexDirection: "row", gap: 6 },
  segmento: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  segmentoLleno: { backgroundColor: AZUL },
  contadorPaso: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 14,
  },

  tarjetaPaso: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: TARJETA,
    borderWidth: 1,
    borderColor: BORDE,
  },
  iconoPaso: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41,105,233,0.2)",
    marginBottom: 16,
  },
  iconoPasoTexto: { color: "#FFFFFF", fontSize: 24 },
  tituloPaso: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  textoPaso: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 10,
  },
  consejo: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  consejoIcono: { fontSize: 13 },
  consejoTexto: {
    flex: 1,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  botonIr: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AZUL,
  },
  textoIr: { color: "#8DB2FF", fontSize: 13.5, fontWeight: "800" },

  navegacion: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  botonAnterior: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  deshabilitado: { opacity: 0.35 },
  textoAnterior: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  botonSiguiente: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
  },
  textoSiguiente: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },

  contenedorBusqueda: { paddingHorizontal: 20, marginTop: 14 },
  campoBusqueda: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontSize: 14,
    backgroundColor: TARJETA,
    borderWidth: 1,
    borderColor: BORDE,
  },

  pregunta: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: TARJETA,
    borderWidth: 1,
    borderColor: BORDE,
  },
  filaPregunta: { flexDirection: "row", alignItems: "center", gap: 12 },
  textoPregunta: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
    lineHeight: 20,
  },
  flecha: { color: "#8DB2FF", fontSize: 22, fontWeight: "700" },
  respuesta: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  vacio: { alignItems: "center", paddingVertical: 40 },
  vacioTitulo: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  vacioTexto: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
});
