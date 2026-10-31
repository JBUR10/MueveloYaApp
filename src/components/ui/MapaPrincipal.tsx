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

    /* Pines de solicitudes (modo transportista). */
    .pin-solicitud {
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: #2969e9;
      border: 3px solid #ffffff;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease, background 0.15s ease;
    }

    .pin-solicitud span {
      transform: rotate(45deg);
      color: #ffffff;
      font: 800 13px/1 -apple-system, Roboto, sans-serif;
    }

    .pin-solicitud.inmediato { background: #f59e0b; }

    .pin-solicitud.seleccionado {
      background: #fa0000;
      transform: rotate(-45deg) scale(1.25);
    }

    /* Punto de inicio de la ruta (recogida). */
    .punto-origen {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #10b981;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
      color: #ffffff;
      font: 800 12px/20px -apple-system, Roboto, sans-serif;
      text-align: center;
    }

    /* Camión que recorre la ruta (vista previa). */
    .camion {
      font-size: 26px;
      line-height: 30px;
      text-align: center;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
    }

    .camion.derecha { transform: scaleX(-1); }

    /* Pista visual de que el pin se puede arrastrar. */
    .leaflet-marker-draggable { cursor: grab; }

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
    let marcadorOrigen = null;
    let lineaBorde = null;
    let lineaRuta = null;
    let hayRuta = false;
    let marcadorCamion = null;
    let animacion = null;
    let marcadoresEncuadrados = false;
    const capaSolicitudes = L.layerGroup().addTo(mapa);

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

      // Con una ruta en pantalla no se mueve la cámara.
      if (!hayRuta) mapa.flyTo(posicion, 16, { duration: 1.2 });
    };

    function borrarRuta() {
      if (lineaBorde) { mapa.removeLayer(lineaBorde); lineaBorde = null; }
      if (lineaRuta) { mapa.removeLayer(lineaRuta); lineaRuta = null; }
      if (marcadorDestino) { mapa.removeLayer(marcadorDestino); marcadorDestino = null; }
      if (marcadorOrigen) { mapa.removeLayer(marcadorOrigen); marcadorOrigen = null; }
      detenerCamion();
      hayRuta = false;
    }

    function detenerCamion() {
      if (animacion) { cancelAnimationFrame(animacion); animacion = null; }
      if (marcadorCamion) { mapa.removeLayer(marcadorCamion); marcadorCamion = null; }
    }

    // El camión recorre la ruta de inicio a fin, hace una pausa y repite.
    function animarCamion(puntos) {
      detenerCamion();
      const latlngs = puntos.map(function (p) { return L.latLng(p[0], p[1]); });
      const acumulado = [0];
      for (let i = 1; i < latlngs.length; i++) {
        acumulado.push(acumulado[i - 1] + mapa.distance(latlngs[i - 1], latlngs[i]));
      }
      const total = acumulado[acumulado.length - 1];
      if (!total) return;

      const icono = document.createElement('div');
      icono.className = 'camion';
      icono.textContent = '🚚';
      marcadorCamion = L.marker(latlngs[0], {
        icon: L.divIcon({ className: '', html: icono, iconSize: [30, 30], iconAnchor: [15, 22] }),
        interactive: false,
        zIndexOffset: 2000
      }).addTo(mapa);

      // Entre 4 y 8 segundos según el largo de la ruta.
      const duracion = Math.min(8000, Math.max(4000, total / 3));
      const pausa = 1200;
      let inicio = null;
      let tramo = 1;

      function paso(t) {
        if (inicio === null) inicio = t;
        const transcurrido = (t - inicio) % (duracion + pausa);
        const avance = Math.min(1, transcurrido / duracion) * total;

        if (avance < acumulado[tramo - 1]) tramo = 1;
        while (tramo < acumulado.length - 1 && acumulado[tramo] < avance) tramo++;

        const a = latlngs[tramo - 1];
        const b = latlngs[tramo];
        const largo = acumulado[tramo] - acumulado[tramo - 1] || 1;
        const f = Math.max(0, Math.min(1, (avance - acumulado[tramo - 1]) / largo));
        marcadorCamion.setLatLng([a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f]);
        // El emoji mira a la izquierda: se voltea cuando avanza hacia el este.
        icono.classList.toggle('derecha', b.lng > a.lng);

        animacion = requestAnimationFrame(paso);
      }
      animacion = requestAnimationFrame(paso);
    }

    // Pin arrastrable: al soltarlo avisa a React con la nueva posición.
    function hacerMovible(marcador, cual) {
      marcador.dragging.enable();
      marcador.on('dragstart', detenerCamion);
      marcador.on('dragend', function () {
        const p = marcador.getLatLng();
        emitir({ tipo: 'PUNTO_MOVIDO', cual: cual, lat: p.lat, lng: p.lng });
      });
    }

    // Dibuja la ruta (lista de [lat, lng]) y el marcador del destino.
    // Si llega "origen", además se marca el punto de partida (no es el GPS).
    window.mostrarRuta = function (puntos, destino, origen, margen, opciones) {
      const o = opciones || {};
      borrarRuta();
      hayRuta = true;

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
        title: destino.nombre,
        draggable: !!o.movibles
      }).addTo(mapa);
      if (o.movibles) hacerMovible(marcadorDestino, 'destino');

      // textContent evita insertar HTML proveniente del texto del destino.
      const contenido = document.createElement('div');
      contenido.textContent = destino.nombre;
      marcadorDestino.bindPopup(contenido);

      if (origen) {
        const etiqueta = document.createElement('div');
        etiqueta.className = 'punto-origen';
        etiqueta.textContent = origen.etiqueta || 'A';
        marcadorOrigen = L.marker([origen.lat, origen.lng], {
          icon: L.divIcon({ className: '', html: etiqueta, iconSize: [26, 26], iconAnchor: [13, 13] }),
          draggable: !!o.movibles,
          zIndexOffset: 500
        }).addTo(mapa);
        if (o.movibles) hacerMovible(marcadorOrigen, 'origen');
      }

      if (o.animar) animarCamion(puntos);

      // Márgenes para que la ruta no quede detrás de los paneles superior e inferior.
      const m = margen || {};
      mapa.fitBounds(lineaRuta.getBounds(), {
        paddingTopLeft: [40, m.arriba || 230],
        paddingBottomRight: [40, m.abajo || 130]
      });
    };

    // Pines de solicitudes. Al tocar uno se avisa a React con su id.
    window.mostrarMarcadores = function (lista, seleccionado) {
      capaSolicitudes.clearLayers();
      const puntos = [];

      (lista || []).forEach(function (m) {
        const pin = document.createElement('div');
        pin.className =
          'pin-solicitud' +
          (m.inmediato ? ' inmediato' : '') +
          (m.id === seleccionado ? ' seleccionado' : '');
        const letra = document.createElement('span');
        letra.textContent = m.letra || '';
        pin.appendChild(letra);

        const marcador = L.marker([m.lat, m.lng], {
          icon: L.divIcon({ className: '', html: pin, iconSize: [34, 34], iconAnchor: [17, 34] }),
          zIndexOffset: m.id === seleccionado ? 1000 : 0
        });
        marcador.on('click', function () { emitir({ tipo: 'MARCADOR', id: m.id }); });
        marcador.addTo(capaSolicitudes);
        puntos.push([m.lat, m.lng]);

        if (m.id === seleccionado) {
          mapa.panTo([m.lat, m.lng], { animate: true });
        }
      });

      // La primera vez se encuadran todas las solicitudes junto con el transportista.
      if (!marcadoresEncuadrados && puntos.length && !hayRuta && seleccionado == null) {
        marcadoresEncuadrados = true;
        if (marcadorUbicacion) puntos.push(marcadorUbicacion.getLatLng());
        mapa.fitBounds(L.latLngBounds(puntos), {
          paddingTopLeft: [40, 120],
          paddingBottomRight: [40, 260],
          maxZoom: 15
        });
      }
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
        window.mostrarRuta(d.puntos, d.destino, d.origen, d.margen, d.opciones);
      } else if (d.tipo === 'LIMPIAR_RUTA') {
        window.quitarRuta();
      } else if (d.tipo === 'MARCADORES') {
        window.mostrarMarcadores(d.lista, d.seleccionado);
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
/** Pin de una solicitud en el mapa (modo transportista). */
export type MarcadorMapa = {
  id: string;
  lat: number;
  lng: number;
  /** Letra corta dentro del pin (ej. "M" de Mudanza). */
  letra?: string;
  inmediato?: boolean;
};
/** Punto de partida de la ruta cuando no es la ubicación del GPS. */
export type OrigenRuta = Coordenadas & { etiqueta?: string };

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
  /** Si existe, la ruta sale de este punto en lugar de la ubicación del GPS. */
  origenRuta?: OrigenRuta | null;
  /** Pines de solicitudes. */
  marcadores?: MarcadorMapa[];
  /** Id del pin resaltado. */
  marcadorSeleccionado?: string | null;
  /** Se llama al tocar un pin. */
  onMarcador?: (id: string) => void;
  /** Espacio (px) que tapan los paneles de arriba y abajo al encuadrar la ruta. */
  margenRuta?: { arriba: number; abajo: number };
  /** Los pines A (origen) y B (destino) de la ruta se pueden arrastrar. */
  pinesMovibles?: boolean;
  /** Se llama al soltar un pin arrastrado. */
  onMoverPunto?: (cual: 'origen' | 'destino', coords: Coordenadas) => void;
  /** Un camión recorre la ruta de A a B (vista previa). */
  animarRuta?: boolean;
};

