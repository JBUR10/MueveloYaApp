import { BlurView } from "expo-blur";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import MensajeTemporal from "../components/ui/MensajeTemporal";
import { supabase } from "../lib/supabase";
import { cambiarModo, useModo } from "../services/modoStore";
import {
  obtenerMiPerfil,
  obtenerResumen,
  Perfil,
  textoAntiguedad,
} from "../services/perfilService";
import {
  obtenerMiVehiculo,
  revisarDocumentos,
  Vehiculo,
} from "../services/vehiculoService";

const AZUL = "#2969e9";
const FONDO = "#111318";

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
  const [notificacionesActivas, setNotificacionesActivas] = useState(true);
  const router = useRouter();
  const { modo } = useModo();
  const modoTransportista = modo === "transportista";
  const [mensajeModo, setMensajeModo] = useState<string | null>(null);
  const ocultarMensajeModo = useCallback(() => setMensajeModo(null), []);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [resumen, setResumen] = useState({ solicitudes: 0, servicios: 0 });

  useFocusEffect(
    useCallback(() => {
      obtenerMiPerfil().then(setPerfil);
      obtenerResumen().then(setResumen);
      obtenerMiVehiculo()
        .then(setVehiculo)
        .catch(() => setVehiculo(null));
    }, []),
  );

  const nombre = perfil?.nombre || "Mi usuario";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "U";

  const alternarModo = async () => {
    const nuevoModo = modoTransportista ? "usuario" : "transportista";

    // Para ser transportista se necesita el vehículo con documentos vigentes.
    if (nuevoModo === "transportista") {
      let actual: Vehiculo | null = null;
      try {
        actual = await obtenerMiVehiculo();
      } catch {
        await aviso(
          "Sin conexión",
          "No pudimos revisar tu vehículo. Inténtalo de nuevo.",
          "error",
        );
        return;
      }

      if (!actual) {
        const ok = await confirmar({
          titulo: "Registra tu vehículo",
          mensaje:
            "Para trabajar como transportista necesitamos los datos de tu vehículo y la vigencia de tus documentos (SOAT, técnico-mecánica y licencia).",
          textoAceptar: "Registrar",
          tipo: "info",
        });
        if (ok) router.push({ pathname: "/vehiculo", params: { activar: "1" } });
        return;
      }

      const revision = revisarDocumentos(actual);
      if (!revision.vigentes) {
        const ok = await confirmar({
          titulo: "Documentos vencidos",
          mensaje: `No puedes activar el modo transportista: ${revision.vencidos.join(", ")}. Actualiza las fechas cuando los renueves.`,
          textoAceptar: "Actualizar",
          tipo: "error",
        });
        if (ok) router.push("/vehiculo");
        return;
      }
    }

    const ok = await confirmar({
      titulo:
        nuevoModo === "transportista"
          ? "Cambiar a modo transportista"
          : "Volver a modo usuario",
      mensaje:
        nuevoModo === "transportista"
          ? "Podrás ver, aceptar y cancelar solicitudes de servicio."
          : "Volverás a solicitar servicios como usuario.",
      textoAceptar: "Cambiar",
      tipo: "info",
    });
    if (!ok) return;

    await cambiarModo(nuevoModo);
    setMensajeModo(
      nuevoModo === "transportista"
        ? "Estás en modo transportista"
        : "Estás en modo usuario",
    );
  };

  const mostrarOpcion = (titulo: string) => {
    aviso(
      titulo,
      "Esta sección estará disponible cuando se implemente su funcionalidad.",
      "info",
    );
  };

  const cerrarSesion = async () => {
    const ok = await confirmar({
      titulo: "Cerrar sesión",
      mensaje: "¿Seguro que deseas salir de tu cuenta?",
      textoAceptar: "Cerrar sesión",
      destructivo: true,
    });
    if (!ok) return;

    // El modo queda guardado para esta cuenta; la siguiente cuenta carga el suyo.
    const { error } = await supabase.auth.signOut();
    if (error) {
      await aviso("Error", "No se pudo cerrar la sesión. Revisa tu conexión.", "error");
    }
    // Sin sesión, el _layout lleva al login automáticamente.
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
                  <Text style={styles.avatarTexto}>{inicial}</Text>
                </LinearGradient>

                <View style={styles.estadoUsuario} />
              </View>

              <View style={styles.datosUsuario}>
                <Text style={styles.nombreUsuario} numberOfLines={1}>
                  {nombre}
                </Text>
                <Text style={styles.correoUsuario} numberOfLines={1}>
                  {perfil?.correo ?? ""}
                </Text>

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
                <Text style={styles.iconoEditar}>✎</Text>
              </Pressable>
            </View>

            <View style={styles.divisorPerfil} />

            <View style={styles.resumenPerfil}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>{resumen.solicitudes}</Text>
                <Text style={styles.resumenEtiqueta}>Solicitudes</Text>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>{resumen.servicios}</Text>
                <Text style={styles.resumenEtiqueta}>Servicios</Text>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>
                  {perfil?.creadoEl ? textoAntiguedad(perfil.creadoEl) : "—"}
                </Text>
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
              onPress={() => setNotificacionesActivas((activas) => !activas)}
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

          {/* Modo transportista */}
          <View style={styles.tarjetaModo}>
            <View style={styles.filaModo}>
              <View style={styles.preferenciaTexto}>
                <Text style={styles.tituloOpcion}>Modo transportista</Text>
                <Text style={styles.descripcionOpcion}>
                  Ve, acepta y gestiona solicitudes de servicio
                </Text>
              </View>

              <Pressable
                onPress={alternarModo}
                accessibilityRole="switch"
                accessibilityState={{
                  checked: modoTransportista,
                }}
                accessibilityLabel="Activar modo transportista"
                style={[
                  styles.interruptor,
                  modoTransportista && styles.interruptorActivo,
                ]}>
                <View
                  style={[
                    styles.interruptorPunto,
                    modoTransportista && styles.interruptorPuntoActivo,
                  ]}
                />
              </Pressable>
            </View>

            <View style={styles.divisorModo} />

            <View style={styles.filaModo}>
              <View style={styles.etiquetaModo}>
                <View
                  style={[
                    styles.puntoModo,
                    modoTransportista && styles.puntoModoActivo,
                  ]}
                />
                <Text style={styles.textoEtiquetaModo}>
                  {modoTransportista ? "Modo transportista" : "Modo usuario"}
                </Text>
              </View>

              {modoTransportista && (
                <Pressable
                  onPress={alternarModo}
                  accessibilityRole="button"
                  style={({ pressed }) => pressed && styles.presionado}>
                  <Text style={styles.textoVolverModo}>
                    Volver a modo usuario
                  </Text>
                </Pressable>
              )}
            </View>

            {!!vehiculo && (
              <Pressable
                onPress={() => router.push("/vehiculo")}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.filaVehiculo,
                  pressed && styles.presionado,
                ]}>
                <View style={styles.preferenciaTexto}>
                  <Text style={styles.tituloOpcion}>
                    Mi vehículo · {vehiculo.placa}
                  </Text>
                  <Text
                    style={[
                      styles.descripcionOpcion,
                      !revisarDocumentos(vehiculo).vigentes && styles.textoVencido,
                    ]}>
                    {!revisarDocumentos(vehiculo).vigentes
                      ? "Documentos vencidos: actualízalos"
                      : revisarDocumentos(vehiculo).porVencer.length
                        ? "Hay documentos por vencer"
                        : "Documentos al día"}
                  </Text>
                </View>
                <Text style={styles.flechaOpcion}>›</Text>
              </Pressable>
            )}

            {modoTransportista && (
              <Pressable
                onPress={() => router.push("/transportista" as Href)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.botonPanelTransportista,
                  pressed && styles.presionado,
                ]}>
                <Text style={styles.textoPanelTransportista}>
                  Ver solicitudes de servicio ›
                </Text>
              </Pressable>
            )}
          </View>

          {/* Cerrar sesión */}
          <Pressable
            onPress={cerrarSesion}
            accessibilityRole="button"
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

        {/* Barra de navegación compartida */}
        <BarraNavegacion />

        <MensajeTemporal
          mensaje={mensajeModo}
          alTerminar={ocultarMensajeModo}
        />
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
    backgroundColor: "rgba(255,255,255,0.00)",
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

  presionado: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  // Modo transportista
  tarjetaModo: {
    gap: 12,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.045)",
  },

  filaModo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  divisorModo: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.075)",
  },

  etiquetaModo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  puntoModo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8395B0",
  },

  puntoModoActivo: {
    backgroundColor: "#50DCA4",
  },

  textoEtiquetaModo: {
    color: "#F0F3F8",
    fontSize: 11,
    fontWeight: "700",
  },

  textoVolverModo: {
    color: "#8DB2FF",
    fontSize: 11,
    fontWeight: "700",
  },

  filaVehiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.075)",
  },

  textoVencido: {
    color: "#fca5a5",
  },

  botonPanelTransportista: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: AZUL,
  },

  textoPanelTransportista: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
