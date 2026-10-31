// src/components/ui/VistaPreviaRuta.tsx
//
// Mapa pequeño en Servicios con la ruta de recogida (A) a entrega (B).
// El cliente puede arrastrar los pines si quedaron mal ubicados.
// Si las direcciones se escribieron a mano, se ubican con Nominatim (gratis).
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { buscarLugares } from "./BuscadorDestino";
import MapaPrincipal, { Coordenadas, InfoRuta } from "./MapaPrincipal";

type Props = {
  origen: Coordenadas | null;
  destino: Coordenadas | null;
  textoOrigen: string;
  textoDestino: string;
  /** Se llama al ubicar un punto. arrastrado = el usuario movió el pin. */
  onPunto: (
    cual: "origen" | "destino",
    coords: Coordenadas,
    arrastrado: boolean,
  ) => void;
};

export default function VistaPreviaRuta({
  origen,
  destino,
  textoOrigen,
  textoDestino,
  onPunto,
}: Props) {
  const [ubicando, setUbicando] = useState(false);
  const [noEncontradas, setNoEncontradas] = useState<string[]>([]);
  const [info, setInfo] = useState<InfoRuta | null>(null);

  const listo = !!origen && !!destino;

  const origenRuta = useMemo(
    () => (origen ? { ...origen, etiqueta: "A" } : null),
    [origen],
  );
  const destinoRuta = useMemo(
    () => (destino ? { ...destino, nombre: textoDestino || "Entrega" } : null),
    [destino, textoDestino],
  );

  const ubicarDirecciones = async () => {
    setUbicando(true);
    const faltan: string[] = [];
    const pendientes: ["origen" | "destino", string][] = [];
    if (!origen) pendientes.push(["origen", textoOrigen]);
    if (!destino) pendientes.push(["destino", textoDestino]);

    for (const [cual, texto] of pendientes) {
      try {
        const [primero] = texto.trim() ? await buscarLugares(texto) : [];
        if (primero) onPunto(cual, { lat: primero.lat, lng: primero.lng }, false);
        else faltan.push(cual === "origen" ? "recogida" : "entrega");
      } catch {
        faltan.push(cual === "origen" ? "recogida" : "entrega");
      }
    }
    setNoEncontradas(faltan);
    setUbicando(false);
  };

  if (!listo) {
    const hayTexto = (!origen && textoOrigen.trim()) || (!destino && textoDestino.trim());
    return (
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>🗺️ Vista previa de la ruta</Text>
        <Text style={styles.texto}>
          Marca los dos puntos en el mapa o escribe las direcciones para ver la
          ruta y ajustar los pines.
        </Text>
        {!!hayTexto && (
          <Pressable
            onPress={ubicarDirecciones}
            disabled={ubicando}
            style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
          >
            {ubicando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.textoBoton}>Ubicar direcciones en el mapa</Text>
            )}
          </Pressable>
        )}
        {noEncontradas.length > 0 && (
          <Text style={styles.error}>
            No encontramos la dirección de {noEncontradas.join(" y ")}. Usa
            «Marcar en el mapa».
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.tarjeta}>
      <View style={styles.filaTitulo}>
        <Text style={styles.titulo}>🗺️ Vista previa de la ruta</Text>
        {info && (
          <Text style={styles.info}>
            {info.distanciaKm.toFixed(1)} km · {info.duracionMin} min
          </Text>
        )}
      </View>
      <Text style={styles.texto}>
        Si algún punto quedó mal ubicado, arrastra el pin <Text style={styles.a}>A</Text>{" "}
        (recogida) o el camión (entrega) hasta el lugar correcto.
      </Text>

      <View style={styles.mapa}>
        <MapaPrincipal
          origenRuta={origenRuta}
          destino={destinoRuta}
          onRuta={setInfo}
          pinesMovibles
          onMoverPunto={(cual, coords) => onPunto(cual, coords, true)}
          margenRuta={{ arriba: 40, abajo: 40 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#161b22",
    marginBottom: 16,
  },
  filaTitulo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titulo: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  info: { color: "#8DB2FF", fontSize: 12, fontWeight: "800" },
  texto: { color: "#9BA7BA", fontSize: 12, lineHeight: 17 },
  a: { color: "#10b981", fontWeight: "900" },
  mapa: {
    height: 280,
    borderRadius: 14,
    overflow: "hidden",
  },
  boton: {
    backgroundColor: "#2969e9",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  textoBoton: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  error: { color: "#fca5a5", fontSize: 12 },
  presionado: { opacity: 0.75 },
});
