import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Href, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "./Texto";

import { useAvisos } from "../../services/avisosStore";
import { useModo } from "../../services/modoStore";
import { navegarConProteccionTamanoFuente } from "../../services/proteccionTamanoFuente";
import Icono, { type NombreIcono } from "./Icono";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

type Pestaña = "Inicio" | "Servicios" | "Solicitudes" | "Perfil";

const PESTAÑAS = [
  { id: "Inicio", icono: "home-outline", iconoActivo: "home", ruta: "/" },
  {
    id: "Servicios",
    icono: "cube-outline",
    iconoActivo: "cube",
    ruta: "/servicios",
  },
  {
    id: "Solicitudes",
    icono: "list-outline",
    iconoActivo: "list",
    ruta: "/solicitudes",
  },
  {
    id: "Perfil",
    icono: "person-outline",
    iconoActivo: "person",
    ruta: "/perfil",
  },
] as const satisfies readonly {
  id: string;
  icono: NombreIcono;
  iconoActivo: NombreIcono;
  ruta: string;
}[];

const TOTAL = PESTAÑAS.length;

type DatosPestaña = (typeof PESTAÑAS)[number];

// En modo transportista, "Solicitudes" abre el panel del transportista.
const rutaSegunModo = (pestaña: DatosPestaña, transportista: boolean): string =>
  transportista && pestaña.id === "Solicitudes" ? "/transportista" : pestaña.ruta;

// Debe coincidir con paddingHorizontal de "elementosBarra".
const RELLENO_BARRA = 4;

// Movimiento horizontal mínimo para que el gesto de arrastre tome el control sobre el toque.
const UMBRAL_ARRASTRE = 8;

const limitar = (valor: number, min: number, max: number) =>
  Math.min(max, Math.max(min, valor));

