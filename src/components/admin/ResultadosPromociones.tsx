// src/components/admin/ResultadosPromociones.tsx
//
// "¿Funcionó la promoción?": por cada campaña, cuántos cupones se enviaron,
// cuántos se usaron, cuántos terminaron en servicio completado y cuánto se
// ingresó frente al descuento regalado.
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../ui/Texto";

import {
  NOMBRE_MOTIVO,
  obtenerResultadosCampanas,
  ResultadoCampana,
} from "../../services/promocionesService";
import { formatearPesos } from "../../services/tarifa";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const fecha = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Lectura rápida del resultado, para quien no quiere interpretar números. */
function veredicto(c: ResultadoCampana): { texto: string; color: string } {
  const vigente = new Date(c.venceEl).getTime() > Date.now();
  const uso = pct(c.usados, c.enviados);
  if (vigente && c.usados === 0) return { texto: "En curso · aún sin usos", color: "#fbbf24" };
  if (vigente) return { texto: `En curso · ${uso} % usado`, color: "#60a5fa" };
  if (uso >= 15) return { texto: `Funcionó · ${uso} % de uso`, color: "#34d399" };
  if (uso > 0) return { texto: `Poco uso · ${uso} %`, color: "#fbbf24" };
  return { texto: "Nadie la usó", color: "#f87171" };
}

export default function ResultadosPromociones({ version }: { version: number }) {
  const [filas, setFilas] = useState<ResultadoCampana[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setError("");
    obtenerResultadosCampanas()
      .then((f) => vigente && setFilas(f))
      .catch((e) => vigente && setError(e?.message || "No se pudieron cargar."));
    return () => {
      vigente = false;
    };
  }, [version]);

  return (
    <View style={styles.tarjeta}>
      <Text style={styles.seccion}>Resultados de promociones</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {filas == null && !error ? (
        <ActivityIndicator color="#2969e9" />
      ) : filas && filas.length === 0 ? (
        <Text style={styles.detalle}>
          Todavía no has enviado promociones. Usa «Enviar promoción» en una oportunidad.
        </Text>
      ) : (
        filas?.map((c) => {
          const v = veredicto(c);
          return (
            <View key={c.id} style={styles.campana}>
              <View style={styles.fila}>
                <Text style={styles.nombre}>
                  {c.porcentaje} % · {c.tipo ?? "cualquier servicio"}
                </Text>
                <Text style={[styles.veredicto, { color: v.color }]}>{v.texto}</Text>
              </View>
              <Text style={styles.detalle}>
                {NOMBRE_MOTIVO[c.motivo] ?? c.motivo} · enviada {fecha(c.creadaEl)} · vence{" "}
                {fecha(c.venceEl)}
              </Text>
              <Text style={styles.detalle}>
                Enviados {c.enviados} · Usados {c.usados} ({pct(c.usados, c.enviados)} %) ·
                Completados {c.completados}
              </Text>
              <Text style={styles.detalle}>
                Ingresos {formatearPesos(c.ingresos)} · Descuento dado{" "}
                {formatearPesos(c.descuento)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: 16,
    gap: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  seccion: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  campana: { gap: 3, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  nombre: { color: "#D5DCE8", fontSize: 14, fontWeight: "700", flexShrink: 1 },
  veredicto: { fontSize: 12, fontWeight: "800" },
  detalle: { color: "#9BA7BA", fontSize: 12, lineHeight: 17 },
  error: { color: "#f87171", fontSize: 13 },
});
