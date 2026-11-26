// src/components/ui/SelectorFotos.tsx
// Cuadrícula de fotos de evidencia con botones para tomar o elegir fotos.
// La usan la queja del cliente (cámara o galería) y la recogida del
// transportista (solo cámara).
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";

import { elegirDeGaleria, tomarFoto } from "../../services/evidenciasService";
import { useEstilos, usePaleta, type Paleta } from "../../services/temaStore";
import { aviso } from "./AlertaPantalla";
import Icono from "./Icono";
import { Text } from "./Texto";

const AZUL = "#2969e9";

type Props = {
  fotos: string[];
  onChange: (fotos: string[]) => void;
  maximo: number;
  /** Si es false, solo se puede usar la cámara. */
  permitirGaleria?: boolean;
  deshabilitado?: boolean;
};

export default function SelectorFotos({
  fotos,
  onChange,
  maximo,
  permitirGaleria = true,
  deshabilitado = false,
}: Props) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const [abriendo, setAbriendo] = useState(false);
  const lleno = fotos.length >= maximo;

  const agregar = async (origen: "camara" | "galeria") => {
    if (lleno || abriendo || deshabilitado) return;
    setAbriendo(true);
    try {
      const nuevas =
        origen === "camara"
          ? [await tomarFoto()].filter((u): u is string => !!u)
          : await elegirDeGaleria(maximo - fotos.length);
      if (nuevas.length) onChange([...fotos, ...nuevas].slice(0, maximo));
    } catch (e: any) {
      await aviso("Fotos", e?.message || "No se pudo abrir la cámara.", "error");
    } finally {
      setAbriendo(false);
    }
  };

  const quitar = (uri: string) => onChange(fotos.filter((f) => f !== uri));

  return (
    <View style={styles.contenedor}>
      {fotos.length > 0 && (
        <View style={styles.cuadricula}>
          {fotos.map((uri) => (
            <View key={uri} style={styles.miniatura}>
              <Image source={{ uri }} style={styles.imagen} />
              {!deshabilitado && (
                <Pressable
                  onPress={() => quitar(uri)}
                  style={styles.quitar}
                  accessibilityLabel="Quitar foto"
                  hitSlop={8}
                >
                  <Icono nombre="close" tamano={14} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.botones}>
        <Pressable
          onPress={() => agregar("camara")}
          disabled={lleno || abriendo || deshabilitado}
          style={[styles.boton, (lleno || deshabilitado) && styles.botonInactivo]}
          accessibilityRole="button"
        >
          {abriendo ? (
            <ActivityIndicator size="small" color={AZUL} />
          ) : (
            <Icono nombre="camera-outline" tamano={18} color={AZUL} />
          )}
          <Text style={styles.botonTexto}>Tomar foto</Text>
        </Pressable>
        {permitirGaleria && (
          <Pressable
            onPress={() => agregar("galeria")}
            disabled={lleno || abriendo || deshabilitado}
            style={[styles.boton, (lleno || deshabilitado) && styles.botonInactivo]}
            accessibilityRole="button"
          >
            <Icono nombre="images-outline" tamano={18} color={AZUL} />
            <Text style={styles.botonTexto}>Galería</Text>
          </Pressable>
        )}
      </View>
      <Text style={[styles.contador, { color: p.textoTenue }]}>
        {fotos.length} de {maximo} fotos
      </Text>
    </View>
  );
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    contenedor: { gap: 10 },
    cuadricula: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    miniatura: {
      width: 84,
      height: 84,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: p.velo(0.1),
    },
    imagen: { width: "100%", height: "100%" },
    quitar: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    botones: { flexDirection: "row", gap: 10 },
    boton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: AZUL,
      backgroundColor: p.velo(0.04),
    },
    botonInactivo: { opacity: 0.4 },
    botonTexto: { color: AZUL, fontWeight: "700", fontSize: 14 },
    contador: { fontSize: 12 },
  });
