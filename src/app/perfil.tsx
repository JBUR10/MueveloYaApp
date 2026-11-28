import { Href, useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  aviso,
  confirmar,
  confirmarCambiosTamanoFuente,
} from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import MensajeTemporal from "../components/ui/MensajeTemporal";
import SelectorTamanoFuente from "../components/ui/SelectorTamanoFuente";
import GuiaLectoresPantalla from "../components/ui/GuiaLectoresPantalla";
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
import Icono from "../components/ui/Icono";
import TextoIcono from "../components/ui/TextoIcono";
import { propsEnlaceWeb } from "../components/ui/tecladoWeb";
import {
  cambiarTema,
  useEstilos,
  usePaleta,
  type Paleta,
} from "../services/temaStore";
import {
  cambiarBorradorTamanoFuente,
  descartarBorradorTamanoFuente,
  guardarTamanoFuente,
  NIVELES_TAMANO_FUENTE,
  obtenerEstadoTamanoFuente,
  reintentarCargaTamanoFuente,
  useTamanoFuente,
} from "../services/tamanoFuenteStore";
import {
  navegarConProteccionTamanoFuente,
  registrarProteccionTamanoFuente,
} from "../services/proteccionTamanoFuente";
import { obtenerMisPagos, type PagoRegistrado } from "../services/pagoService";
import { formatearPesos } from "../services/tarifa";

const AZUL = "#2969e9";

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
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  return (
    <View style={[styles.campo, !editable && styles.campoBloqueado]}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        editable={editable}
        keyboardType={teclado}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={p.textoPista2}
        placeholder={etiqueta}
        style={[styles.campoInput, !editable && styles.campoInputBloqueado]}
      />
    </View>
  );
}