export default function MapaPrincipal({
  onUbicacion,
  destino,
  onRuta,
  seleccionando = false,
  onCentro,
  origenRuta = null,
  marcadores,
  marcadorSeleccionado = null,
  onMarcador,
  margenRuta,
  pinesMovibles = false,
  onMoverPunto,
  animarRuta = false,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const habiaRuta = useRef(false);

  // Se guarda el callback en una ref para que cambiar su identidad no vuelva a pedir la ruta.
  const onRutaRef = useRef(onRuta);
  onRutaRef.current = onRuta;

  const onCentroRef = useRef(onCentro);
  onCentroRef.current = onCentro;

  const onMarcadorRef = useRef(onMarcador);
  const margenRef = useRef(margenRuta);
  const onMoverPuntoRef = useRef(onMoverPunto);
  const opcionesRutaRef = useRef({ movibles: pinesMovibles, animar: animarRuta });
  useEffect(() => {
    onMarcadorRef.current = onMarcador;
    margenRef.current = margenRuta;
    onMoverPuntoRef.current = onMoverPunto;
    opcionesRutaRef.current = { movibles: pinesMovibles, animar: animarRuta };
  });

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
      } else if (d?.tipo === 'MARCADOR' && d.id != null) {
        onMarcadorRef.current?.(String(d.id));
      } else if (
        d?.tipo === 'PUNTO_MOVIDO' &&
        (d.cual === 'origen' || d.cual === 'destino')
      ) {
        onMoverPuntoRef.current?.(d.cual, { lat: d.lat, lng: d.lng });
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

  // 3) Trazar (o quitar) la ruta cuando cambia el destino o el punto de partida.
  //    Se usan los valores (no el objeto) para no repetir la petición en cada render.
  const origenLat = origenRuta?.lat;
  const origenLng = origenRuta?.lng;
  const origenEtiqueta = origenRuta?.etiqueta;
  // Con origen fijo, la ubicación del GPS no afecta la ruta.
  const coordsRuta = origenLat == null ? coords : null;

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

    const origen =
      origenLat != null && origenLng != null
        ? { lat: origenLat, lng: origenLng, etiqueta: origenEtiqueta }
        : null;
    const inicio = origen ?? coordsRuta;

    // Aún se está obteniendo la ubicación: se espera a que termine.
    if (!inicio) {
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
          `${inicio.lng},${inicio.lat};${destino.lng},${destino.lat}` +
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

        enviarAlMapa({
          tipo: 'RUTA',
          puntos,
          destino,
          origen,
          margen: margenRef.current,
          opciones: opcionesRutaRef.current,
        });
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
  }, [
    destino,
    coordsRuta,
    origenLat,
    origenLng,
    origenEtiqueta,
    mapaListo,
    cargando,
    enviarAlMapa,
  ]);

  // 3b) Pines de solicitudes.
  useEffect(() => {
    if (!mapaListo || !marcadores) return;
    enviarAlMapa({
      tipo: 'MARCADORES',
      lista: marcadores,
      seleccionado: marcadorSeleccionado,
    });
  }, [marcadores, marcadorSeleccionado, mapaListo, enviarAlMapa]);

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