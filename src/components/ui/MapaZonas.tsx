// src/components/ui/MapaZonas.tsx
//
// Mapa pequeño del panel de administrador con las zonas donde más pedidos se
// hacen: amarillo = demanda media, rojo = demanda alta. Usa Leaflet (igual que
// MapaPrincipal): iframe en web y WebView en móvil, sin librerías nuevas.
import { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import type { ZonaPedidos } from "../../services/estadisticasService";

export const COLOR_ZONA_MEDIA = "#facc15";
export const COLOR_ZONA_ALTA = "#ef4444";

/** Una zona es roja si llega al 50 % de la más pedida (y tiene 2 o más pedidos). */
export const umbralZonaAlta = (zonas: ZonaPedidos[]) => {
  const max = zonas.reduce((m, z) => Math.max(m, z.total), 0);
  return Math.max(2, Math.ceil(max * 0.5));
};

// Centro por defecto: Medellín.
const CENTRO = { lat: 6.2442, lng: -75.5812 };

const crearHTML = (zonas: ZonaPedidos[]) => {
  const umbral = umbralZonaAlta(zonas);
  const datos = zonas.map((z) => ({
    lat: z.lat,
    lng: z.lng,
    total: z.total,
    nombre: z.nombre ?? "",
    alta: z.total >= umbral,
  }));
  // "<" escapado para que ningún texto cierre la etiqueta <script>.
  const json = JSON.stringify(datos).replace(/</g, "\\u003c");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #mapa { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #111111; }
    .etiquetas-claras { filter: brightness(2.8) grayscale(1); }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #1c1c1c; color: #ffffff; }
    .leaflet-popup-content { font-size: 13px; }
    .leaflet-control-attribution { background: rgba(17,17,17,0.8) !important; color: #c7c7c7 !important; font-size: 9px !important; }
    .leaflet-control-attribution a { color: #8DB2FF !important; }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const ZONAS = ${json};
    const CENTRO = [${CENTRO.lat}, ${CENTRO.lng}];
    const mapa = L.map('mapa', { zoomControl: true, maxZoom: 17 }).setView(CENTRO, 12);

    L.tileLayer(
      'https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png?key=cb1_4ltt_1_cf9d541803ae070b75ff17f2',
      { maxZoom: 17, attribution: '&copy; OpenStreetMap &copy; CARTO' }
    ).addTo(mapa);
    L.tileLayer(
      'https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png?key=cb1_4ltt_1_cf9d541803ae070b75ff17f2',
      { maxZoom: 17, className: 'etiquetas-claras' }
    ).addTo(mapa);

    const grupo = L.featureGroup().addTo(mapa);
    ZONAS.forEach(function (z) {
      const color = z.alta ? '${COLOR_ZONA_ALTA}' : '${COLOR_ZONA_MEDIA}';
      const circulo = L.circle([z.lat, z.lng], {
        radius: 600,
        color: color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.45
      });
      // El popup se arma con nodos de texto: el nombre viene de lo que escribió el cliente.
      const cont = document.createElement('div');
      const t = document.createElement('b');
      t.textContent = z.nombre || 'Zona sin nombre';
      const n = document.createElement('div');
      n.textContent = z.total + (z.total === 1 ? ' pedido' : ' pedidos') + (z.alta ? ' · demanda alta' : ' · demanda media');
      cont.appendChild(t);
      cont.appendChild(n);
      circulo.bindPopup(cont);
      circulo.addTo(grupo);
    });

    if (ZONAS.length) {
      mapa.fitBounds(grupo.getBounds().pad(0.3), { maxZoom: 14 });
    }
  </script>
</body>
</html>`;
};

export default function MapaZonas({ zonas }: { zonas: ZonaPedidos[] }) {
  const html = useMemo(() => crearHTML(zonas), [zonas]);

  return (
    <View style={styles.contenedor}>
      {Platform.OS === "web" ? (
        <iframe
          title="Mapa de zonas con más pedidos"
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      ) : (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          nestedScrollEnabled
          style={styles.mapa}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    height: 300,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111111",
  },
  mapa: { flex: 1, backgroundColor: "#111111" },
});
