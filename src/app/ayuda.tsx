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
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CATEGORIAS_FAQ,
  PREGUNTAS_FRECUENTES,
  SECCIONES_TUTORIAL,
} from "../constants/ayudaContenido";
import Icono from "../components/ui/Icono";
import TextoIcono from "../components/ui/TextoIcono";
import { usePaleta, useEstilos, type Paleta } from "../services/temaStore";

const AZUL = "#2969e9";

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
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
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
      <StatusBar barStyle={p.barraEstado} backgroundColor={p.fondo} />

      <View style={styles.encabezado}>
        <Pressable
          onPress={volver}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.botonVolver}
        >
          <Icono nombre="arrow-back" tamano={20} color={p.texto} />
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
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
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
              <Icono
                nombre={s.icono}
                tamano={16}
                color={activa ? p.texto : p.textoAlfa(0.65)}
              />
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
            <Icono nombre={seccion.icono} tamano={26} color={p.texto} />
          </View>

          <Text style={styles.tituloPaso}>{paso.titulo}</Text>
          <Text style={styles.textoPaso}>{paso.texto}</Text>

          {paso.consejos?.map((consejo) => (
            <View key={consejo} style={styles.consejo}>
              <Icono nombre="bulb-outline" tamano={16} color={p.estrella} style={styles.consejoIcono} />
              <Text style={styles.consejoTexto}>{consejo}</Text>
            </View>
          ))}

          {paso.ruta ? (
            <Pressable
              onPress={() => router.push(paso.ruta as Href)}
              style={styles.botonIr}
            >
              <TextoIcono icono="chevron-forward" alFinal style={styles.textoIr}>
                Ir a {seccion.nombre}
              </TextoIcono>
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
          <TextoIcono icono="arrow-back" style={styles.textoAnterior}>
            Anterior
          </TextoIcono>
        </Pressable>

        <Pressable
          onPress={() => {
            if (esUltimo) router.replace("/");
            else setIndice((i) => i + 1);
          }}
          style={styles.botonSiguiente}
        >
          <TextoIcono
            icono={esUltimo ? "checkmark" : "arrow-forward"}
            alFinal
            style={styles.textoSiguiente}
          >
            {esUltimo ? "Terminar" : "Siguiente"}
          </TextoIcono>
        </Pressable>
      </View>
    </View>
  );
}

/* ───────────────────────── Preguntas frecuentes ───────────────────────── */

function PreguntasFrecuentes() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
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
          placeholderTextColor={p.textoAlfa(0.45)}
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

const crearEstilos = (p: Paleta) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: p.fondo },

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
    backgroundColor: p.velo(0.06),
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },
  etiquetaSuperior: {
    color: p.textoAlfa(0.55),
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  titulo: {
    color: p.texto,
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
    backgroundColor: p.velo(0.06),
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },
  opcionSelector: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  opcionActiva: { backgroundColor: AZUL },
  textoSelector: {
    color: p.textoAlfa(0.6),
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
    backgroundColor: p.velo(0.06),
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },
  chipActivo: { backgroundColor: "rgba(41,105,233,0.22)", borderColor: AZUL },
  chipTexto: { color: p.textoAlfa(0.65), fontSize: 13, fontWeight: "700" },
  chipTextoActivo: { color: p.texto },

  contenidoScroll: { padding: 20, paddingBottom: 28 },

  progreso: { flexDirection: "row", gap: 6 },
  segmento: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: p.velo(0.14),
  },
  segmentoLleno: { backgroundColor: AZUL },
  contadorPaso: {
    color: p.textoAlfa(0.55),
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 14,
  },

  tarjetaPaso: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: p.velo(0.06),
    borderWidth: 1,
    borderColor: p.linea(0.12),
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
  tituloPaso: {
    color: p.texto,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  textoPaso: {
    color: p.textoAlfa(0.78),
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
  consejoIcono: { marginTop: 2 },
  consejoTexto: {
    flex: 1,
    color: p.textoAlfa(0.82),
    fontSize: 13,
    lineHeight: 19,
  },
  botonIr: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AZUL,
  },
  textoIr: { color: p.acento, fontSize: 13.5, fontWeight: "800" },

  navegacion: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  botonAnterior: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.velo(0.1),
  },
  deshabilitado: { opacity: 0.35 },
  textoAnterior: { color: p.texto, fontWeight: "700", fontSize: 14 },
  botonSiguiente: {
    flex: 2,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
  },
  textoSiguiente: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },

  contenedorBusqueda: { paddingHorizontal: 20, marginTop: 14 },
  campoBusqueda: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: p.texto,
    fontSize: 14,
    backgroundColor: p.velo(0.06),
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },

  pregunta: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: p.velo(0.06),
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },
  filaPregunta: { flexDirection: "row", alignItems: "center", gap: 12 },
  textoPregunta: {
    flex: 1,
    color: p.texto,
    fontSize: 14.5,
    fontWeight: "700",
    lineHeight: 20,
  },
  flecha: { color: p.acento, fontSize: 22, fontWeight: "700" },
  respuesta: {
    color: p.textoAlfa(0.78),
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  vacio: { alignItems: "center", paddingVertical: 40 },
  vacioTitulo: { color: p.texto, fontSize: 16, fontWeight: "800" },
  vacioTexto: {
    color: p.textoAlfa(0.6),
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
});
