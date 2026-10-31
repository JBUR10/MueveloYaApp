// src/components/auth/FormularioAuth.tsx
//
// Piezas comunes de las pantallas de acceso (login, registro, verificar,
// recuperar): contenedor con logo, campos de texto y botones.
import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const AZUL = "#2969e9";
const FONDO = "#111318";

export function PantallaAuth({
  etiqueta,
  titulo,
  resaltado,
  descripcion,
  children,
}: {
  etiqueta: string;
  titulo: string;
  resaltado: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />
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
          <Text style={styles.titulo}>
            {titulo} <Text style={styles.azul}>{resaltado}</Text>
          </Text>
          {!!descripcion && (
            <Text style={styles.descripcion}>{descripcion}</Text>
          )}

          <View style={styles.tarjeta}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Campo({
  etiqueta,
  error,
  clave = false,
  ...props
}: TextInputProps & { etiqueta: string; error?: string; clave?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={styles.campo}>
      <Text style={styles.etiquetaCampo}>{etiqueta}</Text>
      <View
        style={[
          styles.cajaCampo,
          enfocado && styles.cajaEnfocada,
          !!error && styles.cajaError,
        ]}
      >
        <TextInput
          placeholderTextColor="rgba(255,255,255,0.35)"
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
        />
        {clave && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <Text style={styles.verClave}>{visible ? "Ocultar" : "Ver"}</Text>
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.textoError}>{error}</Text>}
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
  const inactivo = cargando || deshabilitado;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo }}
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
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FONDO },
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
    color: "#eeecec",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  azul: { color: AZUL },
  etiqueta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titulo: {
    color: "#eeecec",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  descripcion: {
    color: "#9BA7BA",
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
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  campo: { gap: 6 },
  etiquetaCampo: {
    color: "rgba(255,255,255,0.7)",
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
    borderColor: "#1f2937",
    backgroundColor: "#0b0e14",
  },
  cajaEnfocada: { borderColor: AZUL },
  cajaError: { borderColor: "rgba(239,68,68,0.7)" },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    paddingVertical: 12,
  },
  verClave: { color: "#8DB2FF", fontSize: 12, fontWeight: "700" },
  textoError: { color: "#fca5a5", fontSize: 11 },
  boton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
    marginTop: 4,
  },
  botonInactivo: { opacity: 0.55 },
  textoBoton: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  enlace: { alignSelf: "center", paddingVertical: 4 },
  textoEnlace: { color: "#9BA7BA", fontSize: 13, textAlign: "center" },
  accionEnlace: { color: "#8DB2FF", fontWeight: "800" },
  presionado: { opacity: 0.75 },
});
