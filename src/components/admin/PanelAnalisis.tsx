// src/components/admin/PanelAnalisis.tsx
//
// Sección "Análisis" del panel de administrador: indicadores (KPIs),
// comparación con el periodo anterior, tendencia por día, horas pico,
// días fuertes y conclusiones automáticas. Sin librerías de gráficos:
// las barras son <View> con altura proporcional.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/Texto";

import { Analisis, obtenerAnalisis } from "../../services/analisisService";
import type { PeriodoEstadisticas } from "../../services/estadisticasService";
import { formatearPesos } from "../../services/tarifa";
import MapaCalor from "./MapaCalor";
import PanelNegocio from "./PanelNegocio";
import TextoIcono from "../ui/TextoIcono";
import { type NombreIcono } from "../ui/Icono";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const AZUL = "#2969e9";
const NOMBRE_DIA = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const PERIODOS: { valor: PeriodoEstadisticas; titulo: string }[] = [
  { valor: 7, titulo: "7 días" },
  { valor: 30, titulo: "30 días" },
  { valor: null, titulo: "Todo" },
];

const pct = (parte: number, todo: number) =>
  todo ? Math.round((parte / todo) * 100) : 0;

/** "+12 %" / "-5 %" frente al periodo anterior; null si no hay con qué comparar. */
const variacion = (actual: number, anterior: number | null) => {
  if (anterior == null || anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
};

function Kpi({
  titulo,
  valor,
  delta,
  iconoValor,
}: {
  titulo: string;
  valor: string;
  delta?: number | null;
  /** Icono que acompaña al valor (por ejemplo una estrella). */
  iconoValor?: NombreIcono;
}) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiTitulo}>{titulo}</Text>
      {iconoValor ? (
        <TextoIcono
          icono={iconoValor}
          alFinal
          colorIcono={p.estrella}
          style={styles.kpiValor}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {valor}
        </TextoIcono>
      ) : (
        <Text style={styles.kpiValor} numberOfLines={1} adjustsFontSizeToFit>
          {valor}
        </Text>
      )}
      {delta != null && (
        <TextoIcono
          icono={delta >= 0 ? "caret-up" : "caret-down"}
          style={[styles.delta, { color: delta >= 0 ? p.textoExito : p.textoError2 }]}
        >
          {Math.abs(delta)} % vs. periodo anterior
        </TextoIcono>
      )}
    </View>
  );
}

