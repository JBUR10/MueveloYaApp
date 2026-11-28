// src/components/auth/FormularioAuth.tsx
//
// Piezas comunes de las pantallas de acceso (login, registro, verificar,
// recuperar): contenedor con logo, campos de texto y botones.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInputProps,
  View,
} from "react-native";
import { Text, TextInput } from "../ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

export const AZUL = "#2969e9";

/**
 * Solo web: BotonPrincipal y Campo avisan a PantallaAuth de cada intento de
 * envío, para volver a anunciar los errores aunque sean los mismos.
 */
const ContextoEnvio = createContext<(() => void) | null>(null);

// Pausas (ms). El foco espera porque, tras pulsar Enter, react-native-web saca
// el foco del campo; el anuncio va después para no pisar la lectura del campo.
const ESPERA_FOCO = 100;
const ESPERA_ANUNCIO = 300;

export function PantallaAuth({
  etiqueta,
  titulo,
  resaltado,
  descripcion,
  errores = [],
  children,
}: {
  etiqueta: string;
  titulo: string;
  resaltado: string;
  descripcion?: string;
  errores?: readonly string[];
  children: ReactNode;
}) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const tituloId = `auth-titulo-${useId().replace(/:/g, "")}`;
  const esWeb = Platform.OS === "web";
  const formularioRef = useRef<View>(null);
  const [envios, setEnvios] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const resumen =
    errores.length === 1
      ? "Hay un campo con error. Revisa el campo marcado."
      : `Hay ${errores.length} campos con error. Revisa los campos marcados.`;
  const claveErrores = errores.join("\n");
  const avisarEnvio = () => {
    setAnuncio("");
    setEnvios((n) => n + 1);
  };

  // Solo web: tras un envío con errores (o si llega uno del servidor), lleva el
  // foco al primer campo marcado y anuncia el resumen.
  useEffect(() => {
    if (Platform.OS !== "web" || !claveErrores) return;
    const foco = setTimeout(() => {
      const formulario = formularioRef.current as unknown as HTMLElement | null;
      formulario?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, ESPERA_FOCO);
    const voz = setTimeout(() => setAnuncio(resumen), ESPERA_ANUNCIO);
    return () => {
      clearTimeout(foco);
      clearTimeout(voz);
    };
  }, [envios, claveErrores, resumen]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={p.barraEstado} backgroundColor={p.fondo} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.marca}>
            <View style={styles.logo}>
              <Image
                source={require("../../../assets/images/icon.png")}
                style={styles.imagenLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.nombreApp}>
              Muévelo <Text style={styles.azul}>Ya</Text>
            </Text>
          </View>

          <Text style={styles.etiqueta}>{etiqueta}</Text>
          <Text
            nativeID={tituloId}
            accessibilityRole="header"
            style={styles.titulo}
          >
            {titulo} <Text style={styles.azul}>{resaltado}</Text>
          </Text>
          {!!descripcion && (
            <Text style={styles.descripcion}>{descripcion}</Text>
          )}

          <View
            ref={formularioRef}
            style={styles.tarjeta}
            role="form"
            accessibilityLabelledBy={tituloId}
            aria-labelledby={tituloId}
          >
            {errores.length > 0 && (
              <Text
                // En web este texto es solo visual: lo anuncia la zona de abajo.
                {...(esWeb
                  ? { "aria-hidden": true }
                  : {
                      role: "status" as const,
                      accessibilityLiveRegion: "polite" as const,
                      "aria-live": "polite" as const,
                    })}
                style={styles.resumenErrores}
              >
                {resumen}
              </Text>
            )}
            {/* Existe siempre (vacía) para que el lector detecte sus cambios. */}
            {esWeb && (
              <Text role="status" aria-live="polite" style={styles.soloLector}>
                {errores.length > 0 ? anuncio : ""}
              </Text>
            )}
            <ContextoEnvio.Provider value={esWeb ? avisarEnvio : null}>
              {children}
            </ContextoEnvio.Provider>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Campo({
  etiqueta,
  error,
  requerido = true,
  clave = false,
  ...props
}: TextInputProps & {
  etiqueta: string;
  error?: string;
  requerido?: boolean;
  clave?: boolean;
}) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const [visible, setVisible] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const id = useId().replace(/:/g, "");
  const labelId = `auth-campo-label-${id}`;
  const errorId = `auth-campo-error-${id}`;
  const avisarEnvio = useContext(ContextoEnvio);
  const alEnviar = props.onSubmitEditing;
  const estadoAlternanciaWeb =
    Platform.OS === "web" ? { "aria-pressed": visible } : {};

  return (
    <View style={styles.campo}>
      <Text nativeID={labelId} style={styles.etiquetaCampo}>
        {etiqueta} ({requerido ? "obligatorio" : "opcional"})
      </Text>
      <View
        style={[
          styles.cajaCampo,
          enfocado && styles.cajaEnfocada,
          !!error && styles.cajaError,
        ]}
      >
        <TextInput
          nativeID={`auth-campo-${id}`}
          accessibilityLabelledBy={labelId}
          aria-labelledby={labelId}
          accessibilityHint={
            props.accessibilityHint ??
            (error
              ? `Error: ${error}`
              : requerido
                ? "Campo obligatorio."
                : undefined)
          }
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          aria-required={requerido}
          placeholderTextColor={p.textoAlfa(0.35)}
          secureTextEntry={clave && !visible}
          autoCorrect={false}
          {...props}
          // Después de {...props} para que no se pierdan el estilo ni el foco.
          // En web se quita el recuadro de foco del navegador: lo indica el borde azul.
          style={[
            styles.input,
            Platform.OS === "web" && ({ outlineStyle: "none" } as any),
            props.style,
          ]}
          onFocus={(e) => {
            setEnfocado(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            props.onBlur?.(e);
          }}
          onSubmitEditing={
            alEnviar && avisarEnvio
              ? (e) => {
                  alEnviar(e);
                  avisarEnvio();
                }
              : alEnviar
          }
        />
        {clave && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole={
              Platform.OS === "web" ? "button" : "togglebutton"
            }
            accessibilityState={{ checked: visible }}
            accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            {...estadoAlternanciaWeb}
          >
            <Text style={styles.verClave}>{visible ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        )}
      </View>
      {!!error && (
        <Text nativeID={errorId} style={styles.textoError}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function BotonPrincipal({
  texto,
  onPress,
  cargando = false,
  deshabilitado = false,
}: {
  texto: string;
  onPress: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const styles = useEstilos(crearEstilos);
  const avisarEnvio = useContext(ContextoEnvio);
  const inactivo = cargando || deshabilitado;
  return (
    <Pressable
      // Fuera de las pantallas de acceso (queja, vehículo) no cambia nada.
      onPress={
        avisarEnvio
          ? () => {
              onPress();
              avisarEnvio();
            }
          : onPress
      }
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={cargando ? `${texto}, procesando` : texto}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        styles.boton,
        inactivo && styles.botonInactivo,
        pressed && styles.presionado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.textoBoton}>{texto}</Text>
      )}
    </Pressable>
  );
}

export function Enlace({
  texto,
  accion,
  onPress,
}: {
  texto?: string;
  accion: string;
  onPress: () => void;
}) {
  const styles = useEstilos(crearEstilos);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${texto ? `${texto} ` : ""}${accion}`}
      style={({ pressed }) => [styles.enlace, pressed && styles.presionado]}
    >
      <Text style={styles.textoEnlace}>
        {texto ? `${texto} ` : ""}
        <Text style={styles.accionEnlace}>{accion}</Text>
      </Text>
    </Pressable>
  );
}

export const esCorreoValido = (correo: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());

export function obtenerErroresAuth(errores: readonly (string | undefined)[]) {
  return errores.filter((error): error is string => Boolean(error));
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: p.fondo },
  flex: { flex: 1 },
  contenido: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  marca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: AZUL,
    overflow: "hidden",
  },
  imagenLogo: { width: 42, height: 42 },
  nombreApp: {
    color: p.textoTitulo,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  azul: { color: AZUL },
  etiqueta: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titulo: {
    color: p.textoTitulo,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  descripcion: {
    color: p.textoTenue,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  tarjeta: {
    marginTop: 22,
    padding: 18,
    gap: 14,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  // Invisible pero legible por el lector; al ser absoluto no altera el diseño.
  soloLector: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
  campo: { gap: 6 },
  etiquetaCampo: {
    color: p.textoAlfa(0.7),
    fontSize: 12,
    fontWeight: "700",
  },
  resumenErrores: {
    color: p.textoError,
    fontSize: 12,
    fontWeight: "700",
  },
  cajaCampo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.bordeCampo,
    backgroundColor: p.fondoProfundo,
  },
  cajaEnfocada: { borderColor: AZUL },
  cajaError: { borderColor: "rgba(239,68,68,0.7)" },
  input: {
    flex: 1,
    color: p.texto,
    fontSize: 14,
    paddingVertical: 12,
  },
  verClave: { color: p.acento, fontSize: 12, fontWeight: "700" },
  textoError: { color: p.textoError, fontSize: 11 },
  boton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
    marginTop: 4,
  },
  botonInactivo: { opacity: 0.55 },
  textoBoton: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  enlace: { alignSelf: "center", paddingVertical: 4 },
  textoEnlace: { color: p.textoTenue, fontSize: 13, textAlign: "center" },
  accionEnlace: { color: p.acento, fontWeight: "800" },
  presionado: { opacity: 0.75 },
});
