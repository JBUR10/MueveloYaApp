import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import BuscadorDestino from "../components/ui/BuscadorDestino";
import MapaPrincipal, {
  Coordenadas,
  Destino,
  InfoRuta,
} from "../components/ui/MapaPrincipal";

const AZUL = "#2969e9";
const FONDO = "#111318";

/** Une calle, número y barrio en un texto corto: "Cra 43A 10-50, El Poblado". */
function armarDireccion(
  calle?: string | null,
  numero?: string | null,
  barrio?: string | null,
  ciudad?: string | null,
) {
  const via = [calle, numero].filter(Boolean).join(" ");
  const zona = barrio || ciudad;
  return [via, zona].filter(Boolean).join(", ");
}

/** Obtiene la dirección de unas coordenadas. Primero expo-location; si no hay resultado
 *  (por ejemplo en web), usa OpenStreetMap (Nominatim). */
async function obtenerDireccion({ lat, lng }: Coordenadas): Promise<string> {
  try {
    const [lugar] = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    if (lugar) {
      const texto = armarDireccion(
        lugar.street || lugar.name,
        lugar.streetNumber,
        lugar.district || lugar.subregion,
        lugar.city,
      );
      if (texto) return texto;
    }
  } catch {
    // Se intenta con el servicio alterno.
  }

  try {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
    );
    const datos = await respuesta.json();
    const a = datos?.address ?? {};

    return armarDireccion(
      a.road || a.pedestrian || a.footway,
      a.house_number,
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village,
    );
  } catch {
    return "";
  }
}

