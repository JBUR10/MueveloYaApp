// src/components/admin/Reportes.tsx
//
// Pestaña "Reportes" del panel de administrador:
//  - Arriba, tarjetas con la tarifa promedio y el valor total (se cargan
//    solas al entrar).
//  - Abajo, listados de servicios (pendientes por tarifa, mudanzas, en
//    curso, más de 5 km, el más caro): al tocar uno, su tabla sale debajo.
// Total de servicios, por tipo y por estado están en "Estadísticas".
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/Texto";

import {
  CodigoConsulta,
  Columna,
  CONSULTAS,
  ejecutarConsulta,
  FilaConsulta,
} from "../../services/consultasAdminService";
import { formatearPesos } from "../../services/tarifa";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const AZUL = "#2969e9";

const METRICAS = CONSULTAS.filter((c) => c.tipo === "kpi");
const LISTADOS = CONSULTAS.filter((c) => c.tipo === "tabla");

const ESTADOS: Record<string, { texto: string }> = {
  pendiente: { texto: "Pendiente" },
  aceptada: { texto: "Aceptada" },
  en_curso: { texto: "En curso" },
  completada: { texto: "Completada" },
  cancelada: { texto: "Cancelada" },
};

/** Color del texto de cada estado según el tema. */
const colorDeEstado = (estado: string, p: Paleta): string | undefined =>
  ({
    pendiente: p.textoAviso,
    aceptada: p.acento2,
    en_curso: p.textoMorado,
    completada: p.textoExito,
    cancelada: p.textoError2,
  })[estado];

/** Ancho de cada columna de la tabla según lo que muestra. */
const ANCHO: Record<string, number> = {
  id: 90,
  tipo_servicio: 100,
  origen: 190,
  destino: 190,
  distancia_km: 80,
  tarifa_acordada: 110,
  tarifa_base: 110,
  descuento: 110,
  recargo_carga: 110,
  estado: 110,
};

type Resultado =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; filas: FilaConsulta[] };

function formatearValor(valor: unknown, formato: Columna["formato"]) {
  if (valor == null || valor === "") return "—";
  switch (formato) {
    case "pesos":
      return formatearPesos(Number(valor));
    case "numero":
      // Mismo separador de miles que los precios: 1234 -> "1.234".
      return formatearPesos(Number(valor)).replace("$ ", "");
    case "km":
      // numeric llega como texto: "7.30" -> "7,3 km"
      return `${Number(valor).toFixed(1).replace(".", ",")} km`;
    case "id":
      // Los id son UUID largos: se muestran los primeros 8 caracteres.
      return String(valor).slice(0, 8);
    case "estado":
      return ESTADOS[String(valor)]?.texto ?? String(valor);
    default:
      return String(valor);
  }
}