/** Barras verticales simples. `resaltar` pinta de otro color la barra más alta. */
function Barras({ datos }: { datos: { etiqueta: string; valor: number }[] }) {
  const styles = useEstilos(crearEstilos);
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const mayor = datos.reduce((m, d) => (d.valor > m ? d.valor : m), 0);
  return (
    <View style={styles.barras}>
      {datos.map((d) => (
        <View key={d.etiqueta} style={styles.barraCol}>
          <Text style={styles.barraValor}>{d.valor || ""}</Text>
          <View
            style={[
              styles.barraV,
              {
                height: Math.max(3, (d.valor / max) * 90),
                backgroundColor:
                  d.valor === mayor && mayor > 0 ? "#fbbf24" : AZUL,
              },
            ]}
          />
          <Text style={styles.barraEtiqueta}>{d.etiqueta}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PanelAnalisis() {
  const styles = useEstilos(crearEstilos);
  const [periodo, setPeriodo] = useState<PeriodoEstadisticas>(30);
  const [datos, setDatos] = useState<Analisis | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async (p: PeriodoEstadisticas) => {
    setCargando(true);
    setError("");
    try {
      setDatos(await obtenerAnalisis(p));
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el análisis de datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(periodo);
  }, [periodo, cargar]);

  // Conclusiones en lenguaje natural a partir de los números.
  const conclusiones = useMemo(() => {
    if (!datos || datos.total === 0) return [];
    const out: string[] = [];

    const horaPico = [...datos.porHora].sort((a, b) => b.total - a.total)[0];
    if (horaPico) {
      out.push(
        `La hora con más pedidos es las ${horaPico.hora}:00 (${horaPico.total} pedidos).`,
      );
    }
    const diaPico = [...datos.porDiaSemana].sort(
      (a, b) => b.total - a.total,
    )[0];
    if (diaPico) {
      out.push(
        `El día más fuerte de la semana es el ${NOMBRE_DIA[diaPico.dia]}.`,
      );
    }
    const tasaCancel = pct(datos.cancelados, datos.total);
    if (tasaCancel >= 20) {
      out.push(
        `Atención: ${tasaCancel} % de los pedidos se cancela. Revisa los motivos más abajo.`,
      );
    }
    if (datos.minutosAceptacion != null && datos.minutosAceptacion > 15) {
      out.push(
        `Un conductor tarda ${datos.minutosAceptacion} min en aceptar: puede faltar oferta de conductores.`,
      );
    }
    const dv = variacion(datos.total, datos.totalAnterior);
    if (dv != null) {
      out.push(
        dv >= 0
          ? `Los pedidos subieron ${dv} % frente al periodo anterior.`
          : `Los pedidos bajaron ${Math.abs(dv)} % frente al periodo anterior.`,
      );
    }
    return out;
  }, [datos]);

  const horas = useMemo(() => {
    const mapa = new Map((datos?.porHora ?? []).map((h) => [h.hora, h.total]));
    return Array.from({ length: 24 }, (_, h) => ({
      etiqueta: String(h),
      valor: mapa.get(h) ?? 0,
    }));
  }, [datos]);

  const semana = useMemo(() => {
    const mapa = new Map(
      (datos?.porDiaSemana ?? []).map((d) => [d.dia, d.total]),
    );
    return [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      etiqueta: NOMBRE_DIA[d],
      valor: mapa.get(d) ?? 0,
    }));
  }, [datos]);

  // Para periodos largos solo se dibujan los últimos 14 días con datos.
  const dias = useMemo(
    () =>
      (datos?.porDia ?? []).slice(-14).map((d) => ({
        etiqueta: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7),
        valor: d.total,
      })),
    [datos],
  );

  return (
    <View style={styles.raiz}>
      <Text style={styles.titulo}>
        Análisis de <Text style={{ color: AZUL }}>datos</Text>
      </Text>
      <Text style={styles.descripcion}>
        Indicadores del negocio, tendencias y horas de mayor demanda.
      </Text>

      <View style={styles.chips}>
        {PERIODOS.map((p) => {
          const activo = periodo === p.valor;
          return (
            <Pressable
              key={p.titulo}
              onPress={() => setPeriodo(p.valor)}
              style={[styles.chip, activo && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, activo && { color: "#FFF" }]}>
                {p.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {cargando && !datos ? (
        <ActivityIndicator
          color={AZUL}
          size="large"
          style={{ marginTop: 30 }}
        />
      ) : !!error && !datos ? (
        <Text style={styles.error}>{error}</Text>
      ) : datos ? (
        <View style={[styles.raiz, cargando && { opacity: 0.5 }]}>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.kpis}>
            <Kpi
              titulo="Pedidos"
              valor={String(datos.total)}
              delta={variacion(datos.total, datos.totalAnterior)}
            />
            <Kpi
              titulo="Ingresos (completados)"
              valor={formatearPesos(datos.ingresos)}
              delta={variacion(datos.ingresos, datos.ingresosAnterior)}
            />
            <Kpi
              titulo="Tarifa promedio"
              valor={formatearPesos(datos.tarifaPromedio)}
            />
            <Kpi
              titulo="Distancia promedio"
              valor={`${datos.distanciaPromedio} km`}
            />
            <Kpi
              titulo="Completados"
              valor={`${pct(datos.completados, datos.total)} %`}
            />
            <Kpi
              titulo="Cancelados"
              valor={`${pct(datos.cancelados, datos.total)} %`}
            />
            <Kpi
              titulo="Aceptación promedio"
              valor={
                datos.minutosAceptacion != null
                  ? `${datos.minutosAceptacion} min`
                  : "—"
              }
            />
            <Kpi
              titulo="Calificación"
              iconoValor={datos.calificacionPromedio != null ? "star" : undefined}
              valor={
                datos.calificacionPromedio != null
                  ? `${datos.calificacionPromedio}`
                  : "—"
              }
            />
          </View>

          {conclusiones.length > 0 && (
            <View style={styles.tarjeta}>
              <Text style={styles.seccion}>Conclusiones</Text>
              {conclusiones.map((c) => (
                <Text key={c} style={styles.conclusion}>
                  • {c}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Pedidos por día (últimos 14)</Text>
            {dias.length ? (
              <Barras datos={dias} />
            ) : (
              <Text style={styles.nota}>Sin datos.</Text>
            )}
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Pedidos por hora del día</Text>
            <Barras datos={horas} />
            <Text style={styles.nota}>
              La barra amarilla marca la hora pico.
            </Text>
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Pedidos por día de la semana</Text>
            <Barras datos={semana} />
          </View>

          <MapaCalor periodo={periodo} />

          {datos.motivosCancelacion.length > 0 && (
            <View style={styles.tarjeta}>
              <Text style={styles.seccion}>Motivos de cancelación</Text>
              {datos.motivosCancelacion.map((m) => (
                <View key={m.motivo} style={styles.fila}>
                  <Text style={styles.motivo}>{m.motivo}</Text>
                  <Text style={styles.valor}>{m.total}</Text>
                </View>
              ))}
            </View>
          )}

          <PanelNegocio periodo={periodo} />
        </View>
      ) : null}
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  raiz: { gap: 16 },
  titulo: { color: p.textoTitulo, fontSize: 28, fontWeight: "900" },
  descripcion: { color: p.textoTenue, fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.velo(0.04),
  },
  chipActivo: { backgroundColor: AZUL, borderColor: AZUL },
  chipTexto: {
    color: p.textoAlfa(0.75),
    fontSize: 13,
    fontWeight: "700",
  },
  error: { color: p.textoError2, fontSize: 13, textAlign: "center", marginTop: 10 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: 14,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  kpiTitulo: { color: p.textoTenue, fontSize: 12 },
  kpiValor: { color: p.texto, fontSize: 22, fontWeight: "900" },
  delta: { fontSize: 11, fontWeight: "700" },
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  seccion: { color: p.texto, fontSize: 16, fontWeight: "800" },
  conclusion: { color: p.textoDato, fontSize: 13, lineHeight: 19 },
  nota: { color: p.textoTenue, fontSize: 12 },
  barras: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 130 },
  barraCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  barraV: { width: "100%", borderRadius: 3 },
  barraValor: { color: p.textoDato, fontSize: 9 },
  barraEtiqueta: { color: p.textoTenue, fontSize: 9 },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  motivo: { color: p.textoDato, fontSize: 14, flexShrink: 1 },
  valor: { color: p.texto, fontSize: 14, fontWeight: "800" },
});
