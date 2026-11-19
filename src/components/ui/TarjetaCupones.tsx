// src/components/ui/TarjetaCupones.tsx
//
// Aviso con los cupones disponibles del cliente. No muestra nada si no hay.
import { StyleSheet, View } from "react-native";
import { Text } from "./Texto";

import { Cupon, diasRestantes } from "../../services/cuponesService";
import TextoIcono from "./TextoIcono";
import { useEstilos, type Paleta } from "../../services/temaStore";

export default function TarjetaCupones({ cupones }: { cupones: Cupon[] }) {
  const styles = useEstilos(crearEstilos);
  if (!cupones.length) return null;

  return (
    <View style={styles.tarjeta}>
      <TextoIcono icono="gift-outline" style={styles.titulo}>
        {cupones.length === 1 ? "Tienes un cupón" : `Tienes ${cupones.length} cupones`}
      </TextoIcono>
      {cupones.slice(0, 3).map((c) => {
        const dias = diasRestantes(c.venceEl);
        return (
          <Text key={c.id} style={styles.fila}>
            <Text style={styles.destacado}>{c.porcentaje} %</Text> de descuento en{" "}
            {c.tipoServicio ? c.tipoServicio.toLowerCase() : "tu próximo pedido"} ·{" "}
            {dias <= 1 ? "vence hoy" : `vence en ${dias} días`}
          </Text>
        );
      })}
      <Text style={styles.nota}>
        Se aplica solo al solicitar el servicio (se usa el de mayor descuento).
      </Text>
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  tarjeta: {
    padding: 14,
    gap: 6,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.45)",
    backgroundColor: "rgba(52,211,153,0.10)",
  },
  titulo: { color: p.texto, fontSize: 15, fontWeight: "800" },
  fila: { color: p.textoDato, fontSize: 13, lineHeight: 19 },
  destacado: { color: p.textoExito, fontWeight: "900" },
  nota: { color: p.textoTenue, fontSize: 11, lineHeight: 16 },
});
