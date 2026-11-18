// src/components/ui/CampoFecha.tsx
// Selector de fecha que funciona en web (input nativo) y en Android/iOS
// (DateTimePicker). Trabaja con texto "AAAA-MM-DD".
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Texto";

import {
  estadoDocumento,
  fechaDeTexto,
  formatearFechaCorta,
  textoDeFecha,
} from "../../services/vehiculoService";
import TextoIcono from "./TextoIcono";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const TEXTO_ESTADO = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  falta: "",
} as const;

const colorEstado = (
  estado: keyof typeof TEXTO_ESTADO,
  p: Paleta,
): string =>
  estado === "vigente"
    ? p.textoExito2
    : estado === "por_vencer"
      ? p.textoAviso
      : estado === "vencido"
        ? p.textoError
        : "transparent";

export default function CampoFecha({
  etiqueta,
  valor,
  onCambiar,
  opcional = false,
  error,
  maximo,
  ayuda,
}: {
  etiqueta: string;
  valor: string | null;
  onCambiar: (valor: string | null) => void;
  opcional?: boolean;
  error?: string;
  /** Fecha más lejana que se puede elegir. */
  maximo?: Date;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string;
}) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const [abierto, setAbierto] = useState(false);
  const claveEstado = estadoDocumento(valor);
  const estado = {
    texto: TEXTO_ESTADO[claveEstado],
    color: colorEstado(claveEstado, p),
  };

  const alCambiar = (evento: DateTimePickerEvent, fecha?: Date) => {
    setAbierto(Platform.OS === "ios");
    if (evento.type === "set" && fecha) onCambiar(textoDeFecha(fecha));
  };

  return (
    <View style={styles.campo}>
      <View style={styles.filaEtiqueta}>
        <Text style={styles.etiqueta}>
          {etiqueta}
          {opcional ? " (opcional)" : ""}
        </Text>
        {!!valor && (
          <Text style={[styles.estado, { color: estado.color }]}>
            {estado.texto}
          </Text>
        )}
      </View>

      {Platform.OS === "web" ? (
        <input
          type="date"
          value={valor ?? ""}
          max={maximo ? textoDeFecha(maximo) : undefined}
          onChange={(e) => onCambiar(e.target.value || null)}
          style={{
            backgroundColor: p.fondoProfundo,
            color: p.texto,
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${error ? "rgba(239,68,68,0.7)" : p.bordeCampo}`,
            fontSize: "14px",
            width: "100%",
            boxSizing: "border-box",
            colorScheme: p.esClaro ? "light" : "dark",
          }}
        />
      ) : (
        <Pressable
          onPress={() => setAbierto(true)}
          accessibilityRole="button"
          style={[styles.selector, !!error && styles.selectorError]}
        >
          <TextoIcono
            icono="calendar-outline"
            style={[styles.textoSelector, !valor && styles.placeholder]}
          >
            {valor ? formatearFechaCorta(valor) : "Seleccionar fecha"}
          </TextoIcono>
          {opcional && !!valor && (
            <Pressable onPress={() => onCambiar(null)} hitSlop={10}>
              <Text style={styles.quitar}>Quitar</Text>
            </Pressable>
          )}
        </Pressable>
      )}

      {!!error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        !!ayuda && <Text style={styles.ayuda}>{ayuda}</Text>
      )}

      {abierto && Platform.OS !== "web" && (
        <DateTimePicker
          value={fechaDeTexto(valor) ?? new Date()}
          maximumDate={maximo}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={alCambiar}
          themeVariant={p.esClaro ? "light" : "dark"}
        />
      )}
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  campo: { gap: 6 },
  filaEtiqueta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etiqueta: { color: p.textoAlfa(0.7), fontSize: 12, fontWeight: "700" },
  estado: { fontSize: 11, fontWeight: "800" },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.bordeCampo,
    backgroundColor: p.fondoProfundo,
  },
  selectorError: { borderColor: "rgba(239,68,68,0.7)" },
  textoSelector: { color: p.texto, fontSize: 14 },
  placeholder: { color: p.textoAlfa(0.45) },
  quitar: { color: p.textoError, fontSize: 12, fontWeight: "700" },
  error: { color: p.textoError, fontSize: 11 },
  ayuda: { color: p.textoAlfa(0.45), fontSize: 11 },
});
