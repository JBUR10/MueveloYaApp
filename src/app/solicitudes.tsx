// src/app/solicitudes.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";
import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import CalificarServicio from "../components/ui/CalificarServicio";
import MotivoCancelacion from "../components/ui/MotivoCancelacion";
import { alLlegarAviso, mostrarAvisosPendientes } from "../services/avisosStore";
import {
  cancelarServicioCliente,
  escucharCambiosServicios,
  retirarSolicitudPendiente,
  EstadoServicio,
  obtenerMisServicios,
  SolicitudServicioDTO,
} from "../services/servicioService";
import {
  crearPago,
  esperarConfirmacionPago,
  pedirReembolso,
} from "../services/pagoService";
import { pagarServicioStripe } from "../services/pagoStripe";
import { liberarPago, reservarPago } from "../services/pagosEnCurso";
import { useSesion } from "../services/sesionStore";
import DetalleTarifaSolicitud from "../components/DetalleTarifaSolicitud";
import {
  estaIniciado,
  HORAS_MINIMAS_CANCELACION,
  puedeCancelar,
} from "../services/transportistaService";
import Icono, { type NombreIcono } from "../components/ui/Icono";
import TextoIcono from "../components/ui/TextoIcono";
import TextoCalificacion from "../components/ui/TextoCalificacion";
import { usePaleta, useEstilos, type Paleta } from "../services/temaStore";

const AZUL = "#2969e9";

const ESTADOS: Record<
  EstadoServicio,
  { icono: NombreIcono; texto: string }
> = {
  pendiente: {
    icono: "hourglass-outline",
    texto: "Buscando transportista",
  },
  aceptada: {
    icono: "checkmark-circle-outline",
    texto: "Aceptada · el transportista va a recoger",
  },
  en_curso: {
    icono: "navigate-outline",
    texto: "En camino al destino",
  },
  completada: {
    icono: "checkmark-done-outline",
    texto: "Completada",
  },
  cancelada: {
    icono: "close-circle-outline",
    texto: "Cancelaste este servicio",
  },
};

/** Lo que se puede estar haciendo con una solicitud. */
type Operacion = "pagando" | "cancelando" | "eliminando";

/** Colores de cada estado (el texto cambia según el tema; fondo y borde son translúcidos). */
const coloresEstado = (
  p: Paleta,
): Record<EstadoServicio, { color: string; fondo: string; borde: string }> => ({
  pendiente: {
    color: p.textoAviso,
    fondo: "rgba(251,191,36,0.10)",
    borde: "rgba(251,191,36,0.35)",
  },
  aceptada: {
    color: p.acento,
    fondo: "rgba(41,105,233,0.12)",
    borde: "rgba(41,105,233,0.4)",
  },
  en_curso: {
    color: p.textoExito2,
    fondo: "rgba(80,220,164,0.10)",
    borde: "rgba(80,220,164,0.35)",
  },
  completada: {
    color: p.textoExito2,
    fondo: "rgba(80,220,164,0.10)",
    borde: "rgba(80,220,164,0.35)",
  },
  cancelada: {
    color: p.textoError,
    fondo: "rgba(239,68,68,0.10)",
    borde: "rgba(239,68,68,0.35)",
  },
});

/** Texto del estado según si el servicio programado ya se inició. */
const textoEstado = (
  item: SolicitudServicioDTO,
): { icono: NombreIcono; texto: string } => {
  const estado = item.estado ?? "pendiente";
  if (estado !== "aceptada") return ESTADOS[estado];
  return estaIniciado(item)
    ? { icono: "navigate-outline", texto: "El transportista va hacia el punto de recogida" }
    : {
        icono: "checkmark-circle-outline",
        texto: `Aceptada · programado para el ${item.fechaProgramada}`,
      };
};

