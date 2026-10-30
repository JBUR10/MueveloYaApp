// src/app/transportista.tsx
// Panel del modo transportista: solicitudes disponibles, aceptadas e historial.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BarraNavegacion from "../components/ui/BarraNavegacion";
import MensajeTemporal from "../components/ui/MensajeTemporal";
import { cambiarCuentaConAyudantes, useModo } from "../services/modoStore";
import {
  obtenerMisServicios,
  SolicitudServicioDTO,
} from "../services/servicioService";
import {
  aceptarSolicitud,
  cancelarSolicitud,
  esInmediato,
  HORAS_MINIMAS_CANCELACION,
  obtenerRegistrosTransportista,
  puedeCancelar,
  RegistrosTransportista,
} from "../services/transportistaService";

const AZUL = "#2969e9";
const FONDO = "#111318";

type Seccion = "disponibles" | "aceptadas" | "historial";

const SECCIONES: { id: Seccion; titulo: string }[] = [
  { id: "disponibles", titulo: "Disponibles" },
  { id: "aceptadas", titulo: "Aceptadas" },
  { id: "historial", titulo: "Historial" },
];

const VACIOS: Record<Seccion, { titulo: string; texto: string }> = {
  disponibles: {
    titulo: "No hay solicitudes disponibles",
    texto: "Cuando un usuario solicite un servicio aparecerá aquí.",
  },
  aceptadas: {
    titulo: "Aún no has aceptado solicitudes",
    texto: "Las solicitudes que aceptes aparecerán aquí.",
  },
  historial: {
    titulo: "Tu historial está vacío",
    texto: "Aquí verás las solicitudes que aceptaste o cancelaste.",
  },
};

// ---------- Helpers multiplataforma ----------
const confirmar = (
  titulo: string,
  mensaje: string,
  textoAceptar: string,
  destructivo = false,
): Promise<boolean> => {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: "Volver", style: "cancel", onPress: () => resolve(false) },
        {
          text: textoAceptar,
          style: destructivo ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
};

