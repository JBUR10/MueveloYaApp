import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
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
      color: #facc00 !important;
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
      color: #facc00;
    }

    .ubicacion-punto {
      width: 18px;
      height: 18px;
      background: #2997ff;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(41, 151, 255, 0.2);
    }
  </style>
</head>

<body>
  <div id="mapa"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
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

    // Solo se usa en web: el componente padre envía la ubicación por postMessage al iframe.
    window.addEventListener('message', function (event) {
      try {
        const d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (
          d &&
          d.tipo === 'UBICACION' &&
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lng)
        ) {
          window.mostrarUbicacion(d.lat, d.lng);
        }
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

type Props = {
  /** Se llama cuando se obtiene la ubicación del cliente. */
  onUbicacion?: (coords: Coordenadas) => void;
};

export default function MapaPrincipal({ onUbicacion }: Props) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [mapaListo, setMapaListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorUbicacion, setErrorUbicacion] = useState('');

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

    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ tipo: 'UBICACION', lat: coords.lat, lng: coords.lng }),
        '*'
      );
    } else {
      webViewRef.current?.injectJavaScript(`
        if (window.mostrarUbicacion) {
          window.mostrarUbicacion(${coords.lat}, ${coords.lng});
        }
        true;
      `);
    }
  }, [coords, mapaListo]);

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
          style={styles.mapa}
        />
      )}

      {cargando && (
        <View style={styles.estado}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}

      {!!errorUbicacion && (
        <View style={styles.aviso}>
          <Text style={styles.textoAviso}>{errorUbicacion}</Text>
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
    top: 140,
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
    top: 140,
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