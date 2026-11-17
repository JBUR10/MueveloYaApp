// src/components/admin/MapaCalor.tsx
//
// Mapa de calor de pedidos para la sección "Análisis": las zonas desde donde
// más se piden servicios (amarillo = demanda media, rojo = demanda alta) y los
// barrios con más pedidos. Usa el mismo periodo (7 días, 30 días, todo) que el
// resto del análisis.
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../ui/Texto";

import {
  Estadisticas,
  obtenerEstadisticas,
  PeriodoEstadisticas,
} from "../../services/estadisticasService";
import MapaZonas, {
  COLOR_ZONA_ALTA,
  COLOR_ZONA_MEDIA,
  umbralZonaAlta,
} from "../ui/MapaZonas";

const AZUL = "#2969e9";

export default function MapaCalor({
  periodo,
}: {
  periodo: PeriodoEstadisticas;
}) {
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    obtenerEstadisticas(periodo)
      .then((d) => vigente && setDatos(d))
      .catch(
        (e) => vigente && setError(e?.message || "No se pudo cargar el mapa."),
      )
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [periodo]);

  const zonas = datos?.zonas ?? [];
  const umbral = umbralZonaAlta(zonas);
  const sinUbicacion = datos ? datos.total - datos.conUbicacion : 0;

  return (
    <>
      <View
        style={[styles.tarjeta, cargando && datos ? { opacity: 0.5 } : null]}
      >
        <Text style={styles.seccion}>Mapa de calor de pedidos</Text>
        <Text style={styles.nota}>
          Zonas desde donde más se piden servicios, según el punto de recogida.
          Toca una zona para ver cuántos pedidos salen de ahí.
        </Text>

        {cargando && !datos ? (
          <ActivityIndicator color={AZUL} style={{ marginVertical: 20 }} />
        ) : error && !datos ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <MapaZonas zonas={zonas} />

            <View style={styles.leyenda}>
              <View style={styles.item}>
                <View
                  style={[styles.punto, { backgroundColor: COLOR_ZONA_MEDIA }]}
                />
                <Text style={styles.itemTexto}>Demanda media</Text>
              </View>
              <View style={styles.item}>
                <View
                  style={[styles.punto, { backgroundColor: COLOR_ZONA_ALTA }]}
                />
                <Text style={styles.itemTexto}>
                  Demanda alta ({umbral}+ pedidos)
                </Text>
              </View>
            </View>

            {zonas.length === 0 && (
              <Text style={styles.nota}>
                Todavía no hay pedidos con ubicación en este periodo.
              </Text>
            )}
            {sinUbicacion > 0 && (
              <Text style={styles.nota}>
                {sinUbicacion}{" "}
                {sinUbicacion === 1 ? "pedido no tiene" : "pedidos no tienen"}{" "}
                el punto marcado en el mapa y no se dibuja
                {sinUbicacion === 1 ? "" : "n"} aquí.
              </Text>
            )}
          </>
        )}
      </View>

      {!!datos && datos.barrios.length > 0 && (
        <View style={styles.tarjeta}>
          <Text style={styles.seccion}>Barrios con más pedidos</Text>
          {datos.barrios.map((b, i) => (
            <View key={b.nombre} style={styles.filaBarrio}>
              <Text style={styles.barrio}>
                {i + 1}. {b.nombre}
              </Text>
              <Text style={styles.valor}>{b.total}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  seccion: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  nota: { color: "#9BA7BA", fontSize: 12, lineHeight: 17 },
  error: { color: "#f87171", fontSize: 13, textAlign: "center" },
  leyenda: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  itemTexto: { color: "#D5DCE8", fontSize: 12 },
  filaBarrio: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 2,
  },
  barrio: { color: "#D5DCE8", fontSize: 14, flexShrink: 1 },
  valor: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
