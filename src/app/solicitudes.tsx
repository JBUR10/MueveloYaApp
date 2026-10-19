// src/app/solicitudes.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import {
  eliminarServicio,
  obtenerMisServicios,
  SolicitudServicioDTO,
} from "../services/servicioService";

const AZUL = "#2969e9";
const FONDO = "#111318";

// ---------- Helpers multiplataforma ----------
const confirmar = (titulo: string, mensaje: string): Promise<boolean> => {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Eliminar",
          style: "destructive",
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

export default function SolicitudesScreen() {
  const router = useRouter();
  const [servicios, setServicios] = useState<SolicitudServicioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const cargarServicios = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem("token")) || "TOKEN_DEMO";
      const data = await obtenerMisServicios(token);
      setServicios(data);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarServicios();
    }, [cargarServicios]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarServicios();
  }, [cargarServicios]);

  const handleEliminar = async (id?: string) => {
    if (!id) {
      aviso("Atención", "Este servicio no cuenta con un identificador válido.");
      return;
    }

    const ok = await confirmar(
      "Eliminar solicitud",
      "¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.",
    );
    if (!ok) return;

    try {
      setEliminandoId(id);
      const token = (await AsyncStorage.getItem("token")) || "TOKEN_DEMO";
      await eliminarServicio(id, token);
      setServicios((prev) => prev.filter((s) => String(s.id) !== String(id)));
    } catch (error: any) {
      aviso("Error", error?.message || "No se pudo eliminar");
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
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <BarraNavegacion />
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
});