export default function PerfilScreen() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  // Notificaciones push de este celular (solo en el APK de Android).
  const push = usePush();
  const notificacionesActivas = push.soportado && push.activo && !push.sinPermiso;
  const router = useRouter();
  const { modo } = useModo();
  const tamanoFuente = useTamanoFuente();
  const modoTransportista = modo === "transportista";
  const [mensajeModo, setMensajeModo] = useState<string | null>(null);
  const ocultarMensajeModo = useCallback(() => setMensajeModo(null), []);

  const [perfil, setPerfil] = useState<PerfilExtendido | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  // null mientras no se han cargado: no es lo mismo que no tener pagos.
  const [misPagos, setMisPagos] = useState<PagoRegistrado[] | null>(null);
  const [errorPagos, setErrorPagos] = useState(false);
  const cargarPagos = useCallback(() => {
    setErrorPagos(false);
    obtenerMisPagos()
      .then(setMisPagos)
      .catch((error) => {
        console.error("No se pudieron cargar los pagos:", error);
        setErrorPagos(true);
      });
  }, []);

  // Formulario
  const [nombreForm, setNombreForm] = useState("");
  const [apellidoForm, setApellidoForm] = useState("");
  const [ciudadForm, setCiudadForm] = useState("");
  const [telefonoForm, setTelefonoForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const hayCambiosTamano =
    tamanoFuente.carga === "ready" &&
    tamanoFuente.borrador !== tamanoFuente.guardado;
  const nivelBorrador = NIVELES_TAMANO_FUENTE.find(
    (nivel) => nivel.id === tamanoFuente.borrador,
  );
  const nivelGuardado = NIVELES_TAMANO_FUENTE.find(
    (nivel) => nivel.id === tamanoFuente.guardado,
  );

  useEffect(
    () =>
      registrarProteccionTamanoFuente(async (continuar) => {
        const actual = obtenerEstadoTamanoFuente();
        if (
          actual.carga !== "ready" ||
          actual.borrador === actual.guardado
        ) {
          await continuar();
          return true;
        }

        const accion = await confirmarCambiosTamanoFuente({
          titulo: "Cambios de tamaño sin guardar",
          mensaje:
            "¿Qué deseas hacer con el tamaño de fuente que estás previsualizando?",
        });
        if (accion === "editar") return false;

        if (accion === "salir") {
          descartarBorradorTamanoFuente();
        } else if (!(await guardarTamanoFuente())) {
          await aviso(
            "No se pudo guardar",
            obtenerEstadoTamanoFuente().error ??
              "El borrador se conservó. Permanece en Perfil e inténtalo de nuevo.",
            "error",
          );
          return false;
        }

        await continuar();
        return true;
      }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const suscripcion = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          const actual = obtenerEstadoTamanoFuente();
          if (
            actual.carga !== "ready" ||
            actual.borrador === actual.guardado
          ) {
            return false;
          }
          void navegarConProteccionTamanoFuente(() => {
            if (router.canGoBack()) router.back();
            else router.replace("/");
          });
          return true;
        },
      );
      return () => suscripcion.remove();
    }, [router]),
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const advertirAntesDeSalir = (evento: BeforeUnloadEvent) => {
      const actual = obtenerEstadoTamanoFuente();
      if (
        actual.carga !== "ready" ||
        actual.borrador === actual.guardado
      ) {
        return;
      }
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", advertirAntesDeSalir);
    return () => window.removeEventListener("beforeunload", advertirAntesDeSalir);
  }, []);

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
      cargarPagos();
    }, [cargarPagos]),
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

  const guardarPreferenciaTamano = async () => {
    if (!hayCambiosTamano || tamanoFuente.guardando) return;
    if (await guardarTamanoFuente()) {
      await aviso("Tamaño guardado", "La preferencia quedó guardada.", "exito");
    } else {
      await aviso(
        "No se pudo guardar",
        obtenerEstadoTamanoFuente().error ??
          "El borrador se conservó. Inténtalo de nuevo.",
        "error",
      );
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
        if (ok) {
          await navegarConProteccionTamanoFuente(() =>
            router.push({ pathname: "/vehiculo", params: { activar: "1" } }),
          );
        }
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
        if (ok) {
          await navegarConProteccionTamanoFuente(() =>
            router.push("/vehiculo"),
          );
        }
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
        if (ok) {
          await navegarConProteccionTamanoFuente(() =>
            router.push("/vehiculo"),
          );
        }
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
    await navegarConProteccionTamanoFuente(async () => {
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
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={p.barraEstado} backgroundColor={p.fondo} />

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
                  <Icono nombre="pencil" tamano={16} color={p.texto} />
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

            {/* Pagos */}
            <Text style={styles.tituloSeccion}>Mis pagos</Text>
            <View style={styles.tarjetaPreferencias}>
              {errorPagos ? (
                <View style={{ flex: 1, gap: 8 }}>
                  <Text
                    style={styles.textoErrorTamanoFuente}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    aria-live="assertive"
                  >
                    No pudimos cargar tus pagos. Revisa tu conexión.
                  </Text>
                  <Pressable
                    onPress={cargarPagos}
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar la carga de mis pagos"
                    style={styles.botonReintentarTamano}
                  >
                    <Text style={styles.tituloOpcion}>Reintentar</Text>
                  </Pressable>
                </View>
              ) : misPagos === null ? (
                <Text style={styles.tituloOpcion} role="status">
                  Cargando tus pagos…
                </Text>
              ) : misPagos.length === 0 ? (
                <Text style={styles.tituloOpcion}>Aún no tienes pagos registrados.</Text>
              ) : (
                <View style={{ flex: 1 }}>
                  {misPagos.map((pago) => {
                    const url = pago.recibo_url;
                    const abrirRecibo = () => {
                      if (url) void WebBrowser.openBrowserAsync(url);
                    };
                    return (
                      <View key={pago.id} style={{ marginBottom: 10 }}>
                        <Text style={styles.tituloOpcion}>
                          {formatearPesos(pago.monto)} · {pago.estado}
                        </Text>
                        {url ? (
                          <Pressable
                            onPress={abrirRecibo}
                            accessibilityRole="link"
                            accessibilityLabel={`Ver recibo del pago de ${formatearPesos(pago.monto)}`}
                            {...propsEnlaceWeb(abrirRecibo)}
                          >
                            <Text style={styles.tituloOpcion}>Ver recibo</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={styles.tituloSeccion}>Preferencias</Text>

            <View style={styles.tarjetaTamanoFuente}>
              <View style={styles.preferenciaTexto}>
                <Text style={styles.tituloOpcion}>Tamaño de fuente</Text>
                <Text style={styles.descripcionOpcion}>
                  Previsualiza el tamaño en toda la aplicación. Guarda para
                  conservarlo.
                </Text>
              </View>

              <SelectorTamanoFuente
                seleccionado={tamanoFuente.borrador}
                deshabilitado={
                  tamanoFuente.carga !== "ready" ||
                  tamanoFuente.guardando
                }
                onSeleccion={cambiarBorradorTamanoFuente}
              />

              <View style={styles.previsualizacionTamanoFuente}>
                <Text style={styles.etiquetaPrevisualizacion}>
                  Previsualización
                </Text>
                <Text style={styles.textoPrevisualizacion}>
                  Un texto de ejemplo para revisar cómo se ve en tu aplicación.
                </Text>
                <Text
                  role="status"
                  accessibilityLiveRegion="polite"
                  aria-live="polite"
                  style={styles.estadoTamanoFuente}
                >
                  Seleccionado:{" "}
                  {nivelBorrador?.nombre} · {nivelBorrador?.porcentaje}%
                </Text>
                <Text style={styles.estadoTamanoFuente}>
                  Guardado:{" "}
                  {nivelGuardado?.nombre} · {nivelGuardado?.porcentaje}%
                </Text>
              </View>

              {tamanoFuente.error && (
                <View style={styles.errorTamanoFuente}>
                  <Text
                    style={styles.textoErrorTamanoFuente}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    aria-live="assertive"
                  >
                    {tamanoFuente.error}
                  </Text>
                  {tamanoFuente.carga === "error" && (
                    <Pressable
                      onPress={() => void reintentarCargaTamanoFuente()}
                      accessibilityRole="button"
                      style={styles.botonReintentarTamano}
                    >
                      <Text style={styles.textoBotonTamano}>Reintentar</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <Pressable
                onPress={() => void guardarPreferenciaTamano()}
                disabled={
                  !hayCambiosTamano ||
                  tamanoFuente.carga !== "ready" ||
                  tamanoFuente.guardando
                }
                accessibilityRole="button"
                accessibilityState={{
                  busy: tamanoFuente.guardando,
                  disabled:
                    !hayCambiosTamano ||
                    tamanoFuente.carga !== "ready" ||
                    tamanoFuente.guardando,
                }}
                style={[
                  styles.botonGuardarTamano,
                  (!hayCambiosTamano ||
                    tamanoFuente.carga !== "ready" ||
                    tamanoFuente.guardando) &&
                    styles.botonGuardarTamanoInactivo,
                ]}
              >
                <Text style={styles.textoBotonTamano}>
                  {tamanoFuente.guardando
                    ? "Guardando tamaño..."
                    : "Guardar tamaño"}
                </Text>
              </Pressable>
            </View>

            <GuiaLectoresPantalla />

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

            {/* Tema de la app (oscuro por defecto) */}
            <View style={[styles.tarjetaPreferencias, styles.tarjetaTema]}>
              <View style={styles.preferenciaTexto}>
                <Text style={styles.tituloOpcion}>Tema claro</Text>
                <Text style={styles.descripcionOpcion}>
                  {p.esClaro
                    ? "Activado · desactívalo para volver al tema oscuro"
                    : "Cambia la app a colores claros"}
                </Text>
              </View>

              <Pressable
                onPress={() => cambiarTema(p.esClaro ? "oscuro" : "claro")}
                accessibilityRole="switch"
                accessibilityState={{ checked: p.esClaro }}
                accessibilityLabel="Activar tema claro"
                style={[
                  styles.interruptor,
                  p.esClaro && styles.interruptorActivo,
                ]}>
                <View
                  style={[
                    styles.interruptorPunto,
                    p.esClaro && styles.interruptorPuntoActivo,
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
                  onPress={() =>
                    void navegarConProteccionTamanoFuente(() =>
                      router.push("/vehiculo"),
                    )
                  }
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
                  <Icono nombre="chevron-forward" tamano={22} color={p.textoPista3} />
                </Pressable>
              )}

              {modoTransportista && (
                <Pressable
                  onPress={() =>
                    void navegarConProteccionTamanoFuente(() =>
                      router.push("/transportista" as Href),
                    )
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonPanelTransportista,
                    pressed && styles.presionado,
                  ]}>
                  <TextoIcono
                    icono="chevron-forward"
                    alFinal
                    style={styles.textoPanelTransportista}
                  >
                    Ver solicitudes de servicio
                  </TextoIcono>
                </Pressable>
              )}
            </View>

            {esAdmin && (
              <Pressable
                onPress={() =>
                  void navegarConProteccionTamanoFuente(() =>
                    router.push("/admin" as Href),
                  )
                }
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.botonPanelTransportista,
                  pressed && styles.presionado,
                ]}>
                <TextoIcono
                  icono="chevron-forward"
                  alFinal
                  style={styles.textoPanelTransportista}
                >
                  Panel de administración
                </TextoIcono>
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
              <Icono nombre="log-out-outline" tamano={20} color={p.textoError3} />
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
          tipo="exito"
        />
      </View>
    </SafeAreaView>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: p.fondo,
  },

  contenedor: {
    flex: 1,
    backgroundColor: p.fondo,
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
    color: p.textoTenue3,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 5,
  },

  titulo: {
    color: p.textoFuerte,
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
    backgroundColor: p.superficieAlta,
    borderWidth: 3,
    borderColor: p.fondo,
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
    backgroundColor: p.velo(0.07),
    borderWidth: 1,
    borderColor: p.linea(0.08),
  },

  campoBloqueado: {
    backgroundColor: p.velo(0.04),
  },

  campoEtiqueta: {
    color: p.textoTenue,
    fontSize: 11,
    fontWeight: "600",
  },

  campoInput: {
    color: p.textoFuerte,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },

  campoInputBloqueado: {
    color: p.textoDeshabilitado,
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
    color: p.textoFuerte2,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  tituloOpcion: {
    color: p.textoFuerte2,
    fontSize: 12,
    fontWeight: "700",
  },

  descripcionOpcion: {
    color: p.textoTenue,
    fontSize: 10,
    lineHeight: 15,
  },

  tarjetaTamanoFuente: {
    gap: 14,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.13),
    backgroundColor: p.velo(0.045),
  },

  previsualizacionTamanoFuente: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: p.velo(0.055),
  },

  etiquetaPrevisualizacion: {
    color: p.textoTenue,
    fontSize: 12,
    fontWeight: "700",
  },

  textoPrevisualizacion: {
    color: p.textoFuerte,
    fontSize: 16,
    lineHeight: 23,
  },

  estadoTamanoFuente: {
    color: p.textoTenue,
    fontSize: 12,
  },

  errorTamanoFuente: {
    gap: 8,
  },

  textoErrorTamanoFuente: {
    color: p.textoError,
    fontSize: 13,
    lineHeight: 18,
  },

  botonReintentarTamano: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },

  botonGuardarTamano: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: AZUL,
  },

  botonGuardarTamanoInactivo: {
    opacity: 0.42,
  },

  textoBotonTamano: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  tarjetaPreferencias: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.13),
    backgroundColor: p.velo(0.045),
  },

  preferenciaTexto: {
    flex: 1,
    gap: 6,
  },

  tarjetaTema: {
    marginTop: 12,
  },

  interruptor: {
    width: 44,
    height: 25,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
    backgroundColor: p.interruptor,
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },

  interruptorActivo: {
    backgroundColor: "rgba(41,105,233,0.85)",
    borderColor: "rgba(141,178,255,0.65)",
  },

  interruptorPunto: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: p.interruptorPunto,
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


  textoCerrarSesion: {
    color: p.textoError3,
    fontSize: 12,
    fontWeight: "700",
  },

  version: {
    color: p.textoPista2,
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
    borderColor: p.linea(0.13),
    backgroundColor: p.velo(0.045),
  },

  filaModo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  divisorModo: {
    height: 1,
    backgroundColor: p.velo(0.075),
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
    color: p.textoFuerte2,
    fontSize: 11,
    fontWeight: "700",
  },

  textoVolverModo: {
    color: p.acento,
    fontSize: 11,
    fontWeight: "700",
  },

  filaVehiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: p.linea(0.075),
  },

  textoVencido: {
    color: p.textoError,
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
