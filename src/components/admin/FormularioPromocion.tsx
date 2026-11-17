// src/components/admin/FormularioPromocion.tsx
//
// Formulario para enviar una promoción: elige a quién, el servicio, el
// descuento y la vigencia. Antes de enviar muestra a cuántos clientes les
// llegará y pide una confirmación (el envío no se puede deshacer).
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../ui/Texto";

import {
  contarAudiencia,
  crearCampana,
  MotivoPromocion,
  MOTIVOS,
} from "../../services/promocionesService";
import Icono from "../ui/Icono";

const AZUL = "#2969e9";
const TIPOS = ["Envío", "Acarreo", "Trasteo", "Mudanza"];
const DESCUENTOS = [10, 15, 20, 30];
const VIGENCIAS = [7, 14, 30];

const QUIEN: Record<MotivoPromocion, (tipo: string | null) => string> = {
  primera_vez: (t) =>
    `Clientes que nunca han pedido ${t ? t.toLowerCase() : "ese servicio"}`,
  segundo_pedido: () => "Clientes que solo han hecho un pedido",
  reactivacion: () => "Clientes que no piden hace más de 30 días",
  todos: () => "Todos los clientes",
};

interface Props {
  motivoInicial: MotivoPromocion;
  tipoInicial: string | null;
  onCerrar: () => void;
  /** Se llama al enviar, para refrescar los resultados. */
  onEnviada: () => void;
}

