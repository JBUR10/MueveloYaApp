import { useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "./Texto";
import { useEstilos, type Paleta } from "../../services/temaStore";

type SistemaGuia = "windows" | "macos" | "otro";

const ENLACES = {
  android: "https://support.google.com/accessibility/android/answer/6007100?hl=es-419",
  windows:
    "https://support.microsoft.com/en-us/accessibility/windows/narrator/complete-guide-to-narrator",
  macos: "https://support.apple.com/guide/mac-help/turn-on-voiceover-mchlp2940/mac",
} as const;

const SISTEMAS: { id: SistemaGuia; nombre: string }[] = [
  { id: "windows", nombre: "Windows" },
  { id: "macos", nombre: "macOS" },
  { id: "otro", nombre: "Android / iOS" },
];

export default function GuiaLectoresPantalla() {
  const styles = useEstilos(crearEstilos);
  const id = useId().replace(/:/g, "");
  const tituloId = `guia-lector-titulo-${id}`;
  const descripcionId = `guia-lector-descripcion-${id}`;
  const instruccionesId = `guia-lector-instrucciones-${id}`;
  const tituloRef = useRef<View>(null);
  const botonAbrirRef = useRef<View>(null);
  const abiertaAnteriormente = useRef(false);
  const [abierta, setAbierta] = useState(false);
  const [sistema, setSistema] = useState<SistemaGuia | null>(null);
  /** Cuenta las veces que se elige un sistema, aunque se repita el mismo. */
  const [eleccion, setEleccion] = useState(0);
  const [errorEnlace, setErrorEnlace] = useState("");

  // Solo web. onShow llega antes de que react-native-web marque el contenedor
  // como diálogo: si se enfoca ya el título, el lector no anuncia la apertura.
  // Por eso se hace enfocable el contenedor y react-native-web, justo después de
  // marcarlo, le da el foco (una sola vez: nombre y descripción del diálogo).
  const prepararDialogoWeb = () => {
    const dialogo = document
      .getElementById(tituloId)
      ?.closest<HTMLElement>('[aria-modal="true"]');
    if (!dialogo) return;
    dialogo.tabIndex = -1;
    dialogo.style.outline = "none";
    // Al pasar a un control interior, el contenedor deja de ser enfocable.
    const alAvanzar = (evento: FocusEvent) => {
      if (evento.target === dialogo) return;
      dialogo.removeAttribute("tabindex");
      dialogo.removeEventListener("focusin", alAvanzar);
    };
    dialogo.addEventListener("focusin", alAvanzar);
  };

  const enfocarTitulo = () => {
    if (Platform.OS === "web") {
      if (typeof document !== "undefined") prepararDialogoWeb();
      return;
    }
    if (!tituloRef.current) return;
    const etiqueta = findNodeHandle(tituloRef.current);
    if (etiqueta !== null) AccessibilityInfo.setAccessibilityFocus(etiqueta);
  };

  useEffect(() => {
    if (abierta) {
      abiertaAnteriormente.current = true;
      return;
    }
    if (!abiertaAnteriormente.current) return;

    abiertaAnteriormente.current = false;
    if (Platform.OS === "web") return;
    const temporizador = setTimeout(() => {
      const etiqueta = findNodeHandle(botonAbrirRef.current);
      if (etiqueta !== null) AccessibilityInfo.setAccessibilityFocus(etiqueta);
    }, 250);
    return () => clearTimeout(temporizador);
  }, [abierta]);

  const elegirSistema = (nuevo: SistemaGuia) => {
    setSistema(nuevo);
    setEleccion((n) => n + 1);
  };

  // Solo web: tras elegir un sistema, lleva el foco al título de sus
  // instrucciones para seguir leyendo desde ahí.
  useEffect(() => {
    if (Platform.OS !== "web" || eleccion === 0) return;
    document.getElementById(instruccionesId)?.focus();
  }, [eleccion, instruccionesId]);

  const tituloInstrucciones = (texto: string) => (
    <Text
      nativeID={instruccionesId}
      accessibilityRole="header"
      style={styles.subtitulo}
      {...({ tabIndex: -1, "aria-level": 2 } as object)}
    >
      {texto}
    </Text>
  );

  const abrirEnlace = (url: string) => {
    setErrorEnlace("");
    void Linking.openURL(url).catch((error: unknown) => {
      console.error("No se pudo abrir la guía oficial de accesibilidad.", error);
      setErrorEnlace(
        "No pudimos abrir la guía oficial. Comprueba tu conexión e inténtalo de nuevo.",
      );
    });
  };

  const enlace = (texto: string, url: string) => (
    <Pressable
      onPress={() => abrirEnlace(url)}
      accessibilityRole="link"
      accessibilityLabel={texto}
      accessibilityHint="Abre instrucciones oficiales en el navegador."
      style={({ pressed }) => [styles.enlace, pressed && styles.presionado]}
    >
      <Text style={styles.textoEnlace}>{texto}</Text>
    </Pressable>
  );

  return (
    <>
      <Text style={styles.tituloSeccion}>Accesibilidad</Text>
      <View style={styles.tarjeta}>
        <View style={styles.textoPrincipal}>
          <Text style={styles.tituloApartado}>Lector de pantalla</Text>
          <Text style={styles.descripcion}>
            Permite utilizar MueveloYa con herramientas que leen en voz alta los
            elementos de la pantalla para facilitar la navegación a personas con
            discapacidad visual
          </Text>
        </View>
        <Pressable
          ref={botonAbrirRef}
          onPress={() => setAbierta(true)}
          accessibilityRole="button"
          accessibilityHint="Abre una guía para activar el lector de pantalla de tu dispositivo."
          style={({ pressed }) => [
            styles.boton,
            pressed && styles.presionado,
          ]}
        >
          <Text style={styles.textoBoton}>¿Cómo activarlo?</Text>
        </Pressable>
      </View>

      <Modal
        visible={abierta}
        transparent
        animationType="fade"
        statusBarTranslucent
        role="dialog"
        accessibilityLabelledBy={tituloId}
        aria-labelledby={tituloId}
        accessibilityHint="Instrucciones para activar un lector de pantalla."
        {...(Platform.OS === "web"
          ? { "aria-describedby": descripcionId }
          : {})}
        onShow={enfocarTitulo}
        onRequestClose={() => setAbierta(false)}
      >
        <View
          style={styles.overlay}
          accessibilityViewIsModal
        >
          <View style={styles.dialogo}>
            <ScrollView
              contentContainerStyle={styles.contenido}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              <View
                ref={tituloRef}
                nativeID={tituloId}
                tabIndex={-1}
                accessible
                accessibilityRole="header"
                accessibilityLabel="¿Cómo activar un lector de pantalla?"
              >
                <Text style={styles.tituloDialogo}>
                  ¿Cómo activar un lector de pantalla?
                </Text>
              </View>
              <Text nativeID={descripcionId} style={styles.descripcion}>
                Sigue los pasos para tu dispositivo. Esta guía no cambia los
                ajustes del sistema.
              </Text>

              {Platform.OS === "android" ? (
                <>
                  <Text style={styles.subtitulo}>Android · TalkBack</Text>
                  <View style={styles.lista}>
                    <Text style={styles.paso}>
                      1. Abre Ajustes en tu dispositivo.
                    </Text>
                    <Text style={styles.paso}>
                      2. Entra en Accesibilidad y selecciona TalkBack.
                    </Text>
                    <Text style={styles.paso}>
                      3. Activa Usar TalkBack y confirma el mensaje del sistema.
                    </Text>
                  </View>
                  <Text style={styles.nota}>
                    Los nombres y las rutas pueden variar según el fabricante y
                    la versión de Android.
                  </Text>
                  {enlace(
                    "Ayuda oficial de Google: activar TalkBack",
                    ENLACES.android,
                  )}
                </>
              ) : Platform.OS === "web" ? (
                <>
                  <Text style={styles.subtitulo}>
                    Selecciona el sistema operativo
                  </Text>
                  <View
                    style={styles.opciones}
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Sistema operativo para las instrucciones"
                  >
                    {SISTEMAS.map((opcion) => {
                      const seleccionada = sistema === opcion.id;
                      return (
                        <Pressable
                          key={opcion.id}
                          onPress={() => elegirSistema(opcion.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: seleccionada }}
                          // En web solo llega al navegador con aria-checked.
                          aria-checked={seleccionada}
                          // react-native-web no activa los radios con Espacio.
                          {...({
                            onKeyDown: (evento: KeyboardEvent) => {
                              if (evento.key !== " ") return;
                              evento.preventDefault();
                              elegirSistema(opcion.id);
                            },
                          } as object)}
                          accessibilityLabel={opcion.nombre}
                          style={[
                            styles.opcion,
                            seleccionada && styles.opcionSeleccionada,
                          ]}
                        >
                          <Text
                            style={[
                              styles.textoOpcion,
                              seleccionada && styles.textoOpcionSeleccionada,
                            ]}
                          >
                            {opcion.nombre}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {sistema === "windows" ? (
                    <>
                      {tituloInstrucciones("Windows · Narrador")}
                      <View style={styles.lista}>
                        <Text style={styles.paso}>
                          1. Abre Inicio &gt; Configuración &gt; Accesibilidad &gt;
                          Narrador y actívalo.
                        </Text>
                        <Text style={styles.paso}>
                          2. También puedes usar Windows + Ctrl + Enter para
                          activarlo o desactivarlo.
                        </Text>
                      </View>
                      {enlace(
                        "Guía oficial de Microsoft sobre Narrador",
                        ENLACES.windows,
                      )}
                    </>
                  ) : sistema === "macos" ? (
                    <>
                      {tituloInstrucciones("macOS · VoiceOver")}
                      <View style={styles.lista}>
                        <Text style={styles.paso}>
                          1. Abre el menú Apple &gt; Configuración del Sistema
                          &gt; Accesibilidad &gt; VoiceOver y actívalo.
                        </Text>
                        <Text style={styles.paso}>
                          2. También puedes pulsar Command + F5.
                        </Text>
                      </View>
                      {enlace(
                        "Guía oficial de Apple para activar VoiceOver",
                        ENLACES.macos,
                      )}
                    </>
                  ) : sistema === "otro" ? (
                    <>
                      {tituloInstrucciones("Instrucciones para Android y iOS")}
                      <Text style={styles.paso}>
                        Consulta cómo activar el lector de pantalla en
                        dispositivos Android y Apple, como iPhone y iPad.
                      </Text>
                      <Text style={styles.paso}>
                        Abre los ajustes de accesibilidad del dispositivo y
                        busca la opción de lector de pantalla. El nombre y los
                        pasos dependen del sistema y del fabricante.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.nota}>
                      Elige una opción para ver las instrucciones
                      correspondientes.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.subtitulo}>
                    Lector de pantalla del dispositivo
                  </Text>
                  <Text style={styles.paso}>
                    Abre los ajustes de accesibilidad del dispositivo y consulta
                    las instrucciones oficiales de su sistema operativo.
                  </Text>
                </>
              )}

              {!!errorEnlace && (
                <Text
                  style={styles.error}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  aria-live="assertive"
                >
                  {errorEnlace}
                </Text>
              )}

              <Pressable
                onPress={() => setAbierta(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar guía de accesibilidad"
                style={({ pressed }) => [
                  styles.botonCerrar,
                  pressed && styles.presionado,
                ]}
              >
                <Text style={styles.textoBoton}>Cerrar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    tituloSeccion: {
      color: p.textoFuerte2,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 6,
    },
    tarjeta: {
      padding: 16,
      gap: 14,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: p.linea(0.15),
      backgroundColor: p.panel(0.94),
    },
    textoPrincipal: { gap: 5 },
    tituloApartado: { color: p.texto, fontSize: 15, fontWeight: "800" },
    descripcion: { color: p.textoTenue, fontSize: 13, lineHeight: 19 },
    boton: {
      alignSelf: "flex-start",
      paddingHorizontal: 15,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: "#2969e9",
    },
    textoBoton: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: "rgba(0,0,0,0.72)",
    },
    dialogo: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "90%",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.linea(0.2),
      backgroundColor: p.superficie,
    },
    contenido: { padding: 22, gap: 14 },
    tituloDialogo: { color: p.texto, fontSize: 20, fontWeight: "900" },
    subtitulo: {
      color: p.texto,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 4,
    },
    lista: { gap: 8 },
    paso: { color: p.textoDato, fontSize: 14, lineHeight: 21 },
    nota: { color: p.textoTenue, fontSize: 12, lineHeight: 18 },
    opciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    opcion: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.linea(0.2),
      backgroundColor: p.velo(0.04),
    },
    opcionSeleccionada: { backgroundColor: "#2969e9", borderColor: "#2969e9" },
    textoOpcion: { color: p.textoSuave, fontSize: 13, fontWeight: "700" },
    textoOpcionSeleccionada: { color: "#FFFFFF" },
    enlace: { alignSelf: "flex-start", paddingVertical: 4 },
    textoEnlace: {
      color: p.acento,
      fontSize: 13,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    error: { color: p.textoError2, fontSize: 13, lineHeight: 18 },
    botonCerrar: {
      alignSelf: "flex-end",
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: p.velo(0.1),
    },
    presionado: { opacity: 0.78 },
  });
