// src/components/admin/PanelEstadisticas.tsx
//
// Sección "Estadísticas" del panel de administrador: cuántos pedidos hay de
// cada tipo y en qué zonas se piden más (mapa con zonas amarillas y rojas).
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

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

const PERIODOS: { valor: PeriodoEstadisticas; titulo: string }[] = [
  { valor: 7, titulo: "7 días" },
  { valor: 30, titulo: "30 días" },
  { valor: null, titulo: "Todo" },
];

// Los cuatro tipos de la app aparecen siempre, aunque todavía no tengan pedidos.
const TIPOS = ["Envío", "Acarreo", "Trasteo", "Mudanza"];
const ICONO_TIPO: Record<string, string> = {
  Envío: "📦",
  Acarreo: "🚚",
  Trasteo: "🛻",
  Mudanza: "🏠",
};

const ESTADOS: Record<string, { texto: string; color: string }> = {
  pendiente: { texto: "Pendientes", color: "#fbbf24" },
  aceptada: { texto: "Aceptados", color: "#60a5fa" },
  en_curso: { texto: "En curso", color: "#a78bfa" },
  completada: { texto: "Completados", color: "#34d399" },
  cancelada: { texto: "Cancelados", color: "#f87171" },
};

export default function PanelEstadisticas() {
  const [periodo, setPeriodo] = useState<PeriodoEstadisticas>(30);
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async (p: PeriodoEstadisticas) => {
    setCargando(true);
    setError("");
    try {
      setDatos(await obtenerEstadisticas(p));
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las estadísticas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(periodo);
  }, [periodo, cargar]);

  // Los tipos fijos primero y, si aparece otro valor en la base, al final.
  const tipos = (() => {
    const mapa = new Map((datos?.porTipo ?? []).map((t) => [t.tipo, t.total]));
    const filas = TIPOS.map((t) => ({ tipo: t, total: mapa.get(t) ?? 0 }));
    mapa.forEach((total, tipo) => {
      if (!TIPOS.includes(tipo)) filas.push({ tipo, total });
    });
    return filas;
  })();
  const totalTipos = tipos.reduce((s, t) => s + t.total, 0);
  const maxTipo = tipos.reduce((m, t) => Math.max(m, t.total), 0);

  const zonas = datos?.zonas ?? [];
  const umbral = umbralZonaAlta(zonas);
  const sinUbicacion = datos ? datos.total - datos.conUbicacion : 0;

  return (
    <View style={styles.raiz}>
      <Text style={styles.titulo}>
        Estadísticas de <Text style={styles.azul}>pedidos</Text>
      </Text>
      <Text style={styles.descripcion}>
        Cuántos pedidos se hacen de cada tipo y desde qué zonas se piden más.
      </Text>

      <View style={styles.chips}>
        {PERIODOS.map((p) => {
          const activo = periodo === p.valor;
          return (
            <Pressable
              key={p.titulo}
              onPress={() => setPeriodo(p.valor)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              style={[styles.chip, activo && styles.chipActivo]}>
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                {p.titulo}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => cargar(periodo)}
          disabled={cargando}
          style={[styles.chip, styles.chipActualizar]}>
          <Text style={styles.chipTexto}>↻ Actualizar</Text>
        </Pressable>
      </View>

      {cargando && !datos ? (
        <ActivityIndicator color={AZUL} size="large" style={{ marginTop: 30 }} />
      ) : !!error && !datos ? (
        <Text style={styles.error}>{error}</Text>
      ) : datos ? (
        <View style={[styles.raiz, cargando && { opacity: 0.5 }]}>
          {!!error && <Text style={styles.error}>{error}</Text>}

          {/* Total y estados */}
          <View style={styles.tarjeta}>
            <Text style={styles.total}>{datos.total}</Text>
            <Text style={styles.totalTexto}>
              {datos.total === 1 ? "pedido en total" : "pedidos en total"}
            </Text>
            <View style={styles.estados}>
              {datos.porEstado.map((e) => {
                const info = ESTADOS[e.estado] ?? {
                  texto: e.estado,
                  color: "#9BA7BA",
                };
                return (
                  <View key={e.estado} style={styles.estado}>
                    <View style={[styles.punto, { backgroundColor: info.color }]} />
                    <Text style={styles.estadoTexto}>
                      {info.texto}: <Text style={styles.estadoNumero}>{e.total}</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Por tipo de pedido */}
          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Pedidos por tipo</Text>
            {tipos.map((t) => {
              const pct = totalTipos ? Math.round((t.total / totalTipos) * 100) : 0;
              return (
                <View key={t.tipo} style={styles.filaTipo}>
                  <View style={styles.filaTipoArriba}>
                    <Text style={styles.tipoNombre}>
                      {ICONO_TIPO[t.tipo] ?? "•"} {t.tipo}
                    </Text>
                    <Text style={styles.tipoNumero}>
                      {t.total} <Text style={styles.tipoPct}>· {pct}%</Text>
                    </Text>
                  </View>
                  <View style={styles.barraFondo}>
                    <View
                      style={[
                        styles.barra,
                        { width: `${maxTipo ? (t.total / maxTipo) * 100 : 0}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Mapa de zonas */}
          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>🗺️ Zonas con más pedidos</Text>
            <Text style={styles.descripcion}>
              Según el punto de recogida. Toca una zona para ver cuántos
              pedidos salen de ahí.
            </Text>

            <MapaZonas zonas={zonas} />

            <View style={styles.leyenda}>
              <View style={styles.estado}>
                <View style={[styles.punto, { backgroundColor: COLOR_ZONA_MEDIA }]} />
                <Text style={styles.estadoTexto}>Demanda media</Text>
              </View>
              <View style={styles.estado}>
                <View style={[styles.punto, { backgroundColor: COLOR_ZONA_ALTA }]} />
                <Text style={styles.estadoTexto}>
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
                {sinUbicacion} {sinUbicacion === 1 ? "pedido no tiene" : "pedidos no tienen"}{" "}
                el punto marcado en el mapa y no se dibuja{sinUbicacion === 1 ? "" : "n"} aquí.
              </Text>
            )}
          </View>

          {/* Barrios */}
          {datos.barrios.length > 0 && (
            <View style={styles.tarjeta}>
              <Text style={styles.seccion}>Barrios con más pedidos</Text>
              {datos.barrios.map((b, i) => (
                <View key={b.nombre} style={styles.filaBarrio}>
                  <Text style={styles.barrioNombre}>
                    {i + 1}. {b.nombre}
                  </Text>
                  <Text style={styles.tipoNumero}>{b.total}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: 16 },
  titulo: { color: "#eeecec", fontSize: 28, fontWeight: "900" },
  azul: { color: AZUL },
  descripcion: { color: "#9BA7BA", fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActivo: { backgroundColor: AZUL, borderColor: AZUL },
  chipActualizar: { marginLeft: "auto" },
  chipTexto: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "700" },
  chipTextoActivo: { color: "#FFFFFF" },
  error: { color: "#f87171", fontSize: 13, textAlign: "center", marginTop: 10 },
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  total: { color: "#FFFFFF", fontSize: 40, fontWeight: "900", lineHeight: 44 },
  totalTexto: { color: "#9BA7BA", fontSize: 13, marginTop: -6 },
  estados: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 },
  estado: { flexDirection: "row", alignItems: "center", gap: 6 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  estadoTexto: { color: "#D5DCE8", fontSize: 12 },
  estadoNumero: { color: "#FFFFFF", fontWeight: "800" },
  seccion: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  filaTipo: { gap: 6 },
  filaTipoArriba: { flexDirection: "row", justifyContent: "space-between" },
  tipoNombre: { color: "#D5DCE8", fontSize: 14, fontWeight: "700" },
  tipoNumero: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  tipoPct: { color: "#9BA7BA", fontWeight: "600" },
  barraFondo: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barra: { height: 8, borderRadius: 4, backgroundColor: AZUL },
  leyenda: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 },
  nota: { color: "#9BA7BA", fontSize: 12, lineHeight: 17 },
  filaBarrio: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 2,
  },
  barrioNombre: { color: "#D5DCE8", fontSize: 14, flexShrink: 1 },
});
