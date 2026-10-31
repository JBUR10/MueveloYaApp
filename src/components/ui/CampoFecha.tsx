// src/components/ui/CampoFecha.tsx
// Selector de fecha que funciona en web (input nativo) y en Android/iOS
// (DateTimePicker). Trabaja con texto "AAAA-MM-DD".
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  estadoDocumento,
  fechaDeTexto,
  formatearFechaCorta,
  textoDeFecha,
} from "../../services/vehiculoService";

const TEXTO_ESTADO = {
  vigente: { texto: "Vigente", color: "#86E8BD" },
  por_vencer: { texto: "Por vencer", color: "#fbbf24" },
  vencido: { texto: "Vencido", color: "#fca5a5" },
  falta: { texto: "", color: "transparent" },
} as const;

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
  const [abierto, setAbierto] = useState(false);
  const estado = TEXTO_ESTADO[estadoDocumento(valor)];

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
            backgroundColor: "#0b0e14",
            color: "#ffffff",
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${error ? "rgba(239,68,68,0.7)" : "#1f2937"}`,
            fontSize: "14px",
            width: "100%",
            boxSizing: "border-box",
            colorScheme: "dark",
          }}
        />
      ) : (
        <Pressable
          onPress={() => setAbierto(true)}
          accessibilityRole="button"
          style={[styles.selector, !!error && styles.selectorError]}
        >
          <Text style={[styles.textoSelector, !valor && styles.placeholder]}>
            {valor ? `📅 ${formatearFechaCorta(valor)}` : "📅 Seleccionar fecha"}
          </Text>
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
          themeVariant="dark"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: 6 },
  filaEtiqueta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etiqueta: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
  estado: { fontSize: 11, fontWeight: "800" },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0b0e14",
  },
  selectorError: { borderColor: "rgba(239,68,68,0.7)" },
  textoSelector: { color: "#FFFFFF", fontSize: 14 },
  placeholder: { color: "rgba(255,255,255,0.45)" },
  quitar: { color: "#fca5a5", fontSize: 12, fontWeight: "700" },
  error: { color: "#fca5a5", fontSize: 11 },
  ayuda: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
});