const formatearFecha = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function SolicitudesScreen() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const router = useRouter();
  const [servicios, setServicios] = useState<SolicitudServicioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Operación en curso de cada solicitud: una no toca los botones de las demás.
  const [operaciones, setOperaciones] = useState<Record<string, Operacion>>({});
  // Copia inmediata: impide un segundo toque antes de que la pantalla cambie.
  const ocupadas = useRef(new Set<string>());
  // Solicitudes pagadas cuya confirmación de Stripe aún se espera.
  const [confirmandoPagos, setConfirmandoPagos] = useState<string[]>([]);
  const [calificandoId, setCalificandoId] = useState<string | null>(null);
  // Servicio que se está cancelando (abre el selector de motivo).
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const { pago, servicio_id: servicioIdRetorno } = useLocalSearchParams<{
    pago?: string;
    servicio_id?: string;
  }>();
  const uid = useSesion().sesion?.user.id;

  const cargarServicios = useCallback(async () => {
    try {
      const data = await obtenerMisServicios();
      setServicios(data);
      setConfirmandoPagos((actuales) =>
        actuales.filter(
          (id) => !data.some((s) => s.id === id && s.pagoEstado === "pagado"),
        ),
      );
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (pago === "ok") {
      if (servicioIdRetorno) {
        void esperarConfirmacionPago(servicioIdRetorno)
          .then(async (confirmado) => {
            await cargarServicios();
            if (confirmado) {
              await aviso("Pago confirmado", "Tu solicitud ya está disponible para los transportistas.", "exito");
            } else {
              await aviso("Confirmación pendiente", "Stripe todavía está notificando el pago. No vuelvas a pagarlo; actualiza la pantalla en unos segundos.", "advertencia");
            }
          })
          .catch((error) => {
            console.error("No se pudo confirmar el pago:", error);
            void aviso("Confirmación pendiente", "No vuelvas a pagar. Actualiza la pantalla en unos segundos para consultar el estado.", "advertencia");
          });
      } else {
        aviso("Pago recibido", "Estamos confirmando tu pago. Te avisaremos cuando esté listo.", "info");
      }
    } else if (pago === "cancelado") {
      aviso("Pago cancelado", "La solicitud sigue pendiente y puedes pagarla desde aquí.", "advertencia");
    }
  }, [pago, servicioIdRetorno, cargarServicios]);

  // Carga al entrar, muestra los avisos sin leer (si un servicio finalizó,
  // abre la calificación) y se actualiza sola cuando el transportista avanza.
  useFocusEffect(
    useCallback(() => {
      cargarServicios().then(() => mostrarAvisosPendientes(setCalificandoId));
      const dejarDeEscuchar = escucharCambiosServicios(cargarServicios);
      // Con la pantalla abierta, un aviso nuevo (aceptada, cancelada...) se
      // muestra al instante, sin tener que salir y volver a entrar.
      const dejarAvisos = alLlegarAviso(() =>
        cargarServicios().then(() => mostrarAvisosPendientes(setCalificandoId)),
      );
      return () => {
        dejarDeEscuchar();
        dejarAvisos();
      };
    }, [cargarServicios]),
  );

  /** Marca la solicitud como ocupada. Devuelve false si ya lo estaba. */
  const iniciarOperacion = (id: string, operacion: Operacion) => {
    if (ocupadas.current.has(id)) return false;
    ocupadas.current.add(id);
    setOperaciones((actuales) => ({ ...actuales, [id]: operacion }));
    return true;
  };

  const terminarOperacion = (id: string) => {
    ocupadas.current.delete(id);
    setOperaciones((actuales) => {
      const resto = { ...actuales };
      delete resto[id];
      return resto;
    });
  };

  // Web: al volver con «Atrás» desde la página de pago, el navegador puede
  // restaurar la pantalla como estaba; se quitan los pagos que quedaron marcados.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const alRestaurar = (evento: PageTransitionEvent) => {
      if (!evento.persisted) return;
      ocupadas.current.clear();
      setOperaciones({});
    };
    window.addEventListener("pageshow", alRestaurar);
    return () => window.removeEventListener("pageshow", alRestaurar);
  }, []);

  const servicioCalificando =
    servicios.find((s) => s.id === calificandoId) ?? null;

  const alCalificar = async (tuvoProblema: boolean) => {
    const id = calificandoId;
    setCalificandoId(null);
    cargarServicios();
    if (tuvoProblema) {
      router.push({ pathname: "/queja", params: { servicio: id ?? "" } });
      return;
    }
    await aviso(
      "¡Gracias por preferirnos!",
      "Tu calificación al transportista y a la app nos ayuda a mejorar cada servicio.",
      "exito",
    );
  };

  const handleCancelar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    if (!puedeCancelar(item)) {
      await aviso(
        "No se puede cancelar",
        `Solo puedes cancelar con al menos ${HORAS_MINIMAS_CANCELACION} horas de anticipación.`,
        "advertencia",
      );
      return;
    }
    // El motivo es obligatorio: se elige en el modal y se envía al confirmar.
    setCancelandoId(item.id);
  };

  /** Lo llama el selector de motivo. Si falla, el error se ve en el modal. */
  const confirmarCancelacion = async (motivo: string) => {
    const id = cancelandoId;
    if (!id) return;
    // El error lo muestra el selector de motivo.
    if (!iniciarOperacion(id, "cancelando")) {
      throw new Error("Esta solicitud ya tiene una operación en curso.");
    }
    try {
      await cancelarServicioCliente(id, motivo);
      if (servicios.find((s) => s.id === id)?.pagoEstado === "pagado") {
        try {
          await pedirReembolso(id);
          await aviso("Servicio cancelado", "Solicitud de reembolso enviada. El banco puede tardar unos días.", "info");
        } catch {
          await aviso("Reembolso pendiente", "Reintenta el reembolso desde esta solicitud.", "advertencia");
        }
      }
    } finally {
      terminarOperacion(id);
    }
    setCancelandoId(null);
    await cargarServicios();
    await aviso(
      "Servicio cancelado",
      "Le avisamos al transportista con el motivo que indicaste.",
      "info",
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarServicios();
  }, [cargarServicios]);

  const handleEliminar = async (id?: string) => {
    if (!id) {
      await aviso(
        "Atención",
        "Este servicio no cuenta con un identificador válido.",
        "advertencia",
      );
      return;
    }

    const ok = await confirmar({
      titulo: "Eliminar solicitud",
      mensaje:
        "¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.",
      textoAceptar: "Eliminar",
      destructivo: true,
    });
    if (!ok) return;
    if (!iniciarOperacion(id, "eliminando")) return;

    try {
      const item = servicios.find((s) => s.id === id);
      await retirarSolicitudPendiente(id);
      if (item?.pagoEstado === "pagado") {
        await pedirReembolso(id).catch(() => null);
      }
      setServicios((prev) => prev.filter((s) => String(s.id) !== String(id)));
    } catch (error: any) {
      await aviso("Error", error?.message || "No se pudo eliminar", "error");
      cargarServicios();
    } finally {
      terminarOperacion(id);
    }
  };

  const handlePagar = async (item: SolicitudServicioDTO) => {
    const id = item.id;
    if (!id) return;
    if (!reservarPago(id)) {
      await aviso("Pago en curso", "Ya se está iniciando el pago de esta solicitud.", "info");
      return;
    }
    if (!iniciarOperacion(id, "pagando")) {
      liberarPago(id);
      return;
    }
    // Web: mientras el navegador va a la página de pago, sigue bloqueado.
    let redirigiendo = false;
    try {
      const plataforma = Platform.OS === "web" ? "web" : "movil";
      const pago = await crearPago(id, plataforma);
      if (pago.gratis) {
        await cargarServicios();
        return;
      }
      if (plataforma === "web") {
        const resultado = await pagarServicioStripe({ checkoutUrl: pago.checkoutUrl ?? "" });
        redirigiendo = resultado.estado !== "error";
      } else if (pago.paymentIntentClientSecret && pago.customerId && pago.ephemeralKeySecret) {
        const resultado = await pagarServicioStripe({
          paymentIntentClientSecret: pago.paymentIntentClientSecret,
          customerId: pago.customerId,
          ephemeralKeySecret: pago.ephemeralKeySecret,
        }, p);
        if (resultado.estado === "pagado") {
          setConfirmandoPagos((actuales) => [...actuales, id]);
          let confirmado = false;
          try {
            confirmado = await esperarConfirmacionPago(id);
          } catch (error) {
            console.error("No se pudo consultar la confirmación de Stripe:", error);
          }
          await aviso(
            confirmado ? "Pago confirmado" : "Confirmación pendiente",
            confirmado
              ? "Tu solicitud ya está disponible para los transportistas."
              : "Stripe todavía está notificando el pago. No vuelvas a pagarlo; actualiza la pantalla en unos segundos.",
            confirmado ? "exito" : "advertencia",
          );
        } else {
          await aviso(
            resultado.estado === "cancelado" ? "Pago cancelado" : "No se pudo completar el pago",
            resultado.mensaje ?? "Inténtalo nuevamente.",
            resultado.estado === "cancelado" ? "advertencia" : "error",
          );
        }
        await cargarServicios();
      }
    } catch (error: any) {
      await aviso("Pagos no disponibles", error?.message ?? "No se pudo iniciar el pago.", "error");
    } finally {
      if (!redirigiendo) {
        terminarOperacion(id);
        liberarPago(id);
      }
    }
  };

  const esInmediato = (item: SolicitudServicioDTO) =>
    item.tipoProgramacion === "inmediato" ||
    item.fechaProgramada === "Inmediato" ||
    !item.fechaProgramada;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={p.barraEstado} backgroundColor={p.fondo} />

      <View style={styles.mainContainer}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={AZUL}
            />
          }
        >
          {/* Barra superior */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.push("/")}
              style={styles.btnBack}
              activeOpacity={0.8}
            >
              <TextoIcono icono="arrow-back" style={styles.btnBackText}>
                Inicio
              </TextoIcono>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/servicios")}
              style={styles.btnNew}
              activeOpacity={0.8}
            >
              <Text style={styles.btnNewText}>+ Nuevo servicio</Text>
            </TouchableOpacity>
          </View>

          {/* Encabezado */}
          <View style={styles.headerContainer}>
            <Text style={styles.subtitleHeader}>HISTORIAL</Text>
            <Text style={styles.titleHeader}>
              Mis <Text style={styles.titleHighlight}>Solicitudes</Text>
            </Text>
            {!loading && servicios.length > 0 && (
              <Text
                style={styles.counterText}
                role="status"
                accessibilityLiveRegion="polite"
                aria-live="polite"
              >
                {servicios.length}{" "}
                {servicios.length === 1
                  ? "solicitud registrada"
                  : "solicitudes registradas"}
              </Text>
            )}
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator
                size="large"
                color={AZUL}
                accessibilityLabel="Cargando solicitudes"
              />
            </View>
          ) : servicios.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icono
                nombre="cube-outline"
                tamano={44}
                color={p.textoAlfa(0.7)}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Aún no tienes solicitudes</Text>
              <Text style={styles.emptyText}>
                Cuando solicites un servicio aparecerá aquí con todos sus
                detalles.
              </Text>
              <TouchableOpacity
                style={styles.btnCreateEmpty}
                onPress={() => router.push("/servicios")}
                activeOpacity={0.8}
              >
                <Text style={styles.btnCreateEmptyText}>
                  Solicitar un servicio
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            servicios.map((item, index) => {
              const inmediato = esInmediato(item);
              const operacion = item.id ? operaciones[item.id] : undefined;
              const ocupada = !!operacion;
              const pagando = operacion === "pagando";
              const cancelando = operacion === "cancelando";
              const eliminando = operacion === "eliminando";
              const confirmandoPago =
                confirmandoPagos.includes(item.id ?? "") ||
                (pago === "ok" && servicioIdRetorno === item.id);
              const estadoItem = item.estado ?? "pendiente";
              const estado = {
                ...ESTADOS[estadoItem],
                ...coloresEstado(p)[estadoItem],
              };
              const t = item.transportista;
              // Aceptada y sin iniciar: se puede cancelar (con 48 h de margen).
              const cancelable = estadoItem === "aceptada" && !estaIniciado(item);
              const cancelacionBloqueada = cancelable && !puedeCancelar(item);
              const porCalificar =
                estadoItem === "completada" &&
                !!uid &&
                !item.calificadoPor?.includes(uid);
              // Completa las etiquetas de los botones: dice de cuál tarjeta son.
              const nombreSolicitud = `solicitud de ${item.tipoServicio}, desde ${item.origen} hasta ${item.destino}`;
              const pagoVisual = item.pagoEstado === "pagado"
                ? {
                    color: p.textoExito2,
                    fondo: "rgba(80,220,164,0.10)",
                    borde: "rgba(80,220,164,0.35)",
                  }
                : item.pagoEstado === "reembolsado"
                  ? {
                      color: p.acento,
                      fondo: "rgba(41,105,233,0.12)",
                      borde: "rgba(41,105,233,0.4)",
                    }
                  : {
                      color: p.textoAviso,
                      fondo: "rgba(251,191,36,0.10)",
                      borde: "rgba(251,191,36,0.35)",
                    };

              return (
                <View
                  key={item.id || String(index)}
                  style={[styles.cardService, ocupada && { opacity: 0.5 }]}
                >
                  {/* Encabezado de la tarjeta */}
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTypeBadge} numberOfLines={1}>
                      {item.tipoServicio}
                    </Text>
                    <View
                      style={[
                        styles.statusChip,
                        inmediato ? styles.chipImmediate : styles.chipScheduled,
                      ]}
                    >
                      <TextoIcono
                        icono={inmediato ? "flash" : "calendar-outline"}
                        accessibilityLabel={
                          inmediato
                            ? "Servicio inmediato"
                            : `Servicio programado para ${item.fechaProgramada}`
                        }
                        style={[
                          styles.statusChipText,
                          { color: inmediato ? p.textoAviso : p.azulTexto },
                        ]}
                      >
                        {inmediato ? "Inmediato" : item.fechaProgramada}
                      </TextoIcono>
                    </View>
                  </View>

                  {/* Estado de la solicitud */}
                  <View
                    style={[
                      styles.estadoBox,
                      { backgroundColor: estado.fondo, borderColor: estado.borde },
                    ]}
                  >
                    <TextoIcono
                      icono={textoEstado(item).icono}
                      accessibilityLabel={`Estado de la solicitud: ${textoEstado(item).texto}`}
                      style={[styles.estadoTexto, { color: estado.color }]}
                    >
                      {textoEstado(item).texto}
                    </TextoIcono>
                    {estadoItem === "cancelada" && !!item.motivoCancelacion && (
                      <Text style={styles.motivoTexto}>
                        Motivo: {item.motivoCancelacion}
                      </Text>
                    )}
                  </View>

                  {item.metodoPago === "efectivo" ? (
                    <View
                      style={[
                        styles.estadoBox,
                        {
                          backgroundColor: pagoVisual.fondo,
                          borderColor: pagoVisual.borde,
                        },
                      ]}
                    >
                      <TextoIcono
                        icono="cash-outline"
                        style={[styles.estadoTexto, { color: pagoVisual.color }]}
                      >
                        {estadoItem === "completada"
                          ? "Servicio finalizado · pago en efectivo"
                          : estadoItem === "cancelada"
                            ? "Servicio cancelado · el método elegido era efectivo"
                            : "Efectivo pendiente al finalizar el servicio"}
                      </TextoIcono>
                    </View>
                  ) : item.pagoEstado !== "no_aplica" ? (
                    <View
                      style={[
                        styles.estadoBox,
                        {
                          backgroundColor: pagoVisual.fondo,
                          borderColor: pagoVisual.borde,
                        },
                      ]}
                    >
                      <TextoIcono
                        icono={
                          item.pagoEstado === "pagado"
                            ? "card"
                            : item.pagoEstado === "reembolsado"
                              ? "return-up-back"
                              : "time-outline"
                        }
                        style={[styles.estadoTexto, { color: pagoVisual.color }]}
                      >
                        {item.pagoEstado === "pagado"
                          ? "Pagado"
                          : item.pagoEstado === "reembolsado"
                            ? "Reembolsado"
                            : "Pago pendiente"}
                      </TextoIcono>
                    </View>
                  ) : null}

                  {/* Transportista asignado */}
                  {t && estadoItem !== "pendiente" && estadoItem !== "cancelada" && (
                    <View style={styles.transportistaBox}>
                      <View style={styles.transportistaDatos}>
                        <Text style={styles.descLabel}>TU TRANSPORTISTA</Text>
                        <TextoIcono
                          icono="car-outline"
                          style={styles.contactName}
                          numberOfLines={2}
                        >
                          {t.nombre || "Transportista"}
                        </TextoIcono>
                        {t.vehiculo && (
                          <Text style={styles.vehiculoTexto} numberOfLines={2}>
                            {t.vehiculo.tipo} · {t.vehiculo.placa}
                            {t.vehiculo.marcaModelo
                              ? ` · ${t.vehiculo.marcaModelo}`
                              : ""}
                          </Text>
                        )}
                        <TextoCalificacion
                          calificacion={t.calificacion}
                          style={styles.calificacionTexto}
                        />
                      </View>
                      {!!t.telefono && estadoItem !== "completada" && (
                        <TouchableOpacity
                          style={styles.btnLlamar}
                          accessibilityRole="button"
                          accessibilityLabel={`Llamar a ${t.nombre || "transportista"}, ${nombreSolicitud}`}
                          onPress={() =>
                            Linking.openURL(`tel:${t.telefono}`).catch(() =>
                              aviso(
                                "Error",
                                "No se pudo iniciar la llamada.",
                                "error",
                              ),
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <TextoIcono icono="call-outline" style={styles.btnLlamarText}>
                            Llamar
                          </TextoIcono>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Ruta tipo línea de tiempo */}
                  <View style={styles.routeContainer}>
                    <View style={styles.timelineCol}>
                      <View style={[styles.dot, { backgroundColor: AZUL }]} />
                      <View style={styles.timelineLine} />
                      <View
                        style={[styles.dot, { backgroundColor: "#72BFCB" }]}
                      />
                    </View>
                    <View style={styles.routeTexts}>
                      <View style={styles.routeBlock}>
                        <Text style={styles.routeLabel}>RECOGIDA</Text>
                        <Text style={styles.routeValue}>
                          {item.origen}
                        </Text>
                      </View>
                      <View style={styles.routeBlock}>
                        <Text style={styles.routeLabel}>ENTREGA</Text>
                        <Text style={styles.routeValue}>
                          {item.destino}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Detalle */}
                  {item.descripcion ? (
                    <View style={styles.descBox}>
                      <Text style={styles.descLabel}>DETALLE</Text>
                      <Text style={styles.cardDesc}>
                        {item.descripcion}
                      </Text>
                    </View>
                  ) : null}

                  <DetalleTarifaSolicitud item={item} />

                  {/* Pie: contacto + eliminar */}
                  <View style={styles.cardFooter}>
                    <View style={styles.contactInfo}>
                      <TextoIcono
                        icono="person-outline"
                        style={styles.contactName}
                        numberOfLines={2}
                      >
                        {item.nombreContacto}
                      </TextoIcono>
                      {item.telefonoContacto ? (
                        <TextoIcono
                          icono="call-outline"
                          style={styles.contactPhone}
                          numberOfLines={2}
                        >
                          {item.telefonoContacto}
                        </TextoIcono>
                      ) : null}
                      {item.fecha ? (
                        <Text style={styles.createdAt}>
                          Creada el {formatearFecha(item.fecha)}
                        </Text>
                      ) : null}
                    </View>

                    {estadoItem === "pendiente" &&
                      item.metodoPago === "stripe" &&
                      item.pagoEstado === "pendiente_pago" &&
                      !confirmandoPago && (
                        <TouchableOpacity
                          onPress={() => handlePagar(item)}
                          style={styles.btnCalificar}
                          activeOpacity={0.8}
                          disabled={ocupada}
                          accessibilityRole="button"
                          accessibilityLabel={
                            pagando
                              ? `Pagando ${nombreSolicitud}`
                              : `Pagar ahora, ${nombreSolicitud}`
                          }
                          accessibilityState={{ disabled: ocupada, busy: pagando }}
                          aria-busy={pagando}
                        >
                          {pagando ? (
                            <ActivityIndicator size="small" color="#1a1300" />
                          ) : (
                            <TextoIcono icono="card" style={styles.btnCalificarText}>
                              Pagar ahora
                            </TextoIcono>
                          )}
                        </TouchableOpacity>
                      )}
                    {estadoItem === "pendiente" &&
                      item.metodoPago === "stripe" &&
                      item.pagoEstado === "pendiente_pago" &&
                      confirmandoPago && (
                        <Text style={styles.textoBloqueo}>Confirmando pago con Stripe…</Text>
                      )}

                    {/* Aceptada sin iniciar: el cliente puede cancelar. */}
                    {cancelable && (
                      <TouchableOpacity
                        onPress={() => handleCancelar(item)}
                        style={[
                          styles.btnDelete,
                          cancelacionBloqueada && styles.btnBloqueado,
                        ]}
                        activeOpacity={0.7}
                        disabled={ocupada || cancelacionBloqueada}
                        accessibilityRole="button"
                        accessibilityLabel={`${cancelando ? "Cancelando" : "Cancelar"} ${nombreSolicitud}`}
                        // En web el motivo se lee en el texto visible de abajo.
                        accessibilityHint={
                          cancelacionBloqueada
                            ? "No se puede cancelar porque faltan menos horas de las permitidas."
                            : undefined
                        }
                        accessibilityState={{
                          disabled: ocupada || cancelacionBloqueada,
                          busy: cancelando,
                        }}
                        aria-busy={cancelando}
                      >
                        {cancelando ? (
                          <ActivityIndicator size="small" color={p.textoError} />
                        ) : (
                          <TextoIcono
                            icono={
                              cancelacionBloqueada
                                ? "lock-closed-outline"
                                : "close-outline"
                            }
                            style={[
                              styles.btnDeleteText,
                              cancelacionBloqueada && styles.btnBloqueadoText,
                            ]}
                          >
                            Cancelar
                          </TextoIcono>
                        )}
                      </TouchableOpacity>
                    )}

                    {porCalificar && (
                      <TouchableOpacity
                        onPress={() => setCalificandoId(item.id ?? null)}
                        style={styles.btnCalificar}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Calificar ${nombreSolicitud}`}
                      >
                        <TextoIcono icono="star" style={styles.btnCalificarText}>
                          Calificar
                        </TextoIcono>
                      </TouchableOpacity>
                    )}

                    {/* Solo se puede eliminar mientras nadie la ha tomado. */}
                    {estadoItem === "pendiente" && (
                      <TouchableOpacity
                        onPress={() => handleEliminar(item.id)}
                        style={styles.btnDelete}
                        activeOpacity={0.7}
                        disabled={ocupada}
                        accessibilityRole="button"
                        accessibilityLabel={`${eliminando ? "Eliminando" : "Eliminar"} ${nombreSolicitud}`}
                        accessibilityState={{ disabled: ocupada, busy: eliminando }}
                        aria-busy={eliminando}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {eliminando ? (
                          <ActivityIndicator size="small" color={p.textoError} />
                        ) : (
                          <TextoIcono icono="trash-outline" style={styles.btnDeleteText}>
                            Eliminar
                          </TextoIcono>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {cancelacionBloqueada && (
                    <Text style={styles.textoBloqueo}>
                      Faltan menos de {HORAS_MINIMAS_CANCELACION} horas para el
                      servicio: ya no se puede cancelar.
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <BarraNavegacion />

        <MotivoCancelacion
          visible={!!cancelandoId}
          rol="usuario"
          onCerrar={() => setCancelandoId(null)}
          onConfirmar={confirmarCancelacion}
        />

        <CalificarServicio
          servicioId={servicioCalificando ? calificandoId : null}
          rol="cliente"
          nombreCalificado={servicioCalificando?.transportista?.nombre ?? ""}
          onCerrar={() => setCalificandoId(null)}
          onEnviado={alCalificar}
        />
      </View>
    </SafeAreaView>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: p.fondo },
  mainContainer: { flex: 1, backgroundColor: p.fondo },
  container: { flex: 1, backgroundColor: p.fondo },
  contentContainer: {
    paddingHorizontal: 20, // Igualado a los 20 de la pantalla principal
    paddingTop: 16,
    paddingBottom: 90,
  },

  // Barra superior
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  btnBack: {
    backgroundColor: p.velo(0.1),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnBackText: { color: p.texto, fontWeight: "700", fontSize: 13 },
  btnNew: {
    backgroundColor: AZUL,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnNewText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },

  // Encabezado
  headerContainer: { marginBottom: 20 },
  subtitleHeader: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: p.textoTitulo,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
    textShadowColor: p.sombraTexto(0.65),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  titleHighlight: { color: AZUL },
  counterText: { color: p.textoTenue2, fontSize: 13, marginTop: 4 },

  loaderContainer: { marginTop: 50, alignItems: "center" },

  // Estado vacío
  emptyContainer: {
    marginTop: 30,
    alignItems: "center",
    backgroundColor: p.panel(0.94),
    padding: 28,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.2),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  emptyIcon: { marginBottom: 10 },
  emptyTitle: {
    color: p.texto,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textShadowColor: p.sombraTexto(0.55),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyText: {
    color: p.textoAlfa(0.6),
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 19,
  },
  btnCreateEmpty: {
    backgroundColor: AZUL,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  btnCreateEmptyText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },

  // Tarjeta (Igualando la sombra y bordes del panelPunto de la pantalla inicial)
  cardService: {
    backgroundColor: p.panel(0.94),
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  cardTypeBadge: {
    flexShrink: 1,
    color: "#FFFFFF",
    backgroundColor: AZUL,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    fontWeight: "800",
    fontSize: 12,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipImmediate: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.4)",
  },
  chipScheduled: {
    backgroundColor: "rgba(41,105,233,0.12)",
    borderColor: "rgba(41,105,233,0.4)",
  },
  statusChipText: { fontSize: 11, fontWeight: "700" },

  // Ruta
  routeContainer: {
    flexDirection: "row",
    backgroundColor: p.velo(0.03),
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.linea(0.08),
    marginBottom: 12,
  },
  timelineCol: { alignItems: "center", marginRight: 12, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: p.velo(0.15),
    marginVertical: 4,
  },
  routeTexts: { flex: 1 },
  routeBlock: { marginBottom: 10 },
  routeLabel: {
    color: p.textoAlfa(0.6),
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeValue: { color: p.texto, fontSize: 14, fontWeight: "700" },

  // Detalle
  descBox: { marginBottom: 12 },
  descLabel: {
    color: p.textoAlfa(0.6),
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardDesc: { color: p.textoSuave, fontSize: 13, lineHeight: 18 },

  // Pie
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: p.linea(0.1),
    paddingTop: 12,
    gap: 10,
  },
  contactInfo: { flex: 1 },
  contactName: { color: p.texto, fontSize: 13, fontWeight: "700" },
  contactPhone: {
    color: p.azulTexto,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  createdAt: { color: p.textoAlfa(0.5), fontSize: 11, marginTop: 4 },
  btnDelete: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDeleteText: { color: p.textoError, fontSize: 12, fontWeight: "800" },

  // Estado y transportista
  estadoBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  motivoTexto: { color: p.textoAlfa(0.7), fontSize: 12, marginTop: 4 },
  estadoTexto: { fontSize: 12, fontWeight: "800" },
  transportistaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(41,105,233,0.35)",
    backgroundColor: "rgba(41,105,233,0.08)",
    marginBottom: 12,
  },
  transportistaDatos: { flex: 1 },
  vehiculoTexto: { color: p.textoTenue, fontSize: 12, marginTop: 2 },
  btnLlamar: {
    backgroundColor: AZUL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  btnLlamarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  calificacionTexto: { color: p.textoAviso, fontSize: 12, fontWeight: "700", marginTop: 2 },
  btnCalificar: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 92,
    alignItems: "center",
  },
  btnCalificarText: { color: "#1a1300", fontSize: 12, fontWeight: "900" },
  btnBloqueado: {
    backgroundColor: p.velo(0.05),
    borderColor: p.linea(0.12),
  },
  btnBloqueadoText: { color: p.textoAlfa(0.35) },
  textoBloqueo: {
    color: p.textoAlfa(0.5),
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
});
