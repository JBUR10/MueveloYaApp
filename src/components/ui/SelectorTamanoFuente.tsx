import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import {
  NIVELES_TAMANO_FUENTE,
  type NivelTamanoFuente,
} from "../../services/tamanoFuenteStore";
import { useEstilos, type Paleta } from "../../services/temaStore";
import { Text } from "./Texto";

const AZUL = "#2969E9";
const MARGEN_SEGMENTOS = 16;
const TAMANO_BOLITA = 24;
const TAMANO_AREA_BOLITA = 44;

type Props = {
  seleccionado: NivelTamanoFuente;
  deshabilitado?: boolean;
  onSeleccion: (nivel: NivelTamanoFuente) => void;
};

export default function SelectorTamanoFuente({
  seleccionado,
  deshabilitado = false,
  onSeleccion,
}: Props) {
  const styles = useEstilos(crearEstilos);
  const indiceInicial = Math.max(
    0,
    NIVELES_TAMANO_FUENTE.findIndex((nivel) => nivel.id === seleccionado),
  );
  const [ancho, setAncho] = useState(0);
  const [posicion] = useState(() => new Animated.Value(indiceInicial));

  const anchoSegmentos = ancho > 0
    ? (ancho - MARGEN_SEGMENTOS * 2) / NIVELES_TAMANO_FUENTE.length
    : 0;

  const posicionesBolita = useMemo(() => {
    if (anchoSegmentos <= 0) {
      return [
        MARGEN_SEGMENTOS,
        MARGEN_SEGMENTOS,
        MARGEN_SEGMENTOS,
      ];
    }

    return NIVELES_TAMANO_FUENTE.map((_, indice) =>
      MARGEN_SEGMENTOS +
      anchoSegmentos * indice +
      anchoSegmentos / 2 -
      TAMANO_AREA_BOLITA / 2,
    );
  }, [anchoSegmentos]);

  const desplazamiento = useMemo(
    () =>
      posicion.interpolate({
        inputRange: [0, 1, 2],
        outputRange: posicionesBolita,
        extrapolate: "clamp",
      }),
    [posicion, posicionesBolita],
  );

  useEffect(() => {
    const indice = NIVELES_TAMANO_FUENTE.findIndex(
      (nivel) => nivel.id === seleccionado,
    );
    if (indice >= 0) {
      Animated.timing(posicion, {
        toValue: indice,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [posicion, seleccionado]);

  const alMedir = (evento: LayoutChangeEvent) => {
    setAncho(evento.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={alMedir}
      accessibilityRole="radiogroup"
      accessibilityLabel="Tamaño de fuente"
      style={[
        styles.control,
        deshabilitado && styles.controlDeshabilitado,
      ]}
    >
      <View style={styles.segmentos}>
        {NIVELES_TAMANO_FUENTE.map((nivel) => {
          const activo = seleccionado === nivel.id;
          return (
            <Pressable
              key={nivel.id}
              disabled={deshabilitado}
              onPress={() => onSeleccion(nivel.id)}
              accessibilityRole="radio"
              accessibilityState={{
                checked: activo,
                disabled: deshabilitado,
              }}
              accessibilityLabel={`${nivel.nombre}, ${nivel.porcentaje} por ciento`}
              accessibilityHint="Selecciona este tamaño de fuente."
              style={({ pressed }) => [
                styles.segmento,
                activo && styles.segmentoActivo,
                pressed && styles.segmentoPresionado,
              ]}
            >
              <Text
                style={[
                  styles.nombre,
                  activo && styles.nombreActivo,
                ]}
              >
                {nivel.nombre}
              </Text>
              <Text
                style={[
                  styles.porcentaje,
                  activo && styles.porcentajeActivo,
                ]}
              >
                {nivel.porcentaje} %
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.guia} pointerEvents="none" />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.areaBolita,
          {
            transform: [{ translateX: desplazamiento }],
          },
        ]}
      >
        <View style={styles.bolita} />
      </Animated.View>
    </View>
  );
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    control: {
      width: "100%",
      height: 76,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.linea(0.14),
      backgroundColor: p.velo(0.035),
      paddingHorizontal: MARGEN_SEGMENTOS,
      overflow: "visible",
    },
    controlDeshabilitado: {
      opacity: 0.55,
    },
    segmentos: {
      flexDirection: "row",
      height: 50,
    },
    segmento: {
      flex: 1,
      minWidth: 0,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 8,
      borderRadius: 12,
    },
    segmentoActivo: {
      backgroundColor: p.esClaro
        ? "rgba(41,105,233,0.09)"
        : "rgba(141,178,255,0.08)",
    },
    segmentoPresionado: {
      opacity: 0.82,
    },
    nombre: {
      color: p.textoFuerte2,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
    },
    nombreActivo: {
      color: p.acento,
    },
    porcentaje: {
      color: p.textoTenue,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },
    porcentajeActivo: {
      color: p.acento,
    },
    guia: {
      position: "absolute",
      left: MARGEN_SEGMENTOS,
      right: MARGEN_SEGMENTOS,
      bottom: 17,
      height: 3,
      borderRadius: 2,
      backgroundColor: p.linea(0.18),
    },
    areaBolita: {
      position: "absolute",
      left: 0,
      bottom: -4,
      width: TAMANO_AREA_BOLITA,
      height: TAMANO_AREA_BOLITA,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3,
    },
    bolita: {
      width: TAMANO_BOLITA,
      height: TAMANO_BOLITA,
      borderRadius: TAMANO_BOLITA / 2,
      backgroundColor: AZUL,
      borderWidth: 3,
      borderColor: p.esClaro ? "#FFFFFF" : p.superficie,
      shadowColor: "#2969E9",
      shadowOpacity: p.esClaro ? 0.24 : 0.38,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
  });
