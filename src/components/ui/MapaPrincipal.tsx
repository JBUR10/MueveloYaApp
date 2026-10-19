import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const mapaHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />

  <style>
    html, body, #mapa {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    body, #mapa {
      background: #111111;
    }

    #mapa {
      position: absolute;
      inset: 0;
    }

    .mapa-oscuro {
      filter: brightness(1);
    }

    .etiquetas-claras {
      filter: brightness(2.8) grayscale(1);
      opacity: 1;
    }

    .leaflet-control-attribution {
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      bottom: auto !important;
      left: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 3px 10px !important;
      border-radius: 0 !important;
      background: rgba(17, 17, 17, 0.8) !important;
      color: #c7c7c7 !important;
      font-size: 9px !important;
      line-height: 1.4 !important;
      text-align: right !important;
      box-shadow: none !important;
    }

    .leaflet-control-attribution a {
      color: #fa0000 !important;
      text-decoration: none !important;
    }

    .leaflet-control-zoom {
      display: none !important;
    }

    .leaflet-popup-content-wrapper,
    .leaflet-popup-tip {
      background: #1c1c1c;
      color: #ffffff;
    }

    .leaflet-popup-content {
      font-size: 13px;
    }

    .leaflet-container a.leaflet-popup-close-button {
      color: #ff0800;
    }

    .ubicacion-punto {
      width: 18px;
      height: 18px;
      background: #2997ff;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(41, 151, 255, 0.2);
    }

    /* Icono de destino: camión blanco en cuadrado rojo con punta. */
    .destino-pin svg,
    #pin-seleccion svg {
      display: block;
      width: 40px;
      height: 52px;
      filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.55));
    }

    /* Pin fijo en el centro del mapa para elegir un punto manualmente. La punta queda justo en el centro. */
    #pin-seleccion {
      display: none;
      position: fixed;
      left: 50%;
      top: 50%;
      width: 40px;
      height: 52px;
      margin-left: -20px;
      margin-top: -48px;
      pointer-events: none;
      z-index: 1200;
    }

    #pin-seleccion svg {
      transition: transform 0.15s ease;
    }

    #pin-seleccion.levantado svg {
      transform: translateY(-10px);
    }

    /* Pequeña sombra en el suelo, bajo la punta. */
    #pin-seleccion::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 48px;
      width: 10px;
      height: 4px;
      margin-left: -5px;
      margin-top: -2px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.45);
    }
  </style>
</head>

