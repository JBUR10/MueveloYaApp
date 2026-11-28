// src/components/admin/MapaCalor.tsx
//
// Mapa de calor de pedidos para la sección "Análisis": las zonas desde donde
// más se piden servicios (amarillo = demanda media, rojo = demanda alta) y los
// barrios con más pedidos. Usa el mismo periodo (7 días, 30 días, todo) que el
// resto del análisis.
import { useEffect, useMemo, useState } from "react";
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
import { useEstilos, type Paleta } from "../../services/temaStore";

const AZUL = "#2969e9";
const ZONAS_VACIAS: NonNullable<Estadisticas["zonas"]> = [];

export default function MapaCalor({
  periodo,
}: {
  periodo: PeriodoEstadisticas;
}) {
  const styles = useEstilos(crearEstilos);
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

  const zonas = datos?.zonas ?? ZONAS_VACIAS;
  const umbral = umbralZonaAlta(zonas);
  const sinUbicacion = datos ? datos.total - datos.conUbicacion : 0;
  const resumenZonas = useMemo(() => {
    if (zonas.length === 0) return "";
    const altas = zonas.filter((zona) => zona.total >= umbral).length;
    const principales = [...zonas]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((zona, indice) => {
        const nombre = zona.nombre?.trim() || `zona ${indice + 1}`;
        const pedidos = `${zona.total} pedido${zona.total === 1 ? "" : "s"}`;
        const demanda = zona.total >= umbral ? "demanda alta" : "demanda media";
        return `${nombre}: ${pedidos}, ${demanda}`;
      })
      .join("; ");
    return `El mapa contiene ${zonas.length} zonas: ${altas} de demanda alta y ${zonas.length - altas} de demanda media. Zonas con más pedidos: ${principales}.`;
  }, [zonas, umbral]);

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
          <ActivityIndicator
            color={AZUL}
            style={{ marginVertical: 20 }}
            accessibilityLabel="Cargando mapa de calor"
          />
        ) : error && !datos ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            aria-live="assertive"
          >
            {error}
          </Text>
        ) : (
          <>
            <MapaZonas zonas={zonas} />
            {resumenZonas ? (
              <Text
                style={styles.nota}
                role="note"
                accessibilityLiveRegion="polite"
                aria-live="polite"
              >
                Resumen del mapa: {resumenZonas}
              </Text>
            ) : null}

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

const crearEstilos = (p: Paleta) => StyleSheet.create({
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  seccion: { color: p.texto, fontSize: 16, fontWeight: "800" },
  nota: { color: p.textoTenue, fontSize: 12, lineHeight: 17 },
  error: { color: p.textoError2, fontSize: 13, textAlign: "center" },
  leyenda: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  itemTexto: { color: p.textoDato, fontSize: 12 },
  filaBarrio: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 2,
  },
  barrio: { color: p.textoDato, fontSize: 14, flexShrink: 1 },
  valor: { color: p.texto, fontSize: 14, fontWeight: "800" },
});
