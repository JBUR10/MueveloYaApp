import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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

    body {
      background: #f2f5f8;
    }

    #mapa {
      position: absolute;
      inset: 0;
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
      background: rgba(255, 255, 255, 0.75) !important;
      color: #526170 !important;
      font-size: 9px !important;
      line-height: 1.4 !important;
      text-align: right !important;
      box-shadow: none !important;
    }

    .leaflet-control-attribution a {
      color: #1769aa !important;
      text-decoration: none !important;
    }


    /* Oculta los botones de zoom */
    .leaflet-control-zoom {
      display: none !important;
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
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_4ltt_1_cf9d541803ae070b75ff17f2',
      {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
      }
    ).addTo(mapa);

    // Atribución personalizada en la esquina superior derecha
    L.control.attribution({
      position: 'topright',
      prefix: false
    }).addTo(mapa);

    // Marcador de Medellín
    L.marker([6.2442, -75.5812])
      .addTo(mapa)
      .bindPopup('Medellín, Colombia');

    setTimeout(function () {
      mapa.invalidateSize();
    }, 250);
  </script>
</body>
</html>
`;

export default function MapaPrincipal() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.contenedor}>
        <iframe
          title="Mapa de Medellín"
          srcDoc={mapaHTML}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allowFullScreen
        />
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapaHTML }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={styles.mapa}
      />
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
  },
  mapa: {
    flex: 1,
    backgroundColor: '#f2f5f8',
  },
});
