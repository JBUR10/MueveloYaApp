// src/components/admin/PanelNegocio.tsx
//
// Parte "Clientes y servicios" del análisis: cuánto pesa cada servicio,
// cuánto deja, a cuántos clientes no se les ha ofrecido ni probado, cómo se
// comportan los clientes (recompra, inactivos) y oportunidades para atraer
// clientes y promover los servicios menos usados. Cada oportunidad que se
// puede atacar con un descuento trae su botón «Enviar promoción» (cupón +
// notificación push), y abajo se miden los resultados.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/Texto";

import { Negocio, obtenerNegocio } from "../../services/analisisService";
import type { PeriodoEstadisticas } from "../../services/estadisticasService";
import type { MotivoPromocion } from "../../services/promocionesService";
import { formatearPesos } from "../../services/tarifa";
import FormularioPromocion from "./FormularioPromocion";
import ResultadosPromociones from "./ResultadosPromociones";
import Icono, { type NombreIcono } from "../ui/Icono";
import TextoIcono from "../ui/TextoIcono";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const AZUL = "#2969e9";
const TIPOS = ["Envío", "Acarreo", "Trasteo", "Mudanza"];
const ICONO: Record<string, NombreIcono> = {
  Envío: "cube-outline",
  Acarreo: "car-outline",
  Trasteo: "bus-outline",
  Mudanza: "home-outline",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

interface Promo {
  motivo: MotivoPromocion;
  tipo: string | null;
}
interface Oportunidad {
  texto: string;
  /** Si se puede atacar con un cupón, el botón abre el formulario ya llenado. */
  promo?: Promo;
}

export default function PanelNegocio({ periodo }: { periodo: PeriodoEstadisticas }) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const [datos, setDatos] = useState<Negocio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Formulario de promoción abierto (la clave lo reinicia al abrir otra) y
  // contador para refrescar los resultados después de enviar.
  const [promo, setPromo] = useState<(Promo & { clave: number }) | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    obtenerNegocio(periodo)
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e?.message || "No se pudo cargar."))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [periodo, version]);

  // Los 4 tipos siempre aparecen, aunque nadie los haya pedido todavía.
  const tipos = useMemo(() => {
    if (!datos) return [];
    const mapa = new Map(datos.porTipo.map((t) => [t.tipo, t]));
    const filas = TIPOS.map(
      (t) =>
        mapa.get(t) ?? {
          tipo: t,
          total: 0,
          anterior: null,
          ingresos: 0,
          tarifaPromedio: 0,
          cancelados: 0,
          clientes: 0,
          clientesNunca: datos.clientesTotal,
        },
    );
    mapa.forEach((v, k) => {
      if (!TIPOS.includes(k)) filas.push(v);
    });
    return filas;
  }, [datos]);

  const oportunidades = useMemo<Oportunidad[]>(() => {
    if (!datos || datos.clientesTotal === 0) return [];
    const out: Oportunidad[] = [];
    const total = tipos.reduce((s, t) => s + t.total, 0);

    // 1) Servicio menos usado y cuántos clientes no lo han probado.
    const menos = [...tipos].sort((a, b) => a.total - b.total)[0];
    if (menos && total > 0) {
      out.push({
        texto: `${menos.tipo} es el servicio menos usado (${pct(menos.total, total)} % de los pedidos) y ${menos.clientesNunca} clientes nunca lo han pedido. Ofréceles un descuento de primera vez.`,
        promo: { motivo: "primera_vez", tipo: menos.tipo },
      });
    }

    // 2) Servicio que deja más por pedido pero pesa poco.
    const conTarifa = tipos.filter((t) => t.tarifaPromedio > 0);
    const caro = [...conTarifa].sort((a, b) => b.tarifaPromedio - a.tarifaPromedio)[0];
    if (caro && total > 0 && pct(caro.total, total) < 25 && caro.tipo !== menos?.tipo) {
      out.push({
        texto: `${caro.tipo} deja ${formatearPesos(caro.tarifaPromedio)} por pedido en promedio pero solo es ${pct(caro.total, total)} % de los pedidos: promoverlo rinde más que otro envío.`,
        promo: { motivo: "primera_vez", tipo: caro.tipo },
      });
    }

    // 3) Servicios que caen frente al periodo anterior.
    tipos.forEach((t) => {
      if (t.anterior && t.anterior >= 3 && t.total < t.anterior) {
        out.push({
          texto: `${t.tipo} bajó ${pct(t.anterior - t.total, t.anterior)} % frente al periodo anterior (de ${t.anterior} a ${t.total}).`,
          promo: { motivo: "todos", tipo: t.tipo },
        });
      }
    });

    // 4) Cancelación alta por tipo (se arregla en la operación, no con cupones).
    tipos.forEach((t) => {
      if (t.total >= 5 && pct(t.cancelados, t.total) >= 25) {
        out.push({
          texto: `${t.tipo} se cancela ${pct(t.cancelados, t.total)} % de las veces: revisa tarifas, tiempos de aceptación o disponibilidad de conductores.`,
        });
      }
    });

    // 5) Clientes: un solo pedido, inactivos, un solo tipo.
    if (pct(datos.clientesUnPedido, datos.clientesTotal) >= 40) {
      out.push({
        texto: `${pct(datos.clientesUnPedido, datos.clientesTotal)} % de los clientes pidió una sola vez. Un cupón para el segundo pedido puede subir la recompra.`,
        promo: { motivo: "segundo_pedido", tipo: null },
      });
    }
    if (datos.clientesInactivos > 0) {
      out.push({
        texto: `${datos.clientesInactivos} clientes no piden hace más de 30 días. Una notificación de «te extrañamos» con descuento puede recuperarlos.`,
        promo: { motivo: "reactivacion", tipo: null },
      });
    }
    if (datos.clientesUnTipo > 0 && datos.clientesTotal > 1) {
      out.push({
        texto: `${pct(datos.clientesUnTipo, datos.clientesTotal)} % de los clientes solo usa un tipo de servicio: hay espacio para venta cruzada (ej. a quien hace Envíos, sugerirle Acarreo).`,
      });
    }
    return out;
  }, [datos, tipos]);

  const abrirPromo = (p: Promo) => setPromo({ ...p, clave: Date.now() });

  if (cargando && !datos) {
    return <ActivityIndicator color={AZUL} style={{ marginTop: 20 }} />;
  }
  if (error && !datos) return <Text style={styles.error}>{error}</Text>;
  if (!datos) return null;

  const totalPedidos = tipos.reduce((s, t) => s + t.total, 0);

  return (
    <View style={[styles.raiz, cargando && { opacity: 0.5 }]}>
      <Text style={styles.titulo}>
        Clientes y <Text style={{ color: AZUL }}>servicios</Text>
      </Text>

      <View style={styles.kpis}>
        <Kpi titulo="Clientes activos" valor={`${datos.clientesActivos}`} />
        <Kpi titulo="Clientes nuevos" valor={`${datos.clientesNuevos}`} />
        <Kpi
          titulo="Recompra"
          valor={`${pct(datos.clientesRecurrentes, datos.clientesTotal)} %`}
        />
        <Kpi titulo="Inactivos (30+ días)" valor={`${datos.clientesInactivos}`} />
      </View>

      {oportunidades.length > 0 && (
        <View style={styles.tarjeta}>
          <TextoIcono icono="bulb-outline" colorIcono={p.estrella} style={styles.seccion}>
            Oportunidades
          </TextoIcono>
          {oportunidades.map((o) => (
            <View key={o.texto} style={styles.oportunidad}>
              <Text style={styles.texto}>• {o.texto}</Text>
              {o.promo && (
                <Pressable onPress={() => abrirPromo(o.promo!)} style={styles.botonPromo}>
                  <TextoIcono icono="gift-outline" style={styles.botonPromoTexto}>
                    Enviar promoción
                  </TextoIcono>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {promo ? (
        <FormularioPromocion
          key={promo.clave}
          motivoInicial={promo.motivo}
          tipoInicial={promo.tipo}
          onCerrar={() => setPromo(null)}
          onEnviada={() => setVersion((v) => v + 1)}
        />
      ) : (
        <Pressable
          onPress={() => abrirPromo({ motivo: "todos", tipo: null })}
          style={styles.botonNueva}>
          <TextoIcono icono="add" style={styles.botonPromoTexto}>
            Nueva promoción
          </TextoIcono>
        </Pressable>
      )}

      <ResultadosPromociones version={version} />

      <View style={styles.tarjeta}>
        <Text style={styles.seccion}>Rendimiento por servicio</Text>
        {tipos.map((t) => {
          const dv =
            t.anterior != null && t.anterior > 0
              ? Math.round(((t.total - t.anterior) / t.anterior) * 100)
              : null;
          return (
            <View key={t.tipo} style={styles.servicio}>
              <View style={styles.fila}>
                <TextoIcono
                  icono={ICONO[t.tipo] ?? "ellipse-outline"}
                  style={styles.nombre}
                >
                  {t.tipo}
                </TextoIcono>
                <Text style={styles.valor}>
                  {t.total} · {pct(t.total, totalPedidos)} %
                  {dv != null && (
                    <Text style={{ color: dv >= 0 ? p.textoExito : p.textoError2 }}>
                      {"  "}
                      <Icono
                        nombre={dv >= 0 ? "caret-up" : "caret-down"}
                        tamano={12}
                        color={dv >= 0 ? p.textoExito : p.textoError2}
                      />{" "}
                      {Math.abs(dv)} %
                    </Text>
                  )}
                </Text>
              </View>
              <Text style={styles.detalle}>
                Ingresos {formatearPesos(t.ingresos)} · Tarifa prom.{" "}
                {t.tarifaPromedio ? formatearPesos(t.tarifaPromedio) : "—"} · Cancelados{" "}
                {pct(t.cancelados, t.total)} %
              </Text>
              <Text style={styles.detalle}>
                Lo usaron {t.clientes} clientes · Nunca lo han pedido {t.clientesNunca}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiTitulo}>{titulo}</Text>
      <Text style={styles.kpiValor}>{valor}</Text>
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  raiz: { gap: 16 },
  titulo: { color: p.textoTitulo, fontSize: 24, fontWeight: "900", marginTop: 8 },
  error: { color: p.textoError2, fontSize: 13, textAlign: "center" },
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
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  seccion: { color: p.texto, fontSize: 16, fontWeight: "800" },
  texto: { color: p.textoDato, fontSize: 13, lineHeight: 19 },
  oportunidad: { gap: 8, paddingBottom: 6 },
  botonPromo: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: AZUL,
  },
  botonNueva: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AZUL,
  },
  botonPromoTexto: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  servicio: { gap: 3, paddingVertical: 4 },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  nombre: { color: p.textoDato, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  valor: { color: p.texto, fontSize: 14, fontWeight: "800" },
  detalle: { color: p.textoTenue, fontSize: 12, lineHeight: 17 },
});
