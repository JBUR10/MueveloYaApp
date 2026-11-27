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
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const fecha = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Lectura rápida del resultado, para quien no quiere interpretar números. */
function veredicto(c: ResultadoCampana, p: Paleta): { texto: string; color: string } {
  const vigente = new Date(c.venceEl).getTime() > Date.now();
  const uso = pct(c.usados, c.enviados);
  if (vigente && c.usados === 0) return { texto: "En curso · aún sin usos", color: p.textoAviso };
  if (vigente) return { texto: `En curso · ${uso} % usado`, color: p.acento2 };
  if (uso >= 15) return { texto: `Funcionó · ${uso} % de uso`, color: p.textoExito };
  if (uso > 0) return { texto: `Poco uso · ${uso} %`, color: p.textoAviso };
  return { texto: "Nadie la usó", color: p.textoError2 };
}

export default function ResultadosPromociones({ version }: { version: number }) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
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
      {!!error && (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          aria-live="assertive"
        >
          {error}
        </Text>
      )}
      {filas == null && !error ? (
        <ActivityIndicator
          color="#2969e9"
          accessibilityLabel="Cargando resultados de promociones"
        />
      ) : filas && filas.length === 0 ? (
        <Text
          style={styles.detalle}
          role="status"
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          Todavía no has enviado promociones. Usa «Enviar promoción» en una oportunidad.
        </Text>
      ) : (
        <>
          {filas && filas.length > 0 && (
            <Text
              style={styles.detalle}
              role="status"
              accessibilityLiveRegion="polite"
              aria-live="polite"
            >
              {filas.length} campaña{filas.length === 1 ? "" : "s"} de promoción.
            </Text>
          )}
          {filas?.map((c) => {
            const v = veredicto(c, p);
            return (
              <View key={c.id} style={styles.campana}>
                <View style={styles.fila}>
                  <Text style={styles.nombre}>
                    {c.porcentaje} % · {c.tipo ?? "cualquier servicio"}
                  </Text>
                  <Text style={[styles.veredicto, { color: v.color }]}>
                    {v.texto}
                  </Text>
                </View>
                <Text style={styles.detalle}>
                  {NOMBRE_MOTIVO[c.motivo] ?? c.motivo} · enviada{" "}
                  {fecha(c.creadaEl)} · vence {fecha(c.venceEl)}
                </Text>
                <Text style={styles.detalle}>
                  Enviados {c.enviados} · Usados {c.usados} (
                  {pct(c.usados, c.enviados)} %) · Completados {c.completados}
                </Text>
                <Text style={styles.detalle}>
                  Ingresos {formatearPesos(c.ingresos)} · Descuento dado{" "}
                  {formatearPesos(c.descuento)}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  tarjeta: {
    padding: 16,
    gap: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    backgroundColor: p.panel(0.94),
  },
  seccion: { color: p.texto, fontSize: 16, fontWeight: "800" },
  campana: { gap: 3, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.linea(0.08) },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  nombre: { color: p.textoDato, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  veredicto: { fontSize: 12, fontWeight: "800" },
  detalle: { color: p.textoTenue, fontSize: 12, lineHeight: 17 },
  error: { color: p.textoError2, fontSize: 13 },
});
