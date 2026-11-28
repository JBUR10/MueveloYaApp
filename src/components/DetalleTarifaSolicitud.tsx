import { View, StyleSheet } from "react-native";
import { Text } from "./ui/Texto";
import type { SolicitudServicioDTO } from "../services/servicioService";
import {
  formatearPesos,
  PRECIO_AYUDANTE,
  PRECIO_PISO,
} from "../services/tarifa";
import { useEstilos, type Paleta } from "../services/temaStore";

export default function DetalleTarifaSolicitud({
  item,
}: {
  item: SolicitudServicioDTO;
}) {
  const styles = useEstilos(crearEstilos);
  const costoAyudantes = Math.max(item.ayudantes, 0) * PRECIO_AYUDANTE;
  const costoPisos = Math.max(item.pisosEscaleras, 0) * PRECIO_PISO;
  const costoCarga = Math.max(item.recargoCarga ?? 0, 0);
  const descuento = Math.max(item.descuento ?? 0, 0);
  const tieneDescuento = descuento > 0;
  const subtotal =
    item.tarifaBase ??
    (item.tarifaAcordada != null ? item.tarifaAcordada + descuento : null);
  const tieneFilasCondicionales =
    costoAyudantes > 0 ||
    costoPisos > 0 ||
    costoCarga > 0 ||
    tieneDescuento;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>SERVICIOS ADICIONALES</Text>
      <View style={styles.bloqueAdicionales}>
        <View style={styles.columna}>
          <Text style={styles.valorMetrica}>{item.ayudantes}</Text>
          <Text style={styles.etiquetaMetrica}>Ayudantes</Text>
        </View>
        <View style={styles.divisorVertical} />
        <View style={styles.columna}>
          <Text style={styles.valorMetrica}>{item.pisosEscaleras}</Text>
          <Text style={styles.etiquetaMetrica}>Pisos</Text>
        </View>
        <View style={styles.divisorVertical} />
        <View style={styles.columna}>
          <Text
            style={styles.valorMetrica}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatearPesos(costoCarga)}
          </Text>
          <Text style={styles.etiquetaMetrica}>Carga especial</Text>
        </View>
      </View>

      <Text style={[styles.titulo, styles.tituloResumen]}>RESUMEN DE TARIFA</Text>
      <View style={styles.bloqueResumen}>
        {costoAyudantes > 0 && (
          <FilaResumen
            etiqueta={`Ayudantes (${item.ayudantes})`}
            monto={costoAyudantes}
            styles={styles}
          />
        )}
        {costoPisos > 0 && (
          <FilaResumen
            etiqueta={`Pisos (${item.pisosEscaleras})`}
            monto={costoPisos}
            styles={styles}
          />
        )}
        {costoCarga > 0 && (
          <FilaResumen etiqueta="Carga especial" monto={costoCarga} styles={styles} />
        )}
        {tieneDescuento && (
          <>
            <FilaResumen
              etiqueta="Subtotal"
              monto={subtotal}
              styles={styles}
            />
            <FilaResumen
              etiqueta="Descuento"
              monto={-descuento}
              styles={styles}
              descuento
            />
          </>
        )}
        <View
          style={[
            styles.filaTarifaFinal,
            tieneFilasCondicionales && styles.filaTarifaFinalSeparada,
          ]}
        >
          <Text style={styles.etiquetaTarifaFinal}>Tarifa final</Text>
          <Text
            style={styles.montoTarifaFinal}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatearPesos(item.tarifaAcordada)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FilaResumen({
  etiqueta,
  monto,
  styles,
  descuento = false,
}: {
  etiqueta: string;
  monto: number | null;
  styles: ReturnType<typeof crearEstilos>;
  descuento?: boolean;
}) {
  return (
    <View style={styles.filaResumen}>
      <Text style={styles.etiquetaResumen}>{etiqueta}</Text>
      <Text
        style={[styles.montoResumen, descuento && styles.montoDescuento]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {descuento
          ? `-${formatearPesos(Math.abs(monto ?? 0))}`
          : formatearPesos(monto)}
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
    tituloResumen: { marginTop: 12 },
    bloqueAdicionales: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: p.velo(0.03),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.linea(0.08),
      paddingVertical: 10,
    },
    columna: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
    divisorVertical: {
      width: 1,
      backgroundColor: p.velo(0.15),
    },
    valorMetrica: {
      color: p.texto,
      fontSize: 18,
      fontWeight: "800",
      flexShrink: 0,
    },
    etiquetaMetrica: {
      color: p.textoAlfa(0.6),
      fontSize: 11,
      marginTop: 1,
      textAlign: "center",
    },
    bloqueResumen: {
      backgroundColor: p.velo(0.03),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.linea(0.08),
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    filaResumen: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    etiquetaResumen: {
      color: p.textoAlfa(0.72),
      fontSize: 12,
      flex: 1,
      minWidth: 0,
    },
    montoResumen: {
      color: p.texto,
      fontSize: 12,
      fontWeight: "700",
      flexShrink: 0,
      textAlign: "right",
    },
    montoDescuento: { color: p.textoExito },
    filaTarifaFinal: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginTop: 2,
    },
    filaTarifaFinalSeparada: {
      borderTopWidth: 1,
      borderTopColor: p.linea(0.1),
      paddingTop: 10,
    },
    etiquetaTarifaFinal: {
      color: p.texto,
      fontSize: 14,
      fontWeight: "800",
      flex: 1,
      minWidth: 0,
    },
    montoTarifaFinal: {
      color: p.texto,
      fontSize: 18,
      fontWeight: "900",
      flexShrink: 0,
      textAlign: "right",
    },
  });