<body>
  <div id="mapa"></div>
  <div id="pin-seleccion"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    // Icono del destino (camión). Se usa en el marcador de la ruta y en el pin de selección.
    const ICONO_DESTINO =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 62">' +
      '<path d="M14 3H34A11 11 0 0 1 45 14V34A11 11 0 0 1 34 45H32L24 57L16 45H14A11 11 0 0 1 3 34V14A11 11 0 0 1 14 3Z" ' +
      'fill="#fa0000" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>' +
      '<g transform="translate(2.24 3.4) scale(0.085)" fill="#ffffff">' +
      '<rect x="65" y="150" width="245" height="152"/>' +
      '<path d="M325 172H388V200L412 245L447 262V322H325Z"/>' +
      '<rect x="65" y="303" width="382" height="20"/>' +
      '<polygon points="342,203 381,203 395,250 342,250" fill="#fa0000"/>' +
      '<circle cx="175" cy="335" r="38"/>' +
      '<circle cx="175" cy="335" r="29" fill="#fa0000"/>' +
      '<circle cx="175" cy="335" r="16"/>' +
      '<circle cx="378" cy="335" r="38"/>' +
      '<circle cx="378" cy="335" r="29" fill="#fa0000"/>' +
      '<circle cx="378" cy="335" r="16"/>' +
      '</g></svg>';

    const pinSeleccion = document.getElementById('pin-seleccion');
    pinSeleccion.innerHTML = ICONO_DESTINO;

    const mapa = L.map('mapa', {
      zoomControl: false,
      attributionControl: false,
      maxZoom: 18
    }).setView([6.2442, -75.5812], 13);

    L.tileLayer(
      'https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png?key=cb1_4ltt_1_cf9d541803ae070b75ff17f2',
      {
        maxZoom: 18,
        className: 'mapa-oscuro',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
      }
    ).addTo(mapa);

    L.tileLayer(
      'https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png?key=cb1_4ltt_1_cf9d541803ae070b75ff17f2',
      {
        maxZoom: 18,
        className: 'etiquetas-claras',
        opacity: 1,
        attribution: ''
      }
    ).addTo(mapa);

    L.control.attribution({
      position: 'topright',
      prefix: false
    }).addTo(mapa);

    let marcadorUbicacion = null;
    let marcadorDestino = null;
    let lineaBorde = null;
    let lineaRuta = null;

    // Muestra (o mueve) el punto azul del cliente y centra el mapa.
    window.mostrarUbicacion = function (lat, lng) {
      const posicion = [lat, lng];

      if (!marcadorUbicacion) {
        const icono = L.divIcon({
          className: '',
          html: '<div class="ubicacion-punto"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        marcadorUbicacion = L.marker(posicion, {
          icon: icono,
          title: 'Mi ubicación'
        }).addTo(mapa);

        marcadorUbicacion.bindPopup('Estás aquí');
      } else {
        marcadorUbicacion.setLatLng(posicion);
      }

      mapa.flyTo(posicion, 16, { duration: 1.2 });
    };

    function borrarRuta() {
      if (lineaBorde) { mapa.removeLayer(lineaBorde); lineaBorde = null; }
      if (lineaRuta) { mapa.removeLayer(lineaRuta); lineaRuta = null; }
      if (marcadorDestino) { mapa.removeLayer(marcadorDestino); marcadorDestino = null; }
    }

    // Dibuja la ruta (lista de [lat, lng]) y el marcador del destino.
    window.mostrarRuta = function (puntos, destino) {
      borrarRuta();

      lineaBorde = L.polyline(puntos, {
        color: '#ffffff',
        weight: 9,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapa);

      lineaRuta = L.polyline(puntos, {
        color: '#2969e9',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapa);

      // La punta del icono (x=20, y=48 dentro de 40x52) queda exactamente sobre el destino.
      const icono = L.divIcon({
        className: 'destino-pin',
        html: ICONO_DESTINO,
        iconSize: [40, 52],
        iconAnchor: [20, 48],
        popupAnchor: [0, -48]
      });

      marcadorDestino = L.marker([destino.lat, destino.lng], {
        icon: icono,
        title: destino.nombre
      }).addTo(mapa);

      // textContent evita insertar HTML proveniente del texto del destino.
      const contenido = document.createElement('div');
      contenido.textContent = destino.nombre;
      marcadorDestino.bindPopup(contenido);

      // Márgenes para que la ruta no quede detrás de los paneles superior e inferior.
      mapa.fitBounds(lineaRuta.getBounds(), {
        paddingTopLeft: [40, 230],
        paddingBottomRight: [40, 130]
      });
    };

    // Quita la ruta y vuelve a centrar en el cliente.
    window.quitarRuta = function () {
      borrarRuta();
      if (marcadorUbicacion) {
        mapa.flyTo(marcadorUbicacion.getLatLng(), 16, { duration: 1 });
      }
    };

    // Envía mensajes a React Native (móvil) o al padre (web).
    function emitir(d) {
      const s = JSON.stringify(d);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
      else window.parent.postMessage(s, '*');
    }

    let seleccionando = false;

    function emitirCentro() {
      const c = mapa.getCenter();
      emitir({ tipo: 'CENTRO', lat: c.lat, lng: c.lng });
    }

    // Mientras se arrastra el mapa, el pin se levanta un poco; al soltar, baja y se informa el centro.
    mapa.on('movestart', function () {
      if (seleccionando) pinSeleccion.classList.add('levantado');
    });

    mapa.on('moveend', function () {
      pinSeleccion.classList.remove('levantado');
      if (seleccionando) emitirCentro();
    });

    // Activa/desactiva el modo selección. Si llegan lat/lng, centra el mapa ahí.
    window.modoSeleccion = function (activo, lat, lng) {
      seleccionando = !!activo;
      pinSeleccion.style.display = seleccionando ? 'block' : 'none';
      if (!activo) return;

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        mapa.setView([lat, lng], Math.max(mapa.getZoom(), 17), { animate: false });
      }
      emitirCentro();
    };

    // Punto único de entrada de mensajes desde React Native (o desde el padre en web).
    window.recibir = function (d) {
      if (!d) return;

      if (d.tipo === 'UBICACION' && Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
        window.mostrarUbicacion(d.lat, d.lng);
      } else if (
        d.tipo === 'RUTA' &&
        Array.isArray(d.puntos) &&
        d.puntos.length > 1 &&
        d.destino
      ) {
        window.mostrarRuta(d.puntos, d.destino);
      } else if (d.tipo === 'LIMPIAR_RUTA') {
        window.quitarRuta();
      } else if (d.tipo === 'MODO_SELECCION') {
        window.modoSeleccion(d.activo, d.lat, d.lng);
      }
    };

    // Solo se usa en web: el componente padre envía los mensajes por postMessage al iframe.
    window.addEventListener('message', function (event) {
      try {
        const d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        window.recibir(d);
      } catch (_) {}
    });

    setTimeout(function () {
      mapa.invalidateSize();
    }, 400);
  </script>
</body>
</html>
`;

export type Coordenadas = { lat: number; lng: number };
export type Destino = { lat: number; lng: number; nombre: string };
export type InfoRuta = { distanciaKm: number; duracionMin: number };

type Props = {
  /** Se llama cuando se obtiene la ubicación del cliente. */
  onUbicacion?: (coords: Coordenadas) => void;
  /** Si hay destino, se traza la ruta desde la ubicación del cliente hasta él. */
  destino?: Destino | null;
  /** Devuelve distancia y duración de la ruta, o null si se quitó o falló. */
  onRuta?: (info: InfoRuta | null) => void;
  /** true = muestra el pin central para elegir un punto manualmente. */
  seleccionando?: boolean;
  /** Se llama cada vez que el usuario termina de mover el mapa en modo selección. */
  onCentro?: (coords: Coordenadas) => void;
};

export default function MapaPrincipal({
  onUbicacion,
  destino,
  onRuta,
  seleccionando = false,
  onCentro,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const habiaRuta = useRef(false);

  // Se guarda el callback en una ref para que cambiar su identidad no vuelva a pedir la ruta.
  const onRutaRef = useRef(onRuta);
  onRutaRef.current = onRuta;

  const onCentroRef = useRef(onCentro);
  onCentroRef.current = onCentro;

  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [mapaListo, setMapaListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState('');
  const [errorRuta, setErrorRuta] = useState('');

  // Envía un mensaje al mapa (iframe en web, WebView en móvil).
  const enviarAlMapa = useCallback((mensaje: object) => {
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify(mensaje),
        '*'
      );
    } else {
      webViewRef.current?.injectJavaScript(`
        window.recibir && window.recibir(${JSON.stringify(mensaje)});
        true;
      `);
    }
  }, []);

  // Procesa los mensajes que llegan desde el mapa.
  const procesarMensaje = useCallback((raw: any) => {
    try {
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (d?.tipo === 'CENTRO') {
        onCentroRef.current?.({ lat: d.lat, lng: d.lng });
      }
    } catch { }
  }, []);

  // Web: escucha los mensajes que el iframe envía al padre.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      procesarMensaje(e.data);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [procesarMensaje]);

  // 1) Obtener la ubicación del cliente (Android, iOS y web).
  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const permiso = await Location.requestForegroundPermissionsAsync();

        if (!permiso.granted) {
          if (activo) {
            setErrorUbicacion(
              'Activa el permiso de ubicación para mostrar tu posición.'
            );
          }
          return;
        }

        const posicion = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!activo) return;

        const nuevas = {
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        };

        setCoords(nuevas);
        setErrorUbicacion('');
        onUbicacion?.(nuevas);
      } catch {
        if (activo) {
          setErrorUbicacion(
            'No pudimos obtener tu ubicación. Comprueba el GPS e inténtalo de nuevo.'
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Enviar la ubicación al mapa cuando AMBAS cosas estén listas:
  //    las coordenadas y la página del mapa ya cargada.
  useEffect(() => {
    if (!coords || !mapaListo) return;
    enviarAlMapa({ tipo: 'UBICACION', lat: coords.lat, lng: coords.lng });
  }, [coords, mapaListo, enviarAlMapa]);

  // 3) Trazar (o quitar) la ruta cuando cambia el destino.
  useEffect(() => {
    if (!mapaListo) return;

    // Sin destino: limpiar la ruta si había una.
    if (!destino) {
      if (habiaRuta.current) {
        enviarAlMapa({ tipo: 'LIMPIAR_RUTA' });
        habiaRuta.current = false;
      }
      setErrorRuta('');
      setCalculandoRuta(false);
      onRutaRef.current?.(null);
      return;
    }

    // Aún se está obteniendo la ubicación: se espera a que termine.
    if (!coords) {
      if (!cargando) {
        setErrorRuta('Necesitamos tu ubicación para trazar la ruta.');
      }
      return;
    }

    let activo = true;
    setCalculandoRuta(true);
    setErrorRuta('');

    (async () => {
      try {
        const url =
          'https://router.project-osrm.org/route/v1/driving/' +
          `${coords.lng},${coords.lat};${destino.lng},${destino.lat}` +
          '?overview=full&geometries=geojson';

        const respuesta = await fetch(url);
        const datos = await respuesta.json();
        const ruta = datos?.routes?.[0];

        if (!ruta) throw new Error('Sin ruta');
        if (!activo) return;

        // OSRM devuelve [lng, lat]; Leaflet usa [lat, lng].
        const puntos = ruta.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        enviarAlMapa({ tipo: 'RUTA', puntos, destino });
        habiaRuta.current = true;

        onRutaRef.current?.({
          distanciaKm: ruta.distance / 1000,
          duracionMin: Math.max(1, Math.round(ruta.duration / 60)),
        });
      } catch {
        if (activo) {
          setErrorRuta(
            'No pudimos trazar la ruta. Revisa tu conexión e inténtalo de nuevo.'
          );
          onRutaRef.current?.(null);
        }
      } finally {
        if (activo) setCalculandoRuta(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [destino, coords, mapaListo, cargando, enviarAlMapa]);

  // 4) Activa/desactiva el modo selección en el mapa.
  //    Arranca en el destino actual si existe; si no, en la ubicación del cliente.
  const inicioRef = useRef<Coordenadas | null>(null);
  inicioRef.current = destino ?? coords;

  useEffect(() => {
    if (!mapaListo) return;
    const i = inicioRef.current;
    enviarAlMapa({
      tipo: 'MODO_SELECCION',
      activo: seleccionando,
      lat: i?.lat,
      lng: i?.lng,
    });
  }, [seleccionando, mapaListo, enviarAlMapa]);

  const mensajeError = errorUbicacion || errorRuta;

  return (
    <View style={styles.contenedor}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          title="Mapa de Muévelo Ya"
          srcDoc={mapaHTML}
          onLoad={() => setMapaListo(true)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapaHTML }}
          javaScriptEnabled
          domStorageEnabled
          onLoadEnd={() => setMapaListo(true)}
          onMessage={(e) => procesarMensaje(e.nativeEvent.data)}
          style={styles.mapa}
        />
      )}

      {(cargando || calculandoRuta) && (
        <View style={styles.estado}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}

      {!!mensajeError && (
        <View style={styles.aviso}>
          <Text style={styles.textoAviso}>{mensajeError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  mapa: {
    flex: 1,
    backgroundColor: '#111111',
  },
  estado: {
    position: 'absolute',
    top: 215,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(17,17,17,0.85)',
  },
  aviso: {
    position: 'absolute',
    top: 215,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(28,28,28,0.95)',
  },
  textoAviso: {
    color: '#ffffff',
    fontSize: 13,
  },
});