// src/components/admin/ConsultasSQL.tsx
//
// Sección "Consultas SQL" del panel de administrador: diez botones (Q01–Q10)
// que ejecutan consultas sobre la tabla "servicios" y muestran el resultado
// debajo, como tarjeta (métricas únicas) o como tabla (listados).
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Columna,
  CONSULTAS,
  Consulta,
  CodigoConsulta,
  ejecutarConsulta,
  FilaConsulta,
} from "../../services/consultasAdminService";
import { formatearPesos } from "../../services/tarifa";

const AZUL = "#2969e9";

const ESTADOS: Record<string, { texto: string; color: string }> = {
  pendiente: { texto: "Pendiente", color: "#fbbf24" },
  aceptada: { texto: "Aceptada", color: "#60a5fa" },
  en_curso: { texto: "En curso", color: "#a78bfa" },
  completada: { texto: "Completada", color: "#34d399" },
  cancelada: { texto: "Cancelada", color: "#f87171" },
};

/** Ancho de cada columna de la tabla según lo que muestra. */
const ANCHO: Record<string, number> = {
  id: 90,
  tipo_servicio: 100,
  origen: 190,
  destino: 190,
  distancia_km: 80,
  tarifa_acordada: 110,
  estado: 110,
  total: 80,
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

function Tabla({ columnas, filas }: { columnas: Columna[]; filas: FilaConsulta[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={[styles.fila, styles.filaEncabezado]}>
          {columnas.map((c) => (
            <Text
              key={c.clave}
              style={[styles.celda, styles.celdaEncabezado, { width: ANCHO[c.clave] ?? 120 }]}
            >
              {c.titulo}
            </Text>
          ))}
        </View>
        {filas.map((fila, i) => (
          <View key={i} style={[styles.fila, i % 2 === 1 && styles.filaPar]}>
            {columnas.map((c) => {
              const texto = formatearValor(fila[c.clave], c.formato);
              const colorEstado =
                c.formato === "estado" ? ESTADOS[String(fila[c.clave])]?.color : undefined;
              return (
                <Text
                  key={c.clave}
                  numberOfLines={2}
                  style={[
                    styles.celda,
                    { width: ANCHO[c.clave] ?? 120 },
                    c.formato === "pesos" && styles.celdaPesos,
                    !!colorEstado && { color: colorEstado, fontWeight: "800" },
                  ]}
                >
                  {texto}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Kpi({ consulta, filas }: { consulta: Consulta; filas: FilaConsulta[] }) {
  const valor = filas[0]?.valor;
  const texto =
    consulta.formatoKpi === "pesos"
      ? formatearPesos(valor == null ? null : Number(valor))
      : formatearValor(valor, "numero");
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiEtiqueta}>{consulta.titulo.toUpperCase()}</Text>
      <Text style={styles.kpiValor}>{texto}</Text>
      <Text style={styles.kpiDescripcion}>{consulta.descripcion}</Text>
    </View>
  );
}

export default function ConsultasSQL() {
  const [seleccionada, setSeleccionada] = useState<CodigoConsulta | null>(null);
  const [resultados, setResultados] = useState<
    Partial<Record<CodigoConsulta, Resultado>>
  >({});

  const ejecutar = async (codigo: CodigoConsulta) => {
    setSeleccionada(codigo);
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

  const consulta = CONSULTAS.find((c) => c.codigo === seleccionada) ?? null;
  const resultado = seleccionada ? resultados[seleccionada] : undefined;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Reportes y Consultas SQL</Text>
      <Text style={styles.subtitulo}>
        Toca una consulta para ejecutarla sobre la tabla de servicios.
      </Text>

      <View style={styles.rejilla}>
        {CONSULTAS.map((c) => {
          const activa = seleccionada === c.codigo;
          const cargando = resultados[c.codigo]?.estado === "cargando";
          return (
            <Pressable
              key={c.codigo}
              onPress={() => ejecutar(c.codigo)}
              disabled={cargando}
              accessibilityRole="button"
              accessibilityLabel={`${c.codigo}: ${c.titulo}`}
              style={({ pressed }) => [
                styles.boton,
                activa && styles.botonActivo,
                pressed && styles.presionado,
              ]}
            >
              <View style={styles.botonFila}>
                <Text style={[styles.codigo, activa && styles.codigoActivo]}>
                  {c.codigo}
                </Text>
                {cargando && <ActivityIndicator size="small" color="#FFFFFF" />}
              </View>
              <Text style={styles.botonTitulo} numberOfLines={2}>
                {c.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {consulta && resultado && (
        <View style={styles.resultado}>
          <View style={styles.resultadoEncabezado}>
            <Text style={styles.resultadoTitulo}>
              {consulta.codigo} · {consulta.titulo}
            </Text>
            {resultado.estado === "listo" && consulta.tipo === "tabla" && (
              <Text style={styles.contador}>
                {resultado.filas.length} fila{resultado.filas.length === 1 ? "" : "s"}
              </Text>
            )}
          </View>
          {consulta.tipo === "tabla" && (
            <Text style={styles.descripcion}>{consulta.descripcion}</Text>
          )}

          {resultado.estado === "cargando" ? (
            <ActivityIndicator color={AZUL} style={{ marginVertical: 24 }} />
          ) : resultado.estado === "error" ? (
            <View style={styles.error}>
              <Text style={styles.errorTexto}>{resultado.mensaje}</Text>
              <Pressable onPress={() => ejecutar(consulta.codigo)} style={styles.reintentar}>
                <Text style={styles.reintentarTexto}>Reintentar</Text>
              </Pressable>
            </View>
          ) : consulta.tipo === "kpi" ? (
            <Kpi consulta={consulta} filas={resultado.filas} />
          ) : resultado.filas.length === 0 ? (
            <Text style={styles.vacio}>La consulta no devolvió resultados.</Text>
          ) : (
            <Tabla columnas={consulta.columnas ?? []} filas={resultado.filas} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 12 },
  titulo: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  subtitulo: { color: "#9BA7BA", fontSize: 13, marginTop: -6 },
  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  boton: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  botonActivo: { borderColor: AZUL, backgroundColor: "rgba(41,105,233,0.18)" },
  botonFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  codigo: { color: "#8DB2FF", fontSize: 13, fontWeight: "900" },
  codigoActivo: { color: "#FFFFFF" },
  botonTitulo: { color: "#E7F0F4", fontSize: 12, fontWeight: "700" },
  presionado: { opacity: 0.75 },
  resultado: {
    padding: 14,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  resultadoEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  resultadoTitulo: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", flex: 1 },
  contador: { color: "#9BA7BA", fontSize: 12, fontWeight: "700" },
  descripcion: { color: "#9BA7BA", fontSize: 12 },
  fila: { flexDirection: "row" },
  filaEncabezado: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  filaPar: { backgroundColor: "rgba(255,255,255,0.04)" },
  celda: {
    color: "#E7F0F4",
    fontSize: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  celdaEncabezado: { color: "#8DB2FF", fontWeight: "900", fontSize: 11 },
  celdaPesos: { color: "#34d399", fontWeight: "800", textAlign: "right" },
  kpi: {
    alignItems: "center",
    paddingVertical: 18,
    gap: 4,
    borderRadius: 14,
    backgroundColor: "rgba(41,105,233,0.12)",
    borderWidth: 1,
    borderColor: "rgba(41,105,233,0.35)",
  },
  kpiEtiqueta: { color: "#8DB2FF", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  kpiValor: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
  kpiDescripcion: { color: "#9BA7BA", fontSize: 12, textAlign: "center" },
  error: { gap: 10, paddingVertical: 8 },
  errorTexto: { color: "#fca5a5", fontSize: 13 },
  reintentar: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  reintentarTexto: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  vacio: { color: "#9BA7BA", fontSize: 13, paddingVertical: 12 },
});
