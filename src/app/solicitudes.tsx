// src/app/solicitudes.tsx
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import CalificarServicio from "../components/ui/CalificarServicio";
import { mostrarAvisosPendientes } from "../services/avisosStore";
import {
  cancelarServicioCliente,
  eliminarServicio,
  escucharCambiosServicios,
  EstadoServicio,
  obtenerMisServicios,
  SolicitudServicioDTO,
  textoCalificacion,
} from "../services/servicioService";
import { useSesion } from "../services/sesionStore";
import {
  estaIniciado,
  HORAS_MINIMAS_CANCELACION,
  puedeCancelar,
} from "../services/transportistaService";

const AZUL = "#2969e9";
const FONDO = "#111318";

const ESTADOS: Record<
  EstadoServicio,
  { texto: string; color: string; fondo: string; borde: string }
> = {
  pendiente: {
    texto: "⏳ Buscando transportista",
    color: "#fbbf24",
    fondo: "rgba(251,191,36,0.10)",
    borde: "rgba(251,191,36,0.35)",
  },
  aceptada: {
    texto: "✓ Aceptada · el transportista va a recoger",
    color: "#8DB2FF",
    fondo: "rgba(41,105,233,0.12)",
    borde: "rgba(41,105,233,0.4)",
  },
  en_curso: {
    texto: "🚚 En camino al destino",
    color: "#86E8BD",
    fondo: "rgba(80,220,164,0.10)",
    borde: "rgba(80,220,164,0.35)",
  },
  completada: {
    texto: "✓ Completada",
    color: "#86E8BD",
    fondo: "rgba(80,220,164,0.10)",
    borde: "rgba(80,220,164,0.35)",
  },
  cancelada: {
    texto: "✕ Cancelaste este servicio",
    color: "#fca5a5",
    fondo: "rgba(239,68,68,0.10)",
    borde: "rgba(239,68,68,0.35)",
  },
};

