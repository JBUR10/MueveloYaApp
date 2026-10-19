// src/app/solicitudes.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  obtenerMisServicios,
  SolicitudServicioDTO,
} from "../services/servicioService";

export default function SolicitudesScreen() {
  const router = useRouter();
  const [servicios, setServicios] = useState<SolicitudServicioDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarServicios = async () => {
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
  };

  useEffect(() => {
    cargarServicios();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarServicios();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#60a5fa"
        />
      }>
      {/* Barra superior */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={styles.btnBack}>
          <Text style={styles.btnBackText}>← Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/servicios")}
          style={styles.btnNew}>
          <Text style={styles.btnNewText}>+ Nuevo Servicio</Text>
        </TouchableOpacity>
      </View>

      {/* Encabezado */}
      <View style={styles.headerContainer}>
        <Text style={styles.subtitleHeader}>HISTORIAL</Text>
        <Text style={styles.titleHeader}>
          Mis <Text style={styles.titleHighlight}>Solicitudes</Text>
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : servicios.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No tienes solicitudes registradas aún.
          </Text>
          <TouchableOpacity
            style={styles.btnCreateEmpty}
            onPress={() => router.push("/servicios")}>
            <Text style={styles.btnCreateEmptyText}>Solicitar un servicio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        servicios.map((item, index) => (
          <View key={item.id || index} style={styles.cardService}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTypeBadge}>{item.tipoServicio}</Text>
              <Text style={styles.cardDate}>
                {item.fechaProgramada === "Inmediato" || !item.fechaProgramada
                  ? "⚡ Inmediato"
                  : `📅 ${item.fechaProgramada}`}
              </Text>
            </View>

            <View style={styles.routeContainer}>
              <Text style={styles.labelPointBlue} numberOfLines={1}>
                ● Recogida: {item.origen}
              </Text>
              <Text style={styles.labelPointGreen} numberOfLines={1}>
                ● Entrega: {item.destino}
              </Text>
            </View>

            {item.descripcion ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                <Text style={{ fontWeight: "700", color: "#d1d5db" }}>
                  Detalle:{" "}
                </Text>
                {item.descripcion}
              </Text>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.footerInfo}>Ayudantes: {item.ayudantes}</Text>
              <Text style={styles.footerInfo}>
                Pisos: {item.pisosEscaleras}
              </Text>
              <Text style={styles.footerContact}>{item.nombreContacto}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0e14",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  btnBack: {
    backgroundColor: "#161b22",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  btnBackText: {
    color: "#9ca3af",
    fontWeight: "600",
    fontSize: 12,
  },
  btnNew: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnNewText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  headerContainer: {
    marginBottom: 20,
  },
  subtitleHeader: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  titleHighlight: {
    color: "#3b82f6",
  },
  loaderContainer: {
    marginTop: 50,
    alignItems: "center",
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: "center",
    backgroundColor: "#161b22",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  btnCreateEmpty: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  btnCreateEmptyText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  cardService: {
    backgroundColor: "#161b22",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTypeBadge: {
    color: "#ffffff",
    backgroundColor: "#1e293b",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: "700",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  cardDate: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  routeContainer: {
    backgroundColor: "#0b0e14",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  labelPointBlue: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  labelPointGreen: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "600",
  },
  cardDesc: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingTop: 10,
  },
  footerInfo: {
    color: "#d1d5db",
    fontSize: 11,
    fontWeight: "600",
  },
  footerContact: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "600",
  },
});
