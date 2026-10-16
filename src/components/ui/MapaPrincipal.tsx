
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

    // Recibe coordenadas desde React Native o desde el navegador.
    function mostrarUbicacion(lat, lng) {
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
    }

    // Permite recibir la ubicación del componente nativo.
    window.addEventListener('message', function(event) {
      try {
        const datos = JSON.parse(event.data);
        if (
          datos.tipo === 'UBICACION' &&
          Number.isFinite(datos.lat) &&
          Number.isFinite(datos.lng)
        ) {
          mostrarUbicacion(datos.lat, datos.lng);
        }
      } catch (_) {}
    });

    // Compatibilidad adicional con mensajes de WebView en Android.
    document.addEventListener('message', function(event) {
      try {
        const datos = JSON.parse(event.data);
        if (
          datos.tipo === 'UBICACION' &&
          Number.isFinite(datos.lat) &&
          Number.isFinite(datos.lng)
        ) {
          mostrarUbicacion(datos.lat, datos.lng);
        }
      } catch (_) {}
    });

    // En navegador web, solicita la ubicación al navegador.
    if (window.location.protocol !== 'about:' &&
        navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(posicion) {
          mostrarUbicacion(
            posicion.coords.latitude,
            posicion.coords.longitude
          );
        },
        function() {
          // Si no hay permiso, conserva Medellín como vista inicial.
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }

    setTimeout(function() {
      mapa.invalidateSize();
    }, 400);
  </script>
</body>
</html>
`;

export default function MapaPrincipal() {
  const webViewRef = useRef<WebView>(null);
  const [cargando, setCargando] = useState(true);
  const [errorUbicacion, setErrorUbicacion] = useState('');

  useEffect(() => {
    let activo = true;

    async function obtenerUbicacion() {
      try {
        if (Platform.OS === 'web') {
          setCargando(false);
          return;
        }

        const permiso =
          await Location.requestForegroundPermissionsAsync();

        if (!permiso.granted) {
          if (activo) {
            setErrorUbicacion(
              'Activa el permiso de ubicación para mostrar tu posición.'
            );
            setCargando(false);
          }
          return;
        }

        const posicion = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!activo) return;

        const mensaje = JSON.stringify({
          tipo: 'UBICACION',
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });

        webViewRef.current?.postMessage(mensaje);
        setErrorUbicacion('');
        setCargando(false);
      } catch {
        if (activo) {
          setErrorUbicacion(
            'No pudimos obtener tu ubicación. Comprueba el GPS e inténtalo de nuevo.'
          );
          setCargando(false);
        }
      }
    }

    obtenerUbicacion();

    return () => {
      activo = false;
    };
  }, []);

  const enviarUbicacionWeb = `
    (function() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              tipo: 'UBICACION',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            })
          }));
        });
      }
    })();
    true;
  `;

  return (
    <View style={styles.contenedor}>
      {Platform.OS === 'web' ? (
        <iframe
          title="Mapa de Muévelo Ya"
          srcDoc={mapaHTML}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="geolocation; fullscreen"
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapaHTML }}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          onLoadEnd={() => {
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(enviarUbicacionWeb);
            }, 300);
          }}
          style={styles.mapa}
        />
      )}

      {cargando && Platform.OS !== 'web' && (
        <View style={styles.estado}>
          <ActivityIndicator color="#facc00" />
          <Text style={styles.textoEstado}>
            Obteniendo tu ubicación...
          </Text>
        </View>
      )}

      {!!errorUbicacion && Platform.OS !== 'web' && (
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
    top: 55,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(17,17,17,0.92)',
  },
  textoEstado: {
    color: '#ffffff',
    fontSize: 13,
  },
  aviso: {
    position: 'absolute',
    top: 55,
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
