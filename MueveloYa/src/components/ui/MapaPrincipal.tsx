import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML_MAPA = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

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
      background: #111318;
    }

    body {
      touch-action: none;
    }

    .leaflet-container {
      background: #111318;
      font-family: Arial, sans-serif;
      touch-action: none;
    }

    .leaflet-control-attribution {
      background: rgba(3, 15, 31, 0.75) !important;
      color: #b5d9e8 !important;
      font-size: 9px !important;
    }

    .leaflet-control-attribution a {
      color: #00d4ff !important;
    }

    .leaflet-control-zoom a {
      background: #09213b !important;
      color: #00d4ff !important;
      border-color: #174666 !important;
    }
  </style>
</head>

<body>
  <div id="mapa"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    const mapa = L.map('mapa', {
      center: [6.2442, -75.5812],
      zoom: 13,
      zoomControl: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: false,
      keyboard: true,
      tap: true
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }
    ).addTo(mapa);

    L.control.zoom({
      position: 'bottomright'
    }).addTo(mapa);

    L.circleMarker([6.2442, -75.5812], {
      radius: 6,
      color: '#00D4FF',
      weight: 2,
      fillColor: '#00D4FF',
      fillOpacity: 1
    }).addTo(mapa);

    setTimeout(() => {
      mapa.invalidateSize();
    }, 300);
  </script>
</body>
</html>
`;

export default function MapaPrincipal() {
  return (
    <View style={styles.contenedor}>
      <WebView
        source={{ html: HTML_MAPA }}
        style={styles.mapa}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="compatibility"
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
    backgroundColor: '#111318',
   },

  mapa: {
    flex: 1,
    backgroundColor: '#111318',
  },
});