/** Texto del estado según si el servicio programado ya se inició. */
const textoEstado = (item: SolicitudServicioDTO) => {
  const estado = item.estado ?? "pendiente";
  if (estado !== "aceptada") return ESTADOS[estado].texto;
  return estaIniciado(item)
    ? "🚚 El transportista va hacia el punto de recogida"
    : `✓ Aceptada · programado para el ${item.fechaProgramada}`;
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
  const router = useRouter();
  const [servicios, setServicios] = useState<SolicitudServicioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [calificandoId, setCalificandoId] = useState<string | null>(null);
  const uid = useSesion().sesion?.user.id;

  const cargarServicios = useCallback(async () => {
    try {
      const data = await obtenerMisServicios();
      setServicios(data);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Carga al entrar, muestra los avisos sin leer (si un servicio finalizó,
  // abre la calificación) y se actualiza sola cuando el transportista avanza.
  useFocusEffect(
    useCallback(() => {
      cargarServicios().then(() => mostrarAvisosPendientes(setCalificandoId));
      return escucharCambiosServicios(cargarServicios);
    }, [cargarServicios]),
  );

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
      "¡Gracias por preferirnos! 💙",
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
    const ok = await confirmar({
      titulo: "Cancelar servicio",
      mensaje:
        "¿Seguro que deseas cancelar este servicio? Le avisaremos al transportista.",
      textoAceptar: "Cancelar servicio",
      textoCancelar: "Volver",
      destructivo: true,
    });
    if (!ok) return;

    try {
      setEliminandoId(item.id);
      await cancelarServicioCliente(item.id);
      await cargarServicios();
      await aviso("Servicio cancelado", "Le avisamos al transportista.", "info");
    } catch (error: any) {
      await aviso("Error", error?.message || "No se pudo cancelar.", "error");
    } finally {
      setEliminandoId(null);
    }
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

    try {
      setEliminandoId(id);
      await eliminarServicio(id);
      setServicios((prev) => prev.filter((s) => String(s.id) !== String(id)));
    } catch (error: any) {
      await aviso("Error", error?.message || "No se pudo eliminar", "error");
      cargarServicios();
    } finally {
      setEliminandoId(null);
    }
  };

  const esInmediato = (item: SolicitudServicioDTO) =>
    item.tipoProgramacion === "inmediato" ||
    item.fechaProgramada === "Inmediato" ||
    !item.fechaProgramada;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

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
              <Text style={styles.btnBackText}>← Inicio</Text>
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
              <Text style={styles.counterText}>
                {servicios.length}{" "}
                {servicios.length === 1
                  ? "solicitud registrada"
                  : "solicitudes registradas"}
              </Text>
            )}
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={AZUL} />
            </View>
          ) : servicios.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
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
              const borrando = eliminandoId === item.id;
              const estadoItem = item.estado ?? "pendiente";
              const estado = ESTADOS[estadoItem];
              const t = item.transportista;
              // Aceptada y sin iniciar: se puede cancelar (con 48 h de margen).
              const cancelable = estadoItem === "aceptada" && !estaIniciado(item);
              const cancelacionBloqueada = cancelable && !puedeCancelar(item);
              const porCalificar =
                estadoItem === "completada" &&
                !!uid &&
                !item.calificadoPor?.includes(uid);

              return (
                <View
                  key={item.id || String(index)}
                  style={[styles.cardService, borrando && { opacity: 0.5 }]}
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
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: inmediato ? "#fbbf24" : AZUL },
                        ]}
                      >
                        {inmediato
                          ? "⚡ Inmediato"
                          : `📅 ${item.fechaProgramada}`}
                      </Text>
                    </View>
                  </View>

                  {/* Estado de la solicitud */}
                  <View
                    style={[
                      styles.estadoBox,
                      { backgroundColor: estado.fondo, borderColor: estado.borde },
                    ]}
                  >
                    <Text style={[styles.estadoTexto, { color: estado.color }]}>
                      {textoEstado(item)}
                    </Text>
                  </View>

                  {/* Transportista asignado */}
                  {t && estadoItem !== "pendiente" && estadoItem !== "cancelada" && (
                    <View style={styles.transportistaBox}>
                      <View style={styles.transportistaDatos}>
                        <Text style={styles.descLabel}>TU TRANSPORTISTA</Text>
                        <Text style={styles.contactName} numberOfLines={1}>
                          🚚 {t.nombre || "Transportista"}
                        </Text>
                        {t.vehiculo && (
                          <Text style={styles.vehiculoTexto} numberOfLines={1}>
                            {t.vehiculo.tipo} · {t.vehiculo.placa}
                            {t.vehiculo.marcaModelo
                              ? ` · ${t.vehiculo.marcaModelo}`
                              : ""}
                          </Text>
                        )}
                        <Text style={styles.calificacionTexto}>
                          {textoCalificacion(t.calificacion)}
                        </Text>
                      </View>
                      {!!t.telefono && estadoItem !== "completada" && (
                        <TouchableOpacity
                          style={styles.btnLlamar}
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
                          <Text style={styles.btnLlamarText}>📞 Llamar</Text>
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
                        <Text style={styles.routeValue} numberOfLines={2}>
                          {item.origen}
                        </Text>
                      </View>
                      <View style={styles.routeBlock}>
                        <Text style={styles.routeLabel}>ENTREGA</Text>
                        <Text style={styles.routeValue} numberOfLines={2}>
                          {item.destino}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Detalle */}
                  {item.descripcion ? (
                    <View style={styles.descBox}>
                      <Text style={styles.descLabel}>DETALLE</Text>
                      <Text style={styles.cardDesc} numberOfLines={3}>
                        {item.descripcion}
                      </Text>
                    </View>
                  ) : null}

                  {/* Métricas */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricValue}>{item.ayudantes}</Text>
                      <Text style={styles.metricLabel}>Ayudantes</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metricBox}>
                      <Text style={styles.metricValue}>
                        {item.pisosEscaleras}
                      </Text>
                      <Text style={styles.metricLabel}>Pisos</Text>
                    </View>
                  </View>

                  {/* Pie: contacto + eliminar */}
                  <View style={styles.cardFooter}>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName} numberOfLines={1}>
                        👤 {item.nombreContacto}
                      </Text>
                      {item.telefonoContacto ? (
                        <Text style={styles.contactPhone} numberOfLines={1}>
                          📞 {item.telefonoContacto}
                        </Text>
                      ) : null}
                      {item.fecha ? (
                        <Text style={styles.createdAt}>
                          Creada el {formatearFecha(item.fecha)}
                        </Text>
                      ) : null}
                    </View>

                    {/* Aceptada sin iniciar: el cliente puede cancelar. */}
                    {cancelable && (
                      <TouchableOpacity
                        onPress={() => handleCancelar(item)}
                        style={[
                          styles.btnDelete,
                          cancelacionBloqueada && styles.btnBloqueado,
                        ]}
                        activeOpacity={0.7}
                        disabled={borrando || cancelacionBloqueada}
                        accessibilityState={{ disabled: cancelacionBloqueada }}
                      >
                        {borrando ? (
                          <ActivityIndicator size="small" color="#fca5a5" />
                        ) : (
                          <Text
                            style={[
                              styles.btnDeleteText,
                              cancelacionBloqueada && styles.btnBloqueadoText,
                            ]}
                          >
                            {cancelacionBloqueada ? "🔒 Cancelar" : "✕ Cancelar"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {porCalificar && (
                      <TouchableOpacity
                        onPress={() => setCalificandoId(item.id ?? null)}
                        style={styles.btnCalificar}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnCalificarText}>★ Calificar</Text>
                      </TouchableOpacity>
                    )}

                    {/* Solo se puede eliminar mientras nadie la ha tomado. */}
                    {estadoItem === "pendiente" && (
                      <TouchableOpacity
                        onPress={() => handleEliminar(item.id)}
                        style={styles.btnDelete}
                        activeOpacity={0.7}
                        disabled={borrando}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {borrando ? (
                          <ActivityIndicator size="small" color="#fca5a5" />
                        ) : (
                          <Text style={styles.btnDeleteText}>🗑 Eliminar</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FONDO },
  mainContainer: { flex: 1, backgroundColor: FONDO },
  container: { flex: 1, backgroundColor: FONDO },
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
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnBackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
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
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: "#eeecec",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  titleHighlight: { color: AZUL },
  counterText: { color: "#9ca3af", fontSize: 13, marginTop: 4 },

  loaderContainer: { marginTop: 50, alignItems: "center" },

  // Estado vacío
  emptyContainer: {
    marginTop: 30,
    alignItems: "center",
    backgroundColor: "rgba(17,19,24,0.94)",
    padding: 28,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
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
    backgroundColor: "rgba(17,19,24,0.94)",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
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
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  timelineCol: { alignItems: "center", marginRight: 12, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 4,
  },
  routeTexts: { flex: 1 },
  routeBlock: { marginBottom: 10 },
  routeLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // Detalle
  descBox: { marginBottom: 12 },
  descLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardDesc: { color: "#E7F0F4", fontSize: 13, lineHeight: 18 },

  // Métricas
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    marginBottom: 14,
  },
  metricBox: { flex: 1, alignItems: "center" },
  metricValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  metricLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  metricDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },

  // Pie
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
    gap: 10,
  },
  contactInfo: { flex: 1 },
  contactName: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  contactPhone: {
    color: AZUL,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  createdAt: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 },
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
  btnDeleteText: { color: "#fca5a5", fontSize: 12, fontWeight: "800" },

  // Estado y transportista
  estadoBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
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
  vehiculoTexto: { color: "#9BA7BA", fontSize: 12, marginTop: 2 },
  btnLlamar: {
    backgroundColor: AZUL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  btnLlamarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  calificacionTexto: { color: "#fbbf24", fontSize: 12, fontWeight: "700", marginTop: 2 },
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  btnBloqueadoText: { color: "rgba(255,255,255,0.35)" },
  textoBloqueo: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
});
