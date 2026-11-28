// Método de pago + comisión de la app + ganancia neta de un servicio.
// Solo lo ve el transportista (el cliente no ve la comisión).
import { StyleSheet, View } from "react-native";

import { Text } from "../ui/Texto";
import type { SolicitudServicioDTO } from "../../services/servicioService";
import {
  calcularComision,
  COMISION_PORCENTAJE,
  textoMetodoPago,
} from "../../services/saldoService";
import { formatearPesos } from "../../services/tarifa";
import { useEstilos, type Paleta } from "../../services/temaStore";

export default function ResumenPagoTransportista({
  item,
}: {
  item: SolicitudServicioDTO;
}) {
  const styles = useEstilos(crearEstilos);
  if (item.estado === "cancelada" || item.tarifaAcordada == null) return null;

  const tarifa = item.tarifaAcordada;
  const comision = calcularComision(tarifa);
  const neto = tarifa - comision;
  const efectivo = item.metodoPago === "efectivo";
  const finalizada = item.estado === "completada";

  const nota = finalizada
    ? "Este servicio ya quedó reflejado en tu saldo."
    : efectivo
      ? "Cobras el valor total en efectivo al cliente. La comisión se descuenta de tu saldo cuando finalices el servicio."
      : "El cliente ya pagó en la app. Tu saldo aumenta cuando finalices el servicio.";

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>PAGO Y COMISIÓN</Text>
      <View style={styles.bloque}>
        <Fila
          etiqueta="Método de pago"
          valor={textoMetodoPago(item.metodoPago)}
          styles={styles}
        />
        <Fila
          etiqueta="Tarifa del servicio"
          valor={formatearPesos(tarifa)}
          styles={styles}
        />
        <Fila
          etiqueta={`Comisión de la app (${COMISION_PORCENTAJE}%)`}
          valor={`-${formatearPesos(comision)}`}
          styles={styles}
          descuento
        />
        <View style={styles.filaFinal}>
          <Text style={styles.etiquetaFinal}>Tu ganancia neta</Text>
          <Text
            style={styles.valorFinal}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatearPesos(neto)}
          </Text>
        </View>
        <Text style={styles.nota}>{nota}</Text>
      </View>
    </View>
  );
}

function Fila({
  etiqueta,
  valor,
  styles,
  descuento = false,
}: {
  etiqueta: string;
  valor: string;
  styles: ReturnType<typeof crearEstilos>;
  descuento?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text
        style={[styles.valor, descuento && styles.valorDescuento]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </Text>
    </View>
  );
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    contenedor: { marginBottom: 14 },
    titulo: {
      color: p.textoAlfa(0.6),
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 4,
    },
    bloque: {
      backgroundColor: p.velo(0.03),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.linea(0.08),
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    fila: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    etiqueta: {
      color: p.textoAlfa(0.72),
      fontSize: 12,
      flex: 1,
      minWidth: 0,
    },
    valor: {
      color: p.texto,
      fontSize: 12,
      fontWeight: "700",
      flexShrink: 0,
    },
    valorDescuento: { color: p.textoError },
    filaFinal: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: p.linea(0.1),
      paddingTop: 8,
    },
    etiquetaFinal: {
      color: p.texto,
      fontSize: 13,
      fontWeight: "800",
      flex: 1,
    },
    valorFinal: {
      color: p.textoExito,
      fontSize: 16,
      fontWeight: "800",
      flexShrink: 0,
    },
    nota: {
      color: p.textoAlfa(0.6),
      fontSize: 11,
      lineHeight: 16,
    },
  });