function Tabla({
  columnas,
  filas,
  titulo,
}: {
  columnas: Columna[];
  filas: FilaConsulta[];
  titulo: string;
}) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      accessibilityHint="Desliza horizontalmente para consultar todas las columnas."
    >
      <View role="table" accessibilityLabel={`Tabla ${titulo}`}>
        <View
          role="row"
          style={[styles.fila, styles.filaEncabezado]}
        >
          {columnas.map((c) => (
            <Text
              key={c.clave}
              role="columnheader"
              style={[styles.celda, styles.celdaEncabezado, { width: ANCHO[c.clave] ?? 120 }]}
            >
              {c.titulo}
            </Text>
          ))}
        </View>
        {filas.map((fila, i) => (
          <View
            key={i}
            role="row"
            style={[styles.fila, i % 2 === 1 && styles.filaPar]}
          >
            {columnas.map((c) => {
              const colorEstado =
                c.formato === "estado" ? colorDeEstado(String(fila[c.clave]), p) : undefined;
              return (
                <Text
                  key={c.clave}
                  role="cell"
                  numberOfLines={2}
                  style={[
                    styles.celda,
                    { width: ANCHO[c.clave] ?? 120 },
                    c.formato === "pesos" && styles.celdaPesos,
                    !!colorEstado && { color: colorEstado, fontWeight: "800" },
                  ]}
                >
                  {formatearValor(fila[c.clave], c.formato)}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function Reportes() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  // Las métricas arrancan "cargando" y se piden al entrar.
  const [metricas, setMetricas] = useState<Partial<Record<CodigoConsulta, Resultado>>>(
    () => Object.fromEntries(METRICAS.map((m) => [m.codigo, { estado: "cargando" }])),
  );
  const [listado, setListado] = useState<CodigoConsulta | null>(null);
  const [resultados, setResultados] = useState<
    Partial<Record<CodigoConsulta, Resultado>>
  >({});

  const cargarMetrica = async (codigo: CodigoConsulta) => {
    try {
      const filas = await ejecutarConsulta(codigo);
      setMetricas((m) => ({ ...m, [codigo]: { estado: "listo", filas } }));
    } catch (error: any) {
      setMetricas((m) => ({
        ...m,
        [codigo]: { estado: "error", mensaje: error?.message || "Error." },
      }));
    }
  };

  useEffect(() => {
    METRICAS.forEach((m) => cargarMetrica(m.codigo));
  }, []);

  const verListado = async (codigo: CodigoConsulta) => {
    setListado(codigo);
    setResultados((r) => ({ ...r, [codigo]: { estado: "cargando" } }));
    try {
      const filas = await ejecutarConsulta(codigo);
      setResultados((r) => ({ ...r, [codigo]: { estado: "listo", filas } }));
    } catch (error: any) {
      setResultados((r) => ({
        ...r,
        [codigo]: { estado: "error", mensaje: error?.message || "Error desconocido." },
      }));
    }
  };

  const consulta = LISTADOS.find((c) => c.codigo === listado) ?? null;
  const resultado = listado ? resultados[listado] : undefined;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Reportes de servicios</Text>
      <Text style={styles.subtitulo}>Tarifas y listados de las solicitudes.</Text>

      {/* Métricas */}
      <View style={styles.filaMetricas}>
        {METRICAS.map((m) => {
          const r = metricas[m.codigo];
          const valor = r?.estado === "listo" ? r.filas[0]?.valor : null;
          return (
            <View key={m.codigo} style={styles.metrica}>
              <Text style={styles.metricaEtiqueta}>{m.titulo.toUpperCase()}</Text>
              {r?.estado === "cargando" ? (
                <ActivityIndicator
                  color={AZUL}
                  style={{ marginVertical: 8 }}
                  accessibilityLabel={`Cargando ${m.titulo.toLowerCase()}`}
                />
              ) : r?.estado === "error" ? (
                <Pressable onPress={() => cargarMetrica(m.codigo)}>
                  <Text style={styles.metricaError}>No se pudo cargar · Reintentar</Text>
                </Pressable>
              ) : (
                <Text style={styles.metricaValor} numberOfLines={2}>
                  {formatearPesos(valor == null ? null : Number(valor))}
                </Text>
              )}
              <Text style={styles.metricaDescripcion}>{m.descripcion}</Text>
            </View>
          );
        })}
      </View>

      {/* Listados */}
      <Text style={styles.seccion}>Listados</Text>
      <View
        style={styles.rejilla}
        accessibilityRole="radiogroup"
        accessibilityLabel="Seleccionar listado de reportes"
      >
        {LISTADOS.map((c) => {
          const activo = listado === c.codigo;
          const cargando = resultados[c.codigo]?.estado === "cargando";
          return (
            <Pressable
              key={c.codigo}
              onPress={() => verListado(c.codigo)}
              disabled={cargando}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo, disabled: cargando }}
              accessibilityHint="Muestra este listado de servicios."
              style={({ pressed }) => [
                styles.boton,
                activo && styles.botonActivo,
                pressed && styles.presionado,
              ]}
            >
              <Text style={[styles.botonTitulo, activo && styles.botonTituloActivo]}>
                {c.titulo}
              </Text>
              {cargando && (
                <ActivityIndicator size="small" color={activo ? "#FFFFFF" : p.texto} />
              )}
            </Pressable>
          );
        })}
      </View>

      {consulta && resultado && (
        <View style={styles.resultado}>
          <View style={styles.resultadoEncabezado}>
            <Text style={styles.resultadoTitulo}>{consulta.titulo}</Text>
            {resultado.estado === "listo" && (
              <Text
                style={styles.contador}
                role="status"
                accessibilityLiveRegion="polite"
                aria-live="polite"
              >
                {resultado.filas.length} servicio{resultado.filas.length === 1 ? "" : "s"}
              </Text>
            )}
          </View>
          <Text style={styles.descripcion}>{consulta.descripcion}</Text>

          {resultado.estado === "cargando" ? (
            <ActivityIndicator
              color={AZUL}
              style={{ marginVertical: 24 }}
              accessibilityLabel={`Cargando el listado ${consulta.titulo}`}
            />
          ) : resultado.estado === "error" ? (
            <View style={styles.error}>
              <Text
                style={styles.errorTexto}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                aria-live="assertive"
              >
                {resultado.mensaje}
              </Text>
              <Pressable onPress={() => verListado(consulta.codigo)} style={styles.reintentar}>
                <Text style={styles.reintentarTexto}>Reintentar</Text>
              </Pressable>
            </View>
          ) : resultado.filas.length === 0 ? (
            <Text
              style={styles.vacio}
              role="status"
              accessibilityLiveRegion="polite"
              aria-live="polite"
            >
              No hay servicios en este listado.
            </Text>
          ) : (
            <Tabla
              titulo={consulta.titulo}
              columnas={consulta.columnas ?? []}
              filas={resultado.filas}
            />
          )}
        </View>
      )}
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  contenedor: { gap: 12 },
  titulo: { color: p.texto, fontSize: 18, fontWeight: "900" },
  subtitulo: { color: p.textoTenue, fontSize: 13, marginTop: -6 },
  filaMetricas: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  metrica: {
    flex: 1,
    padding: 14,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(41,105,233,0.35)",
    backgroundColor: "rgba(41,105,233,0.12)",
  },
  metricaEtiqueta: { color: p.acento, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  metricaValor: {
    color: p.texto,
    fontSize: 22,
    fontWeight: "900",
    flexShrink: 1,
  },
  metricaDescripcion: { color: p.textoTenue, fontSize: 11 },
  metricaError: { color: p.textoError, fontSize: 12, fontWeight: "700", marginVertical: 6 },
  seccion: { color: p.textoFuerte2, fontSize: 15, fontWeight: "800", marginTop: 4 },
  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  boton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.linea(0.14),
    backgroundColor: p.velo(0.045),
  },
  botonActivo: { borderColor: AZUL, backgroundColor: AZUL },
  botonTitulo: { color: p.textoSuave, fontSize: 13, fontWeight: "700" },
  botonTituloActivo: { color: "#FFFFFF", fontWeight: "800" },
  presionado: { opacity: 0.75 },
  resultado: {
    padding: 14,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  resultadoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  resultadoTitulo: { color: p.texto, fontSize: 15, fontWeight: "800", flex: 1 },
  contador: { color: p.textoTenue, fontSize: 12, fontWeight: "700" },
  descripcion: { color: p.textoTenue, fontSize: 12 },
  fila: { flexDirection: "row" },
  filaEncabezado: {
    borderBottomWidth: 1,
    borderBottomColor: p.linea(0.2),
  },
  filaPar: { backgroundColor: p.velo(0.04) },
  celda: {
    color: p.textoSuave,
    fontSize: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  celdaEncabezado: { color: p.acento, fontWeight: "900", fontSize: 11 },
  celdaPesos: { color: p.textoExito, fontWeight: "800", textAlign: "right" },
  error: { gap: 10, paddingVertical: 8 },
  errorTexto: { color: p.textoError, fontSize: 13 },
  reintentar: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: p.velo(0.1),
  },
  reintentarTexto: { color: p.texto, fontWeight: "700", fontSize: 13 },
  vacio: { color: p.textoTenue, fontSize: 13, paddingVertical: 12 },
});
