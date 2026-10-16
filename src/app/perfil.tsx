import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AZUL = "#2969e9";
const FONDO = "#111318";

type Pestaña = "Inicio" | "Servicios" | "Solicitudes" | "Perfil";

const pestañas: { id: Pestaña; icono: string; ruta: string }[] = [
  { id: "Inicio", icono: "⌂", ruta: "/" },
  { id: "Servicios", icono: "◇", ruta: "/servicios" },
  { id: "Solicitudes", icono: "▤", ruta: "/solicitudes" },
  { id: "Perfil", icono: "○", ruta: "/perfil" },
];

const opciones = [
  {
    icono: "♙",
    titulo: "Información personal",
    descripcion: "Administra tus datos personales",
  },
  {
    icono: "⌖",
    titulo: "Mis direcciones",
    descripcion: "Gestiona tus ubicaciones guardadas",
  },
  {
    icono: "◷",
    titulo: "Historial de solicitudes",
    descripcion: "Consulta tus actividades anteriores",
  },
  {
    icono: "⚙",
    titulo: "Configuración",
    descripcion: "Preferencias de tu cuenta",
  },
  {
    icono: "?",
    titulo: "Ayuda y soporte",
    descripcion: "Encuentra respuestas a tus dudas",
  },
];

export default function PerfilScreen() {
  const router = useRouter();
  const rutaActual = usePathname();
  const [notificacionesActivas, setNotificacionesActivas] = useState(true);

  const navegar = (ruta: string) => {
    if (ruta !== rutaActual) {
      router.push(ruta as "/");
    }
  };

  const mostrarOpcion = (titulo: string) => {
    Alert.alert(
      titulo,
      "Esta sección estará disponible cuando se implemente su funcionalidad.",
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <View style={styles.contenedor}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contenido}
          showsVerticalScrollIndicator={false}>
          {/* Encabezado */}
          <View style={styles.encabezado}>
            <View>
              <Text style={styles.etiquetaSuperior}>TU ESPACIO PERSONAL</Text>
              <Text style={styles.titulo}>
                Mi <Text style={styles.textoAzul}>perfil</Text>
              </Text>
            </View>

            <View style={styles.iconoEncabezado}>
              <Text style={styles.simboloEncabezado}>○</Text>
            </View>
          </View>

          {/* Tarjeta principal del usuario */}
          <View style={styles.tarjetaPerfil}>
            <BlurView
              intensity={24}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            <LinearGradient
              colors={[
                "rgba(41,105,233,0.22)",
                "rgba(255,255,255,0.07)",
                "rgba(17,19,24,0.30)",
              ]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.reflejoPerfil} />

            <View style={styles.perfilSuperior}>
              <View style={styles.avatarExterior}>
                <LinearGradient
                  colors={["#528BFF", "#1744A4", "#14254A"]}
                  style={styles.avatar}>
                  <Text style={styles.avatarTexto}>U</Text>
                </LinearGradient>

                <View style={styles.estadoUsuario} />
              </View>

              <View style={styles.datosUsuario}>
                <Text style={styles.nombreUsuario}>Mi usuario</Text>
                <Text style={styles.correoUsuario}>usuario@ejemplo.com</Text>

                <View style={styles.etiquetaCuenta}>
                  <View style={styles.puntoActivo} />
                  <Text style={styles.textoEtiquetaCuenta}>Cuenta activa</Text>
                </View>
              </View>

              <Pressable
                onPress={() => mostrarOpcion("Editar perfil")}
                accessibilityRole="button"
                accessibilityLabel="Editar perfil"
                style={({ pressed }) => [
                  styles.botonEditar,
                  pressed && styles.presionado,
                ]}>
                <Text style={styles.iconoEditar}>↗</Text>
              </Pressable>
            </View>

            <View style={styles.divisorPerfil} />

            <View style={styles.resumenPerfil}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>0</Text>
                <Text style={styles.resumenEtiqueta}>Solicitudes</Text>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>0</Text>
                <Text style={styles.resumenEtiqueta}>Servicios</Text>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>—</Text>
                <Text style={styles.resumenEtiqueta}>Antigüedad</Text>
              </View>
            </View>
          </View>

          {/* Opciones de cuenta */}
          <View style={styles.seccionEncabezado}>
            <View>
              <Text style={styles.tituloSeccion}>Mi cuenta</Text>
              <Text style={styles.subtituloSeccion}>
                Gestiona tu información y preferencias
              </Text>
            </View>
          </View>

          <View style={styles.panelOpciones}>
            <BlurView
              intensity={18}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            <LinearGradient
              colors={["rgba(255,255,255,0.09)", "rgba(255,255,255,0.025)"]}
              style={StyleSheet.absoluteFill}
            />

            {opciones.map((opcion, indice) => (
              <View key={opcion.titulo}>
                <Pressable
                  onPress={() => mostrarOpcion(opcion.titulo)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.opcion,
                    pressed && styles.presionado,
                  ]}>
                  <View style={styles.iconoOpcion}>
                    <Text style={styles.simboloOpcion}>{opcion.icono}</Text>
                  </View>

                  <View style={styles.datosOpcion}>
                    <Text style={styles.tituloOpcion}>{opcion.titulo}</Text>
                    <Text style={styles.descripcionOpcion}>
                      {opcion.descripcion}
                    </Text>
                  </View>

                  <Text style={styles.flechaOpcion}>›</Text>
                </Pressable>

                {indice < opciones.length - 1 && (
                  <View style={styles.divisorOpcion} />
                )}
              </View>
            ))}
          </View>

          {/* Preferencias */}
          <Text style={styles.tituloSeccion}>Preferencias</Text>

          <View style={styles.tarjetaPreferencias}>
            <View style={styles.preferenciaTexto}>
              <Text style={styles.tituloOpcion}>Notificaciones</Text>
              <Text style={styles.descripcionOpcion}>
                Recibe actualizaciones de tus solicitudes
              </Text>
            </View>

            <Pressable
              onPress={() => setNotificacionesActivas(!notificacionesActivas)}
              accessibilityRole="switch"
              accessibilityState={{
                checked: notificacionesActivas,
              }}
              accessibilityLabel="Activar notificaciones"
              style={[
                styles.interruptor,
                notificacionesActivas && styles.interruptorActivo,
              ]}>
              <View
                style={[
                  styles.interruptorPunto,
                  notificacionesActivas && styles.interruptorPuntoActivo,
                ]}
              />
            </Pressable>
          </View>

          {/* Cerrar sesión */}
          <Pressable
            onPress={() =>
              Alert.alert(
                "Cerrar sesión",
                "La autenticación todavía no está implementada.",
                [{ text: "Entendido" }],
              )
            }
            style={({ pressed }) => [
              styles.botonCerrarSesion,
              pressed && styles.presionado,
            ]}>
            <Text style={styles.iconoCerrarSesion}>⇥</Text>
            <Text style={styles.textoCerrarSesion}>Cerrar sesión</Text>
          </Pressable>

          <Text style={styles.version}>
            MUÉVELO YA · TU MOVILIDAD, MÁS SIMPLE
          </Text>
        </ScrollView>

        {/* Navegación inferior */}
        <View style={styles.barraNavegacion}>
          <BlurView
            intensity={24}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />

          <LinearGradient
            colors={[
              "rgba(255,255,255,0.15)",
              "rgba(235,242,248,0.06)",
              "rgba(17,19,24,0.18)",
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.lineaLuz} />

          <View style={styles.elementosBarra}>
            {pestañas.map((pestaña) => {
              const activa = rutaActual === pestaña.ruta;

              return (
                <Pressable
                  key={pestaña.id}
                  onPress={() => navegar(pestaña.ruta)}
                  accessibilityRole="button"
                  accessibilityLabel={pestaña.id}
                  accessibilityState={{ selected: activa }}
                  style={({ pressed }) => [
                    styles.elementoNavegacion,
                    pressed && styles.presionado,
                  ]}>
                  {activa && (
                    <View style={styles.cristalActivo}>
                      <LinearGradient
                        colors={[
                          "rgba(41,105,233,0.36)",
                          "rgba(41,105,233,0.10)",
                          "rgba(255,255,255,0.03)",
                        ]}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  )}

                  <Text
                    style={[
                      styles.simboloNavegacion,
                      activa && styles.navegacionActiva,
                    ]}>
                    {pestaña.icono}
                  </Text>

                  <Text
                    style={[
                      styles.textoNavegacion,
                      activa && styles.navegacionActiva,
                    ]}>
                    {pestaña.id}
                  </Text>

                  {activa && <View style={styles.indicadorActivo} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FONDO,
  },

  contenedor: {
    flex: 1,
    backgroundColor: FONDO,
  },

  scroll: {
    flex: 1,
  },

  contenido: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 116,
    gap: 18,
  },

  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },

  etiquetaSuperior: {
    color: "#9AA9C0",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 5,
  },

  titulo: {
    color: "#F2F5FA",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  textoAzul: {
    color: AZUL,
  },

  iconoEncabezado: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "rgba(41,105,233,0.12)",
    borderWidth: 1,
    borderColor: "rgba(100,150,255,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },

  simboloEncabezado: {
    fontSize: 28,
    color: "#8DB2FF",
  },

  tarjetaPerfil: {
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(139,170,255,0.30)",
    overflow: "hidden",
    backgroundColor: "rgba(20,28,45,0.65)",
    padding: 17,
    gap: 17,
  },

  reflejoPerfil: {
    position: "absolute",
    top: 0,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.40)",
  },

  perfilSuperior: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  avatarExterior: {
    width: 68,
    height: 68,
    borderRadius: 23,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(141,178,255,0.65)",
  },

  avatar: {
    flex: 1,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarTexto: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },

  estadoUsuario: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#50DCA4",
    borderWidth: 3,
    borderColor: "#172137",
  },

  datosUsuario: {
    flex: 1,
    gap: 4,
  },

  nombreUsuario: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  correoUsuario: {
    color: "#B0BDD0",
    fontSize: 11,
  },

  etiquetaCuenta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(80,220,164,0.10)",
    borderWidth: 1,
    borderColor: "rgba(80,220,164,0.20)",
  },

  puntoActivo: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#50DCA4",
  },

  textoEtiquetaCuenta: {
    color: "#86E8BD",
    fontSize: 9,
    fontWeight: "700",
  },

  botonEditar: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  iconoEditar: {
    color: "#FFFFFF",
    fontSize: 20,
  },

  divisorPerfil: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.13)",
  },

  resumenPerfil: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  resumenItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },

  resumenValor: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
  },

  resumenEtiqueta: {
    color: "#AAB7CA",
    fontSize: 10,
    fontWeight: "600",
  },

  divisorVertical: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.13)",
  },

  seccionEncabezado: {
    gap: 5,
  },

  tituloSeccion: {
    color: "#F0F3F8",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  subtituloSeccion: {
    color: "#929EB1",
    fontSize: 11,
    marginTop: 4,
  },

  panelOpciones: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.035)",
    overflow: "hidden",
  },

  opcion: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 12,
  },

  iconoOpcion: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41,105,233,0.14)",
    borderWidth: 1,
    borderColor: "rgba(100,150,255,0.20)",
  },

  simboloOpcion: {
    color: "#8DB2FF",
    fontSize: 23,
    fontWeight: "500",
  },

  datosOpcion: {
    flex: 1,
    gap: 5,
  },

  tituloOpcion: {
    color: "#F0F3F8",
    fontSize: 12,
    fontWeight: "700",
  },

  descripcionOpcion: {
    color: "#9BA7BA",
    fontSize: 10,
    lineHeight: 15,
  },

  flechaOpcion: {
    color: "#8395B0",
    fontSize: 25,
    fontWeight: "300",
    paddingHorizontal: 3,
  },

  divisorOpcion: {
    height: 1,
    marginLeft: 68,
    backgroundColor: "rgba(255,255,255,0.075)",
  },

  tarjetaPreferencias: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.045)",
  },

  preferenciaTexto: {
    flex: 1,
    gap: 6,
  },

  interruptor: {
    width: 44,
    height: 25,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
    backgroundColor: "#353A46",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  interruptorActivo: {
    backgroundColor: "rgba(41,105,233,0.85)",
    borderColor: "rgba(141,178,255,0.65)",
  },

  interruptorPunto: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#D4D9E1",
  },

  interruptorPuntoActivo: {
    alignSelf: "flex-end",
    backgroundColor: "#FFFFFF",
  },

  botonCerrarSesion: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,100,115,0.25)",
    backgroundColor: "rgba(255,80,100,0.065)",
  },

  iconoCerrarSesion: {
    color: "#FF8794",
    fontSize: 19,
  },

  textoCerrarSesion: {
    color: "#FF9CA7",
    fontSize: 12,
    fontWeight: "700",
  },

  version: {
    color: "#657187",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: 1,
  },

  barraNavegacion: {
    position: "absolute",
    bottom: 8,
    left: 20,
    right: 20,
    height: 76,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(17,19,24,0.72)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },

  lineaLuz: {
    position: "absolute",
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  elementosBarra: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },

  elementoNavegacion: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  cristalActivo: {
    position: "absolute",
    top: 7,
    bottom: 7,
    left: 4,
    right: 4,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(141,178,255,0.35)",
    overflow: "hidden",
  },

  simboloNavegacion: {
    color: "#D9E0EA",
    fontSize: 23,
    lineHeight: 27,
  },

  textoNavegacion: {
    color: "#C3CCD9",
    fontSize: 10,
    fontWeight: "600",
  },

  navegacionActiva: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  indicadorActivo: {
    position: "absolute",
    bottom: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },

  presionado: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