const aviso = (titulo: string, mensaje: string) => {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
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

export default function TransportistaScreen() {
  const router = useRouter();
  const { cuentaConAyudantes } = useModo();

  const [servicios, setServicios] = useState<SolicitudServicioDTO[]>([]);
  const [registros, setRegistros] = useState<RegistrosTransportista>({});
  const [seccion, setSeccion] = useState<Seccion>("disponibles");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const ocultarMensaje = useCallback(() => setMensaje(null), []);

  // Se refresca cada minuto para bloquear "Cancelar" justo al llegar a 48 h.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem("token")) || "TOKEN_DEMO";
      const [data, regs] = await Promise.all([
        obtenerMisServicios(token),
        obtenerRegistrosTransportista(),
      ]);
      setServicios(data);
      setRegistros(regs);
      setAhora(new Date());
    } catch (error) {
      console.error("Error cargando solicitudes del transportista:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarDatos();
  }, [cargarDatos]);

  const listas = useMemo(() => {
    const estadoDe = (item: SolicitudServicioDTO) =>
      registros[String(item.id)]?.estado;

    return {
      // Las canceladas vuelven a quedar disponibles para otros transportistas.
      disponibles: servicios.filter((s) => estadoDe(s) !== "aceptada"),
      aceptadas: servicios.filter((s) => estadoDe(s) === "aceptada"),
      historial: servicios.filter((s) => estadoDe(s) !== undefined),
    };
  }, [servicios, registros]);

  const lista = listas[seccion];

  const handleAyudantes = async () => {
    const nuevoValor = !cuentaConAyudantes;
    const ok = await confirmar(
      "Ayudantes",
      nuevoValor
        ? "¿Confirmas que ahora cuentas con ayudantes para tus servicios?"
        : "¿Confirmas que ya no cuentas con ayudantes para tus servicios?",
      "Confirmar",
    );
    if (!ok) return;

    await cambiarCuentaConAyudantes(nuevoValor);
    setMensaje(
      nuevoValor ? "Ahora cuentas con ayudantes" : "Ahora trabajas sin ayudantes",
    );
  };

  const handleAceptar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;

    const sinCancelacion = !puedeCancelar(item);
    const ok = await confirmar(
      "Aceptar solicitud",
      sinCancelacion
        ? `Faltan menos de ${HORAS_MINIMAS_CANCELACION} horas para este servicio. Si lo aceptas no podrás cancelarlo.`
        : `Podrás cancelarla hasta ${HORAS_MINIMAS_CANCELACION} horas antes del servicio.`,
      "Aceptar",
    );
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      setRegistros(await aceptarSolicitud(item.id));
      setMensaje("Solicitud aceptada");
    } catch (error: any) {
      aviso("Error", error?.message || "No se pudo aceptar la solicitud.");
    } finally {
      setProcesandoId(null);
    }
  };

  const handleCancelar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;

    if (!puedeCancelar(item)) {
      aviso(
        "No se puede cancelar",
        `Las solicitudes aceptadas solo se pueden cancelar con al menos ${HORAS_MINIMAS_CANCELACION} horas de anticipación.`,
      );
      return;
    }

    const ok = await confirmar(
      "Cancelar solicitud",
      "¿Seguro que deseas cancelar este servicio? Volverá a estar disponible para otros transportistas.",
      "Cancelar servicio",
      true,
    );
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      setRegistros(await cancelarSolicitud(item));
      setMensaje("Solicitud cancelada");
    } catch (error: any) {
      aviso("Error", error?.message || "No se pudo cancelar la solicitud.");
    } finally {
      setProcesandoId(null);
    }
  };

  const renderAccion = (item: SolicitudServicioDTO) => {
    const registro = registros[String(item.id)];
    const procesando = procesandoId === item.id;

    if (seccion === "historial") {
      const cancelada = registro?.estado === "cancelada";
      return (
        <View
          style={[
            styles.statusChip,
            cancelada ? styles.chipCancelada : styles.chipAceptada,
          ]}
        >
          <Text
            style={[
              styles.statusChipText,
              { color: cancelada ? "#fca5a5" : "#86E8BD" },
            ]}
          >
            {cancelada ? "✕ Cancelada" : "✓ Aceptada"}
          </Text>
        </View>
      );
    }

    if (seccion === "disponibles") {
      return (
        <TouchableOpacity
          onPress={() => handleAceptar(item)}
          style={styles.btnAceptar}
          activeOpacity={0.7}
          disabled={procesando}
        >
          {procesando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.btnAceptarText}>✓ Aceptar</Text>
          )}
        </TouchableOpacity>
      );
    }

    const bloqueado = !puedeCancelar(item, ahora);
    return (
      <TouchableOpacity
        onPress={() => handleCancelar(item)}
        style={[styles.btnCancelar, bloqueado && styles.btnBloqueado]}
        activeOpacity={0.7}
        disabled={procesando || bloqueado}
        accessibilityState={{ disabled: procesando || bloqueado }}
      >
        {procesando ? (
          <ActivityIndicator size="small" color="#fca5a5" />
        ) : (
          <Text
            style={[
              styles.btnCancelarText,
              bloqueado && styles.btnBloqueadoText,
            ]}
          >
            {bloqueado ? "🔒 Cancelar" : "✕ Cancelar"}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const textoFechaRegistro = (item: SolicitudServicioDTO) => {
    const registro = registros[String(item.id)];
    if (seccion === "historial" && registro) {
      return registro.estado === "cancelada"
        ? `Cancelada el ${formatearFecha(registro.canceladaEl)}`
        : `Aceptada el ${formatearFecha(registro.aceptadaEl)}`;
    }
    return item.fecha ? `Creada el ${formatearFecha(item.fecha)}` : "";
  };

  const vacio = VACIOS[seccion];

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
            <View style={styles.chipModo}>
              <View style={styles.puntoModo} />
              <Text style={styles.chipModoText}>Modo transportista</Text>
            </View>
          </View>

          {/* Encabezado */}
          <View style={styles.headerContainer}>
            <Text style={styles.subtitleHeader}>PANEL TRANSPORTISTA</Text>
            <Text style={styles.titleHeader}>
              Solicitudes de <Text style={styles.titleHighlight}>servicio</Text>
            </Text>
          </View>

          {/* Ayudantes */}
          <View style={styles.tarjetaAyudantes}>
            <View style={styles.ayudantesTexto}>
              <Text style={styles.ayudantesTitulo}>Cuento con ayudantes</Text>
              <Text style={styles.ayudantesDescripcion}>
                {cuentaConAyudantes
                  ? "Ofreces ayudantes en tus servicios"
                  : "Por ahora trabajas sin ayudantes"}
              </Text>
            </View>

            <Pressable
              onPress={handleAyudantes}
              accessibilityRole="switch"
              accessibilityState={{ checked: cuentaConAyudantes }}
              accessibilityLabel="Cuento con ayudantes"
              style={[
                styles.interruptor,
                cuentaConAyudantes && styles.interruptorActivo,
              ]}
            >
              <View
                style={[
                  styles.interruptorPunto,
                  cuentaConAyudantes && styles.interruptorPuntoActivo,
                ]}
              />
            </Pressable>
          </View>

          {/* Secciones */}
          <View style={styles.segmentos}>
            {SECCIONES.map((s) => {
              const activa = seccion === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSeccion(s.id)}
                  style={[styles.segmento, activa && styles.segmentoActivo]}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                >
                  <Text
                    style={[
                      styles.segmentoText,
                      activa && styles.segmentoTextActivo,
                    ]}
                  >
                    {s.titulo} ({listas[s.id].length})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {seccion === "aceptadas" && lista.length > 0 && (
            <Text style={styles.notaCancelacion}>
              Solo puedes cancelar con al menos {HORAS_MINIMAS_CANCELACION}{" "}
              horas de anticipación al servicio.
            </Text>
          )}

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={AZUL} />
            </View>
          ) : lista.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚚</Text>
              <Text style={styles.emptyTitle}>{vacio.titulo}</Text>
              <Text style={styles.emptyText}>{vacio.texto}</Text>
            </View>
          ) : (
            lista.map((item, index) => {
              const inmediato = esInmediato(item);
              const procesando = procesandoId === item.id;
              const bloqueado =
                seccion === "aceptadas" && !puedeCancelar(item, ahora);

              return (
                <View
                  key={item.id || String(index)}
                  style={[styles.cardService, procesando && { opacity: 0.5 }]}
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

                  {/* Pie: contacto + acción */}
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
                      {textoFechaRegistro(item) ? (
                        <Text style={styles.createdAt}>
                          {textoFechaRegistro(item)}
                        </Text>
                      ) : null}
                    </View>

                    {renderAccion(item)}
                  </View>

                  {bloqueado && (
                    <Text style={styles.textoBloqueo}>
                      Faltan menos de {HORAS_MINIMAS_CANCELACION} horas para
                      el servicio: ya no se puede cancelar.
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <BarraNavegacion />

        <MensajeTemporal mensaje={mensaje} alTerminar={ocultarMensaje} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FONDO },
  mainContainer: { flex: 1, backgroundColor: FONDO },
  container: { flex: 1, backgroundColor: FONDO },
  contentContainer: {
    paddingHorizontal: 20,
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
  chipModo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(80,220,164,0.10)",
    borderWidth: 1,
    borderColor: "rgba(80,220,164,0.25)",
  },
  puntoModo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50DCA4",
  },
  chipModoText: { color: "#86E8BD", fontSize: 12, fontWeight: "800" },

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

  // Ayudantes (mismo estilo que la tarjeta de preferencias del perfil)
  tarjetaAyudantes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.045)",
    marginBottom: 16,
  },
  ayudantesTexto: { flex: 1, gap: 6 },
  ayudantesTitulo: { color: "#F0F3F8", fontSize: 12, fontWeight: "700" },
  ayudantesDescripcion: { color: "#9BA7BA", fontSize: 10, lineHeight: 15 },
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

  // Secciones
  segmentos: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 16,
  },
  segmento: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 12,
  },
  segmentoActivo: { backgroundColor: AZUL },
  segmentoText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
  },
  segmentoTextActivo: { color: "#FFFFFF", fontWeight: "800" },
  notaCancelacion: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
  },

  loaderContainer: { marginTop: 50, alignItems: "center" },

  // Estado vacío
  emptyContainer: {
    marginTop: 10,
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
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  // Tarjeta
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
  chipAceptada: {
    backgroundColor: "rgba(80,220,164,0.10)",
    borderColor: "rgba(80,220,164,0.35)",
  },
  chipCancelada: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.4)",
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

  // Acciones
  btnAceptar: {
    backgroundColor: AZUL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAceptarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  btnCancelar: {
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
  btnCancelarText: { color: "#fca5a5", fontSize: 12, fontWeight: "800" },
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