export default function BarraNavegacion() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const router = useRouter();
  const rutaActual = usePathname();
  const transportista = useModo().modo === "transportista";

  // Punto rojo en "Solicitudes", como un mensaje no leído.
  const avisos = useAvisos();
  const pendientesPorVer =
    avisos.noLeidas +
    avisos.proximos +
    (transportista ? avisos.nuevasDisponibles : 0);

  const indiceActivo = Math.max(
    0,
    PESTAÑAS.findIndex(
      (pestaña) => rutaSegunModo(pestaña, transportista) === rutaActual,
    ),
  );

  // Pestaña que se ve resaltada (sigue al dedo mientras se arrastra).
  const [indiceVista, setIndiceVista] = useState(indiceActivo);
  const [anchoTab, setAnchoTab] = useState(0);
  // Cuenta las navegaciones que no ocurrieron, para volver a la pestaña actual.
  const [sinNavegar, setSinNavegar] = useState(0);

  // Posición del cristal en "unidades de pestaña" (0 = primera, 3 = última, admite decimales).
  const posicion = useRef(new Animated.Value(indiceActivo)).current;
  const escala = useRef(new Animated.Value(1)).current;

  // Referencias para que el gesto (creado una sola vez) nunca use valores desactualizados.
  const contenedorRef = useRef<View>(null);
  const anchoTabRef = useRef(0);
  const origenXRef = useRef(0);
  const indiceVistaRef = useRef(indiceActivo);
  const indiceActivoRef = useRef(indiceActivo);
  const arrastrandoRef = useRef(false);
  indiceActivoRef.current = indiceActivo;

  const navegarAIndice = (indice: number) => {
    if (indice < 0 || indice >= TOTAL) return;

    const ruta = rutaSegunModo(PESTAÑAS[indice], transportista);

    if (ruta !== rutaActual) {
      void navegarConProteccionTamanoFuente(() => router.push(ruta as Href)).then(
        (navego) => {
          if (!navego) setSinNavegar((veces) => veces + 1);
        },
      );
    }
  };

  const navegarRef = useRef(navegarAIndice);
  navegarRef.current = navegarAIndice;

  const animarA = (indice: number) => {
    Animated.spring(posicion, {
      toValue: indice,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  };

  const marcarVista = (indice: number) => {
    if (indice !== indiceVistaRef.current) {
      indiceVistaRef.current = indice;
      setIndiceVista(indice);
    }
  };

  // Si la ruta cambia desde fuera de la barra, el cristal se acomoda a la nueva pestaña.
  // También vuelve a la actual si la navegación no ocurre ("Seguir editando" o
  // fallo al guardar).
  useEffect(() => {
    if (arrastrandoRef.current) return;
    marcarVista(indiceActivo);
    animarA(indiceActivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceActivo, sinNavegar]);

  const alAjustarBarra = (evento: LayoutChangeEvent) => {
    const ancho = (evento.nativeEvent.layout.width - RELLENO_BARRA * 2) / TOTAL;

    anchoTabRef.current = ancho;
    setAnchoTab(ancho);

    contenedorRef.current?.measureInWindow((x) => {
      origenXRef.current = x;
    });
  };

  // Lleva el cristal hasta la posición del dedo (coordenada X de pantalla).
  const seguirDedo = (pantallaX: number) => {
    const ancho = anchoTabRef.current;
    if (!ancho) return;

    const local = pantallaX - origenXRef.current - RELLENO_BARRA;
    const fraccion = limitar(local / ancho - 0.5, 0, TOTAL - 1);

    posicion.setValue(fraccion);
    marcarVista(Math.round(fraccion));
  };

  const soltar = (cancelado: boolean) => {
    arrastrandoRef.current = false;

    Animated.spring(escala, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();

    // Si el sistema cancela el gesto, se vuelve a la pestaña actual.
    const destino = cancelado ? indiceActivoRef.current : indiceVistaRef.current;

    marcarVista(destino);
    animarA(destino);

    if (!cancelado && destino !== indiceActivoRef.current) {
      navegarRef.current(destino);
    }
  };

  // Arrastrar el dedo sobre la barra mueve el cristal; al soltar se abre la pestaña más cercana.
  const responderArrastre = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      // "Capture" permite quitarle el gesto a los botones cuando el dedo se desliza.
      onMoveShouldSetPanResponderCapture: (_, gesto) =>
        Math.abs(gesto.dx) > UMBRAL_ARRASTRE &&
        Math.abs(gesto.dx) > Math.abs(gesto.dy) * 1.2,

      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (_, gesto) => {
        arrastrandoRef.current = true;

        contenedorRef.current?.measureInWindow((x) => {
          origenXRef.current = x;
        });

        // El cristal crece un poco mientras se arrastra, como en iOS.
        Animated.spring(escala, {
          toValue: 1.12,
          useNativeDriver: true,
          friction: 6,
        }).start();

        seguirDedo(gesto.moveX);
      },

      onPanResponderMove: (_, gesto) => seguirDedo(gesto.moveX),

      onPanResponderRelease: () => soltar(false),

      onPanResponderTerminate: () => soltar(true),
    }),
  ).current;

  const manejarPestaña = (indice: number) => {
    marcarVista(indice);
    animarA(indice);
    navegarAIndice(indice);
  };

  const desplazamiento = useMemo(
    () =>
      posicion.interpolate({
        inputRange: [0, TOTAL - 1],
        outputRange: [RELLENO_BARRA, RELLENO_BARRA + (TOTAL - 1) * anchoTab],
        extrapolate: "clamp",
      }),
    [posicion, anchoTab],
  );

  return (
    <View
      role="navigation"
      aria-label="Navegación principal"
      accessibilityRole="none"
      style={styles.barraNavegacion}
    >
      <BlurView
        intensity={24}
        tint={p.blur}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.fondoBlurBarra}
      />

      <View style={styles.sombraCristalBarra} />

      <LinearGradient
        colors={[
          "rgba(255,255,255,0.18)",
          "rgba(235,242,248,0.08)",
          "rgba(215,226,238,0.04)",
        ]}
        locations={[0, 0.45, 1]}
        style={styles.cristalBarra}
      >
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.28)",
            "rgba(255,255,255,0.06)",
            "rgba(255,255,255,0)",
          ]}
          locations={[0, 0.5, 1]}
          style={styles.reflejoBarra}
        />

        <View style={styles.lineaLuzBarra} />

        <View
          ref={contenedorRef}
          onLayout={alAjustarBarra}
          style={styles.elementosBarra}
          {...responderArrastre.panHandlers}
        >
          {/* Cristal que se desliza entre pestañas y sigue al dedo */}
          {anchoTab > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.marcador,
                {
                  width: anchoTab,
                  transform: [{ translateX: desplazamiento }, { scale: escala }],
                },
              ]}
            >
              <View style={styles.cristalActivo}>
                <LinearGradient
                  colors={
                    p.esClaro
                      ? [
                          "rgba(41,105,233,0.20)",
                          "rgba(41,105,233,0.12)",
                          "rgba(41,105,233,0.06)",
                        ]
                      : [
                          "rgba(255,255,255,0.30)",
                          "rgba(255,255,255,0.11)",
                          "rgba(255,255,255,0.04)",
                        ]
                  }
                  style={StyleSheet.absoluteFill}
                />
              </View>

              <View
                style={[styles.indicadorActivo, { left: (anchoTab - 18) / 2 }]}
              />
            </Animated.View>
          )}

          {PESTAÑAS.map((pestaña, indice) => {
            const activa = indiceVista === indice;
            const tieneAvisos =
              pestaña.id === "Solicitudes" && pendientesPorVer > 0;
            const etiquetaAccesible = tieneAvisos
              ? `${pestaña.id}, ${pendientesPorVer} ${
                  pendientesPorVer === 1 ? "aviso sin ver" : "avisos sin ver"
                }`
              : pestaña.id;

            return (
              <Pressable
                key={pestaña.id}
                style={({ pressed }) => [
                  styles.elementoNavegacion,
                  pressed && styles.presionado,
                ]}
                onPress={() => manejarPestaña(indice)}
                accessibilityRole="link"
                accessibilityState={{ selected: activa }}
                accessibilityLabel={etiquetaAccesible}
                {...({
                  // Web: indica cuál es la sección actual.
                  "aria-current": activa ? "page" : undefined,
                  // react-native-web no activa con Enter un "link" sin href.
                  onKeyDown: (evento: KeyboardEvent) => {
                    if (evento.key !== "Enter" || evento.repeat) return;
                    evento.preventDefault();
                    manejarPestaña(indice);
                  },
                } as object)}
              >
                <View>
                  <Icono
                    nombre={activa ? pestaña.iconoActivo : pestaña.icono}
                    tamano={24}
                    color={activa ? p.texto : p.textoFuerte3}
                    style={styles.simboloNavegacion}
                  />

                  {tieneAvisos && (
                    <View
                      accessible={false}
                      style={styles.insignia}
                    >
                      <Text escalaCompacta style={styles.textoInsignia}>
                        {pendientesPorVer > 9 ? "9+" : pendientesPorVer}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  numberOfLines={2}
                  style={[
                    styles.textoNavegacion,
                    activa && styles.textoNavegacionActivo,
                  ]}
                >
                  {pestaña.id}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  barraNavegacion: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 8,
    zIndex: 5,
    height: 82,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: p.linea(0.25),
    backgroundColor: p.panel(0.36),
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  fondoBlurBarra: {
    ...StyleSheet.absoluteFill,
    borderRadius: 27,
  },

  sombraCristalBarra: {
    ...StyleSheet.absoluteFill,
    backgroundColor: p.panel(0.3),
  },

  cristalBarra: {
    flex: 1,
    borderRadius: 27,
    overflow: "hidden",
    backgroundColor: p.panel(0.08),
  },

  reflejoBarra: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 31,
  },

  lineaLuzBarra: {
    position: "absolute",
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  elementosBarra: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: RELLENO_BARRA,
    zIndex: 1,
  },

  // Contenedor animado del cristal: ocupa el alto de la barra y mide lo mismo que una pestaña.
  marcador: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },

  elementoNavegacion: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  cristalActivo: {
    position: "absolute",
    top: 7,
    bottom: 7,
    left: 4,
    right: 4,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: p.linea(0.24),
    overflow: "hidden",
  },

  simboloNavegacion: {
    textShadowColor: p.sombraTexto(0.45),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  textoNavegacion: {
    color: p.textoSuave2,
    fontSize: 10,
    fontWeight: "600",
    width: "100%",
    flexShrink: 1,
    textAlign: "center",
    textShadowColor: p.sombraTexto(0.45),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  textoNavegacionActivo: {
    color: p.texto,
    fontWeight: "800",
  },

  indicadorActivo: {
    position: "absolute",
    bottom: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: p.texto,
  },

  presionado: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  insignia: {
    position: "absolute",
    top: -4,
    right: -12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: p.rellenoError,
    borderWidth: 2,
    borderColor: p.bordeInsignia,
    alignItems: "center",
    justifyContent: "center",
  },

  textoInsignia: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11,
  },
});