function Chips<T extends string | number | null>({
  opciones,
  valor,
  onElegir,
}: {
  opciones: { valor: T; titulo: string }[];
  valor: T;
  onElegir: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.titulo}
            onPress={() => onElegir(o.valor)}
            style={[styles.chip, activo && styles.chipActivo]}
          >
            <Text style={[styles.chipTexto, activo && { color: "#FFF" }]}>
              {o.titulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FormularioPromocion({
  motivoInicial,
  tipoInicial,
  onCerrar,
  onEnviada,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoPromocion>(motivoInicial);
  const [tipo, setTipo] = useState<string | null>(tipoInicial);
  const [porcentaje, setPorcentaje] = useState(15);
  const [dias, setDias] = useState(14);
  const [audiencia, setAudiencia] = useState<number | null>(null);
  const [fase, setFase] = useState<
    "editar" | "confirmar" | "enviando" | "listo"
  >("editar");
  const [error, setError] = useState("");
  const [enviados, setEnviados] = useState(0);

  const tipoValido = motivo !== "primera_vez" || tipo != null;

  // Cuántos clientes cumplen. Si el administrador cambia algo, vuelve a editar.
  useEffect(() => {
    setFase((f) => (f === "confirmar" ? "editar" : f));
    if (!tipoValido) {
      setAudiencia(null);
      return;
    }
    let vigente = true;
    setAudiencia(null);
    setError("");
    contarAudiencia(motivo, tipo)
      .then((n) => vigente && setAudiencia(n))
      .catch(
        (e) =>
          vigente && setError(e?.message || "No se pudo calcular el público."),
      );
    return () => {
      vigente = false;
    };
  }, [motivo, tipo, tipoValido]);

  useEffect(() => {
    setFase((f) => (f === "confirmar" ? "editar" : f));
  }, [porcentaje, dias]);

  const elegirMotivo = (m: MotivoPromocion) => {
    setMotivo(m);
    if (m === "primera_vez" && tipo == null) setTipo(TIPOS[0]);
  };

  const enviar = async () => {
    setFase("enviando");
    setError("");
    try {
      const r = await crearCampana({ motivo, tipo, porcentaje, dias });
      setEnviados(r.destinatarios);
      setFase("listo");
      onEnviada();
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar la promoción.");
      setFase("editar");
    }
  };

  if (fase === "listo") {
    return (
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Promoción enviada</Text>
        <Text style={styles.texto}>
          {enviados === 1
            ? "1 cliente recibió su cupón"
            : `${enviados} clientes recibieron su cupón`}{" "}
          de {porcentaje} % y una notificación. Mira cómo le va en «Resultados
          de promociones».
        </Text>
        <Pressable
          onPress={onCerrar}
          style={[styles.boton, styles.botonSecundario]}
        >
          <Text style={styles.botonTexto}>Cerrar</Text>
        </Pressable>
      </View>
    );
  }

  const bloqueado = fase === "enviando";
  const sinPublico = audiencia === 0;

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Enviar promoción</Text>
        <Pressable
          onPress={onCerrar}
          disabled={bloqueado}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.cerrar}
        >
          <Icono nombre="close" tamano={22} color="#9BA7BA" />
        </Pressable>
      </View>

      <Text style={styles.etiqueta}>¿A quién?</Text>
      <Chips
        opciones={MOTIVOS.map((m) => ({ valor: m.id, titulo: m.titulo }))}
        valor={motivo}
        onElegir={elegirMotivo}
      />

      <Text style={styles.etiqueta}>Servicio</Text>
      <Chips<string | null>
        opciones={[
          ...(motivo === "primera_vez"
            ? []
            : [{ valor: null, titulo: "Cualquiera" }]),
          ...TIPOS.map((t) => ({ valor: t, titulo: t })),
        ]}
        valor={tipo}
        onElegir={setTipo}
      />

      <Text style={styles.etiqueta}>Descuento</Text>
      <Chips
        opciones={DESCUENTOS.map((d) => ({ valor: d, titulo: `${d} %` }))}
        valor={porcentaje}
        onElegir={setPorcentaje}
      />

      <Text style={styles.etiqueta}>Vigencia</Text>
      <Chips
        opciones={VIGENCIAS.map((d) => ({ valor: d, titulo: `${d} días` }))}
        valor={dias}
        onElegir={setDias}
      />

      <View style={styles.resumen}>
        <Text style={styles.texto}>{QUIEN[motivo](tipo)}.</Text>
        {audiencia == null && tipoValido && !error ? (
          <ActivityIndicator color={AZUL} style={{ alignSelf: "flex-start" }} />
        ) : audiencia != null ? (
          <Text style={styles.audiencia}>
            {sinPublico
              ? "Ahora mismo no hay clientes que cumplan (o ya recibieron un cupón en los últimos 7 días)."
              : `Les llegará a ${audiencia} ${audiencia === 1 ? "cliente" : "clientes"}.`}
          </Text>
        ) : null}
        <Text style={styles.nota}>
          Cada cliente recibe un cupón y una notificación push. No se envía a
          quien ya recibió una promoción en los últimos 7 días.
        </Text>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {fase === "confirmar" ? (
        <View style={styles.fila}>
          <Pressable
            onPress={() => setFase("editar")}
            style={[styles.boton, styles.botonSecundario]}
          >
            <Text style={styles.botonTexto}>Volver</Text>
          </Pressable>
          <Pressable onPress={enviar} style={[styles.boton, { flex: 1 }]}>
            <Text style={styles.botonTexto}>
              Confirmar: enviar a {audiencia}{" "}
              {audiencia === 1 ? "cliente" : "clientes"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setFase("confirmar")}
          disabled={bloqueado || !tipoValido || !audiencia}
          style={[
            styles.boton,
            (bloqueado || !tipoValido || !audiencia) && { opacity: 0.4 },
          ]}
        >
          {bloqueado ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.botonTexto}>Revisar y enviar</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(41,105,233,0.6)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titulo: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  cerrar: { paddingHorizontal: 6 },
  etiqueta: { color: "#9BA7BA", fontSize: 12, fontWeight: "700", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActivo: { backgroundColor: AZUL, borderColor: AZUL },
  chipTexto: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "700",
  },
  resumen: { gap: 6, marginTop: 4 },
  texto: { color: "#D5DCE8", fontSize: 13, lineHeight: 19 },
  audiencia: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  nota: { color: "#9BA7BA", fontSize: 11, lineHeight: 16 },
  error: { color: "#f87171", fontSize: 13 },
  fila: { flexDirection: "row", gap: 10 },
  boton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: AZUL,
  },
  botonSecundario: { backgroundColor: "rgba(255,255,255,0.1)" },
  botonTexto: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
