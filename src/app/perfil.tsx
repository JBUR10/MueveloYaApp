import { Href, useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import MensajeTemporal from "../components/ui/MensajeTemporal";
import { supabase } from "../lib/supabase";
import { soyAdmin } from "../services/adminService";
import { apagarDisponibilidad } from "../services/disponibilidadStore";
import { cambiarModo, useModo } from "../services/modoStore";
import {
  cambiarPushActivo,
  quitarDispositivoPush,
  usePush,
} from "../services/notificacionesPush";
import { obtenerMiPerfil, Perfil } from "../services/perfilService";
import {
  obtenerMiVehiculo,
  revisarDocumentos,
  Vehiculo,
} from "../services/vehiculoService";

const AZUL = "#2969e9";
const FONDO = "#111318";

// Campos extra del formulario. Si tu Perfil aún no los tiene,
// agrégalos en perfilService (apellido, ciudad, telefono).
type PerfilExtendido = Perfil & {
  apellido?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
};

type CampoProps = {
  etiqueta: string;
  valor: string;
  onChange?: (texto: string) => void;
  editable?: boolean;
  teclado?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "words" | "sentences";
};

function Campo({
  etiqueta,
  valor,
  onChange,
  editable = true,
  teclado = "default",
  autoCapitalize = "words",
}: CampoProps) {
  return (
    <View style={[styles.campo, !editable && styles.campoBloqueado]}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        editable={editable}
        keyboardType={teclado}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#657187"
        placeholder={etiqueta}
        style={[styles.campoInput, !editable && styles.campoInputBloqueado]}
      />
    </View>
  );
}

export default function PerfilScreen() {
  // Notificaciones push de este celular (solo en el APK de Android).
  const push = usePush();
  const notificacionesActivas = push.soportado && push.activo && !push.sinPermiso;
  const router = useRouter();
  const { modo } = useModo();
  const modoTransportista = modo === "transportista";
  const [mensajeModo, setMensajeModo] = useState<string | null>(null);
  const ocultarMensajeModo = useCallback(() => setMensajeModo(null), []);

  const [perfil, setPerfil] = useState<PerfilExtendido | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);

  // Formulario
  const [nombreForm, setNombreForm] = useState("");
  const [apellidoForm, setApellidoForm] = useState("");
  const [ciudadForm, setCiudadForm] = useState("");
  const [telefonoForm, setTelefonoForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      obtenerMiPerfil().then((p) => {
        const datos = p as PerfilExtendido | null;
        setPerfil(datos);
        setNombreForm(datos?.nombre ?? "");
        setApellidoForm(datos?.apellido ?? "");
        setCiudadForm(datos?.ciudad ?? "");
        setTelefonoForm(datos?.telefono ?? "");
      });
      obtenerMiVehiculo()
        .then(setVehiculo)
        .catch(() => setVehiculo(null));
      soyAdmin().then(setEsAdmin);
    }, []),
  );

  const nombre = nombreForm || perfil?.nombre || "Mi usuario";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "U";

  const hayCambios =
    nombreForm !== (perfil?.nombre ?? "") ||
    apellidoForm !== (perfil?.apellido ?? "") ||
    ciudadForm !== (perfil?.ciudad ?? "") ||
    telefonoForm !== (perfil?.telefono ?? "");

  const guardarPerfil = async () => {
    if (!hayCambios || guardando) return;
    setGuardando(true);
    try {
      // TODO: conectar con tu servicio, por ejemplo:
      // await actualizarMiPerfil({ nombre: nombreForm, apellido: apellidoForm,
      //   ciudad: ciudadForm, telefono: telefonoForm });
      setPerfil((p) =>
        p
          ? {
              ...p,
              nombre: nombreForm,
              apellido: apellidoForm,
              ciudad: ciudadForm,
              telefono: telefonoForm,
            }
          : p,
      );
      setMensajeModo("Perfil actualizado");
    } catch {
      await aviso(
        "Error",
        "No pudimos guardar tus datos. Inténtalo de nuevo.",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarFoto = () => {
    aviso(
      "Foto de perfil",
      "Esta opción estará disponible próximamente.",
      "info",
    );
  };

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
        if (ok)
          router.push({ pathname: "/vehiculo", params: { activar: "1" } });
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

      // Además de los documentos, un administrador debe aprobar el perfil.
      if (actual.verificacion === "rechazado") {
        const ok = await confirmar({
          titulo: "Perfil rechazado",
          mensaje: `Un administrador rechazó tu perfil: ${actual.motivoRechazo || "revisa tus datos"}. Corrige tu vehículo y se enviará a revisión de nuevo.`,
          textoAceptar: "Corregir",
          tipo: "error",
        });
        if (ok) router.push("/vehiculo");
        return;
      }
      if (actual.verificacion !== "aprobado") {
        await aviso(
          "Perfil en revisión",
          "Un administrador está revisando tu perfil. Cuando lo apruebe podrás activar el modo transportista.",
          "info",
        );
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

  const alternarNotificaciones = async () => {
    if (!push.soportado) {
      await aviso(
        "Notificaciones",
        "Las notificaciones push solo funcionan en la app instalada en Android (APK). Aquí sigues viendo los avisos dentro de la app.",
        "info",
      );
      return;
    }
    const activar = !notificacionesActivas;
    const ok = await cambiarPushActivo(activar);
    if (activar && !ok) {
      await aviso(
        "Permiso de notificaciones",
        "El celular no permite que Muévelo Ya envíe notificaciones. Actívalas en Ajustes > Aplicaciones > Muévelo Ya > Notificaciones.",
        "advertencia",
      );
      return;
    }
    setMensajeModo(
      activar ? "Notificaciones activadas" : "Notificaciones desactivadas",
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

    // Antes de salir (aún con sesión): este celular deja de recibir push de
    // la cuenta y el conductor deja de estar disponible.
    await Promise.all([quitarDispositivoPush(), apagarDisponibilidad()]);

    // El modo queda guardado para esta cuenta; la siguiente cuenta carga el suyo.
    const { error } = await supabase.auth.signOut();
    if (error) {
      await aviso(
        "Error",
        "No se pudo cerrar la sesión. Revisa tu conexión.",
        "error",
      );
    }
    // Sin sesión, el _layout lleva al login automáticamente.
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <View style={styles.contenedor}>
        <KeyboardAvoidingView
          style={styles.scroll}
          behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Encabezado */}
            <View style={styles.encabezado}>
              <Text style={styles.etiquetaSuperior}>TU ESPACIO PERSONAL</Text>
              <Text style={styles.titulo}>
                Mi <Text style={styles.textoAzul}>perfil</Text>
              </Text>
            </View>

            {/* Avatar */}
            <View style={styles.avatarZona}>
              <View style={styles.avatarExterior}>
                <LinearGradient
                  colors={["#528BFF", "#1744A4", "#14254A"]}
                  style={styles.avatar}>
                  <Text style={styles.avatarTexto}>{inicial}</Text>
                </LinearGradient>

                <Pressable
                  onPress={cambiarFoto}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar foto de perfil"
                  style={({ pressed }) => [
                    styles.botonFoto,
                    pressed && styles.presionado,
                  ]}>
                  <Text style={styles.iconoFoto}>✎</Text>
                </Pressable>
              </View>
            </View>

            {/* Formulario */}
            <View style={styles.formulario}>
              <Campo
                etiqueta="Nombre"
                valor={nombreForm}
                onChange={setNombreForm}
              />
              <Campo
                etiqueta="Apellido"
                valor={apellidoForm}
                onChange={setApellidoForm}
              />
              <Campo
                etiqueta="Correo electrónico"
                valor={perfil?.correo ?? ""}
                editable={false}
                teclado="email-address"
                autoCapitalize="none"
              />
              <Campo
                etiqueta="Ciudad"
                valor={ciudadForm}
                onChange={setCiudadForm}
              />
              <Campo
                etiqueta="Teléfono"
                valor={telefonoForm}
                onChange={setTelefonoForm}
                teclado="phone-pad"
                autoCapitalize="none"
              />
            </View>

            <Pressable
              onPress={guardarPerfil}
              disabled={!hayCambios || guardando}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hayCambios || guardando }}
              style={({ pressed }) => [
                styles.botonGuardar,
                (!hayCambios || guardando) && styles.botonGuardarInactivo,
                pressed && styles.presionado,
              ]}>
              <Text style={styles.textoGuardar}>
                {guardando ? "Guardando..." : "Guardar"}
              </Text>
            </Pressable>

            {/* Preferencias */}
            <Text style={styles.tituloSeccion}>Preferencias</Text>

            <View style={styles.tarjetaPreferencias}>
              <View style={styles.preferenciaTexto}>
                <Text style={styles.tituloOpcion}>Notificaciones</Text>
                <Text style={styles.descripcionOpcion}>
                  {push.soportado
                    ? "Avisos de tus servicios aunque tengas la app cerrada"
                    : "Disponible en la app instalada (APK de Android)"}
                </Text>
              </View>

              <Pressable
                onPress={alternarNotificaciones}
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
                        (vehiculo.verificacion === "rechazado" ||
                          !revisarDocumentos(vehiculo).vigentes) &&
                          styles.textoVencido,
                      ]}>
                      {vehiculo.verificacion === "pendiente"
                        ? "En revisión por un administrador"
                        : vehiculo.verificacion === "rechazado"
                          ? "Rechazado: corrige tus datos"
                          : !revisarDocumentos(vehiculo).vigentes
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

            {esAdmin && (
              <Pressable
                onPress={() => router.push("/admin" as Href)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.botonPanelTransportista,
                  pressed && styles.presionado,
                ]}>
                <Text style={styles.textoPanelTransportista}>
                  Panel de administración ›
                </Text>
              </Pressable>
            )}

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
        </KeyboardAvoidingView>

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

  // Encabezado
  encabezado: {
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

  // Avatar
  avatarZona: {
    alignItems: "center",
    marginVertical: 4,
  },

  avatarExterior: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(141,178,255,0.65)",
  },

  avatar: {
    flex: 1,
    borderRadius: 49,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarTexto: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "800",
  },

  botonFoto: {
    position: "absolute",
    right: -6,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E222B",
    borderWidth: 3,
    borderColor: FONDO,
  },

  iconoFoto: {
    color: "#FFFFFF",
    fontSize: 16,
  },

  // Formulario
  formulario: {
    gap: 12,
  },

  campo: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  campoBloqueado: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  campoEtiqueta: {
    color: "#9BA7BA",
    fontSize: 11,
    fontWeight: "600",
  },

  campoInput: {
    color: "#F2F5FA",
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },

  campoInputBloqueado: {
    color: "#8E9AAE",
  },

  botonGuardar: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: AZUL,
  },

  botonGuardarInactivo: {
    opacity: 0.4,
  },

  textoGuardar: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  // Preferencias (sin cambios)
  tituloSeccion: {
    color: "#F0F3F8",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
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

  // Modo transportista (sin cambios)
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
