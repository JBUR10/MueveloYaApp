// src/components/admin/ResultadosPromociones.tsx
//
// "¿Funcionó la promoción?": por cada campaña, cuántos cupones se enviaron,
// cuántos se usaron, cuántos terminaron en servicio completado y cuánto se
// ingresó frente al descuento regalado.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/Texto";

import {
  eliminarCampana,
  NOMBRE_MOTIVO,
  obtenerResultadosCampanas,
  obtenerPromocionesVigentes,
  PromocionVigente,
  ResultadoCampana,
} from "../../services/promocionesService";
import { formatearPesos } from "../../services/tarifa";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";
import { aviso, confirmar } from "../ui/AlertaPantalla";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const fecha = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Lectura rápida del resultado, para quien no quiere interpretar números. */
function veredicto(c: ResultadoCampana, p: Paleta): { texto: string; color: string } {
  if (c.eliminadaEl) return { texto: "Dada de baja", color: p.textoError2 };
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
  const [vigentes, setVigentes] = useState<PromocionVigente[] | null>(null);
  const [error, setError] = useState("");
  const [errorVigentes, setErrorVigentes] = useState("");
  const [eliminando, setEliminando] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setError("");
    setErrorVigentes("");
    Promise.all([obtenerResultadosCampanas(), obtenerPromocionesVigentes()])
      .then(([resultados, promociones]) => {
        if (!vigente) return;
        setFilas(resultados);
        setVigentes(promociones);
      })
      .catch((e) => {
        if (!vigente) return;
        const mensaje = e?.message || "No se pudieron cargar las promociones.";
        setError(mensaje);
        setErrorVigentes(mensaje);
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  const darDeBaja = async (campana: PromocionVigente) => {
    const ok = await confirmar({
      titulo: "Dar de baja la promoción",
      mensaje:
        "Los cupones sin usar dejarán de estar disponibles de inmediato. Esta acción no se puede deshacer.",
      textoAceptar: "Dar de baja",
      textoCancelar: "Mantener",
      destructivo: true,
    });
    if (!ok) return;

    setEliminando(campana.id);
    setErrorVigentes("");
    try {
      await eliminarCampana(campana.id);
      const eliminadaEl = new Date().toISOString();
      setVigentes((actuales) =>
        actuales?.filter((c) => c.id !== campana.id) ?? [],
      );
      setFilas((actuales) =>
        actuales?.map((c) =>
          c.id === campana.id ? { ...c, eliminadaEl } : c,
        ) ?? [],
      );
      await aviso("Promoción dada de baja", "Los cupones sin usar ya no pueden aplicarse.", "exito");
    } catch (e: any) {
      const mensaje = e?.message || "No se pudo dar de baja la promoción.";
      setErrorVigentes(mensaje);
      await aviso("No se pudo dar de baja", mensaje, "error");
    } finally {
      setEliminando(null);
    }
  };

  return (
    <View style={styles.tarjeta}>
      <Text style={styles.seccion}>Promociones vigentes</Text>
      {!!errorVigentes && <Text style={styles.error}>{errorVigentes}</Text>}
      {vigentes == null && !errorVigentes ? (
        <ActivityIndicator color="#2969e9" />
      ) : vigentes && vigentes.length === 0 ? (
        <Text style={styles.detalle}>No hay promociones vigentes.</Text>
      ) : (
        vigentes?.map((c) => (
          <View key={c.id} style={styles.campana}>
            <View style={styles.fila}>
              <Text style={styles.nombre}>
                {c.porcentaje} % · {c.tipo ?? "cualquier servicio"}
              </Text>
              <Pressable
                onPress={() => darDeBaja(c)}
                disabled={eliminando !== null}
                accessibilityRole="button"
                style={[styles.botonBaja, eliminando !== null && { opacity: 0.6 }]}
              >
                {eliminando === c.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.textoBaja}>Dar de baja</Text>
                )}
              </Pressable>
            </View>
            <Text style={styles.detalle}>
              {NOMBRE_MOTIVO[c.motivo] ?? c.motivo} · {c.enviados}{" "}
              {c.enviados === 1 ? "cupón enviado" : "cupones enviados"} · vence{" "}
              {fecha(c.venceEl)}
            </Text>
          </View>
        ))
      )}

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
          const v = veredicto(c, p);
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
  botonBaja: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: p.rellenoError,
    alignItems: "center",
    justifyContent: "center",
  },
  textoBaja: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  veredicto: { fontSize: 12, fontWeight: "800" },
  detalle: { color: p.textoTenue, fontSize: 12, lineHeight: 17 },
  error: { color: p.textoError2, fontSize: 13 },
});