export default function HomeScreen() {
  const [nombreUbicacion, setNombreUbicacion] = useState("");
  const [destino, setDestino] = useState<Destino | null>(null);
  const [infoRuta, setInfoRuta] = useState<InfoRuta | null>(null);

  // Modo "ubicar punto manualmente"
  const [seleccionando, setSeleccionando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [direccionPunto, setDireccionPunto] = useState("");
  const centroRef = useRef<Coordenadas | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peticion = useRef(0);

  // Cuando el mapa obtiene la ubicación, busca la dirección y la muestra en el panel.
  const manejarUbicacion = async (coords: Coordenadas) => {
    console.log("Ubicación del cliente:", coords);

    // Aquí puedes enviar coords a tu backend, por ejemplo:
    // await fetch('https://tu-api.com/clientes/ubicacion', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(coords),
    // });

    const direccion = await obtenerDireccion(coords);
    if (direccion) setNombreUbicacion(direccion);
  };

  // Cada vez que el usuario suelta el mapa, se espera un momento y se busca la dirección.
  // El debounce evita saturar Nominatim (límite ~1 petición/segundo).
  const manejarCentro = (c: Coordenadas) => {
    centroRef.current = c;
    if (temporizador.current) clearTimeout(temporizador.current);

    temporizador.current = setTimeout(async () => {
      const id = ++peticion.current;
      const texto = await obtenerDireccion(c);
      if (id === peticion.current) setDireccionPunto(texto);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const iniciarSeleccion = () => {
    centroRef.current = null;
    setDireccionPunto("");
    setSeleccionando(true);
  };

  const cancelarSeleccion = () => {
    peticion.current++;
    if (temporizador.current) clearTimeout(temporizador.current);
    setSeleccionando(false);
  };

  const confirmarPunto = async () => {
    const c = centroRef.current;
    if (!c || confirmando) return;

    setConfirmando(true);
    peticion.current++; // descarta cualquier búsqueda pendiente
    if (temporizador.current) clearTimeout(temporizador.current);

    const nombre = (await obtenerDireccion(c)) || "Punto en el mapa";
    setDestino({ lat: c.lat, lng: c.lng, nombre });
    setSeleccionando(false);
    setConfirmando(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <View style={styles.contenedor}>
        <MapaPrincipal
          onUbicacion={manejarUbicacion}
          destino={destino}
          onRuta={setInfoRuta}
          seleccionando={seleccionando}
          onCentro={manejarCentro}
        />

        {/* Encabezado */}
        <View style={styles.encabezado}>
          <View style={styles.marca}>
            <View style={styles.logo}>
              <Image
                source={require("../../assets/images/icon.png")}
                style={styles.imagenLogo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.nombreApp}>
              Muévelo <Text style={styles.nombreAzul}>Ya</Text>
            </Text>
          </View>
        </View>

        {/* Panel de ubicación con cristal y fondo difuminado */}
        <View style={styles.ubicacion}>
          <BlurView
            intensity={18}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.fondoBlurUbicacion}
          />

          <View style={styles.sombraCristalUbicacion} />

          <LinearGradient
            colors={[
              "rgba(255,255,255,0.20)",
              "rgba(255,255,255,0.09)",
              "rgba(255,255,255,0.04)",
            ]}
            locations={[0, 0.45, 1]}
            style={styles.cristalUbicacion}>
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.28)",
                "rgba(255,255,255,0.06)",
                "rgba(255,255,255,0)",
              ]}
              locations={[0, 0.45, 1]}
              style={styles.reflejoSuperior}
            />

            <View style={styles.contenidoUbicacion}>
              <View style={styles.puntoUbicacionExterior}>
                <View style={styles.puntoUbicacion} />
              </View>

              <View style={styles.textoUbicacion}>
                <Text style={styles.etiquetaUbicacion}>TU UBICACIÓN</Text>

                <Text style={styles.nombreUbicacion} numberOfLines={2}>
                  {nombreUbicacion}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Buscador de destino: al elegir un resultado se traza la ruta en el mapa */}
        <BuscadorDestino
          destino={destino}
          info={infoRuta}
          oculto={seleccionando}
          onSeleccionar={setDestino}
          onUbicarManual={iniciarSeleccion}
          onLimpiar={() => {
            setDestino(null);
            setInfoRuta(null);
          }}
        />

        {/* Modo selección manual: panel de confirmar. Si no, barra de navegación. */}
        {seleccionando ? (
          <View style={styles.panelPunto}>
            <Text style={styles.tituloPunto}>
              Mueve el mapa para ubicar el punto exacto
            </Text>
            <Text style={styles.direccionPunto} numberOfLines={2}>
              {direccionPunto || "Buscando dirección…"}
            </Text>

            <View style={styles.botonesPunto}>
              <Pressable
                style={styles.botonCancelar}
                onPress={cancelarSeleccion}>
                <Text style={styles.textoCancelar}>Cancelar</Text>
              </Pressable>

              <Pressable style={styles.botonConfirmar} onPress={confirmarPunto}>
                {confirmando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.textoConfirmar}>Confirmar punto</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <BarraNavegacion />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FONDO,
  },

  contenedor: {
    flex: 1,
    backgroundColor: FONDO,
  },

  encabezado: {
    position: "absolute",
    top: 12,
    left: 20,
    right: 20,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  marca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#2969e9",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },

  imagenLogo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    resizeMode: "contain",
  },

  nombreApp: {
    color: "#eeecec",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },

  nombreAzul: {
    color: AZUL,
  },

  ubicacion: {
    position: "absolute",
    top: 66,
    left: 20,
    right: 20,
    zIndex: 2,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(17,19,24,0.30)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },

  fondoBlurUbicacion: {
    ...StyleSheet.absoluteFill,
    borderRadius: 19,
  },

  sombraCristalUbicacion: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(17,19,24,0.24)",
  },

  cristalUbicacion: {
    minHeight: 64,
    borderRadius: 19,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "rgba(17,19,24,0.08)",
  },

  reflejoSuperior: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 25,
  },

  contenidoUbicacion: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 11,
    zIndex: 1,
  },

  puntoUbicacionExterior: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.24)",
  },

  puntoUbicacion: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#72BFCB",
  },

  textoUbicacion: {
    flex: 1,
  },

  etiquetaUbicacion: {
    color: "#E7F0F4",
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  nombreUbicacion: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  panelPunto: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    zIndex: 4,
    padding: 16,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(17,19,24,0.94)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },

  tituloPunto: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  direccionPunto: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
    minHeight: 20,
  },

  botonesPunto: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  botonCancelar: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  textoCancelar: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  botonConfirmar: {
    flex: 2,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
  },

  textoConfirmar: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
});