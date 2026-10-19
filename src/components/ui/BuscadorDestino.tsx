import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { Destino, InfoRuta } from './MapaPrincipal';

const AZUL = '#2969e9';

type Props = {
  destino: Destino | null;
  info: InfoRuta | null;
  onSeleccionar: (destino: Destino) => void;
  onLimpiar: () => void;
  /** Abre el modo para ubicar el punto manualmente en el mapa. */
  onUbicarManual: () => void;
  /** Oculta el buscador (mientras se elige el punto en el mapa). */
  oculto?: boolean;
};

type Resultado = Destino & { detalle: string };

function formatearDistancia(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function formatearDuracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

async function buscarLugares(consulta: string): Promise<Resultado[]> {
  // viewbox sesga los resultados hacia Medellín y el Valle de Aburrá (sin limitarlos).
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2' +
    `&q=${encodeURIComponent(consulta)}` +
    '&limit=5&addressdetails=1&accept-language=es&countrycodes=co' +
    '&viewbox=-75.75,6.45,-75.35,6.05&bounded=0';

  const respuesta = await fetch(url);
  const datos = await respuesta.json();

  if (!Array.isArray(datos)) return [];

  return datos.map((item: any) => {
    const a = item.address ?? {};
    const calle = [a.road, a.house_number].filter(Boolean).join(' ');
    const partes: string[] = String(item.display_name ?? '').split(',');
    const nombre = item.name || calle || partes[0]?.trim() || 'Destino';

    return {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      nombre,
      detalle: partes.slice(1, 4).join(',').trim(),
    };
  });
}

export default function BuscadorDestino({
  destino,
  info,
  onSeleccionar,
  onLimpiar,
  onUbicarManual,
  oculto = false,
}: Props) {
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [mensaje, setMensaje] = useState('');

  // Cuando el destino llega de fuera (punto manual), se refleja en el campo de texto.
  useEffect(() => {
    if (destino) setTexto(destino.nombre);
  }, [destino]);

  const buscar = async () => {
    const consulta = texto.trim();
    if (consulta.length < 3 || buscando) return;

    Keyboard.dismiss();
    setBuscando(true);
    setMensaje('');
    setResultados([]);

    try {
      const lista = await buscarLugares(consulta);
      setResultados(lista);
      if (lista.length === 0) {
        setMensaje('No encontramos ese lugar. Prueba con otro nombre o dirección.');
      }
    } catch {
      setMensaje('No pudimos buscar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBuscando(false);
    }
  };

  const seleccionar = (lugar: Resultado) => {
    setTexto(lugar.nombre);
    setResultados([]);
    setMensaje('');
    Keyboard.dismiss();
    onSeleccionar({ lat: lugar.lat, lng: lugar.lng, nombre: lugar.nombre });
  };

  const limpiar = () => {
    setTexto('');
    setResultados([]);
    setMensaje('');
    onLimpiar();
  };

  const ubicarManual = () => {
    setResultados([]);
    setMensaje('');
    Keyboard.dismiss();
    onUbicarManual();
  };

  const hayLista = resultados.length > 0 || !!mensaje;

  return (
    <View style={[styles.contenedor, oculto && { display: 'none' }]}>
      {/* Barra de búsqueda */}
      <View style={styles.barra}>
        <BlurView
          intensity={18}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sombra} />

        <View style={styles.fila}>
          <View style={styles.puntoDestino} />

          <TextInput
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={buscar}
            placeholder="¿A dónde vas?"
            placeholderTextColor="rgba(255,255,255,0.6)"
            returnKeyType="search"
            autoCorrect={false}
            style={[
              styles.input,
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
            ]}
          />

          {buscando ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              {(texto.length > 0 || !!destino) && (
                <Pressable
                  onPress={limpiar}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar destino"
                >
                  <Text style={styles.cerrar}>✕</Text>
                </Pressable>
              )}

              {texto.trim().length >= 3 && (
                <Pressable
                  onPress={buscar}
                  style={({ pressed }) => [
                    styles.botonBuscar,
                    pressed && styles.presionado,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Buscar"
                >
                  <Text style={styles.flecha}>→</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>

      {/* Resultados */}
      {hayLista && (
        <View style={styles.lista}>
          {resultados.map((lugar, indice) => (
            <Pressable
              key={`${lugar.lat}-${lugar.lng}-${indice}`}
              onPress={() => seleccionar(lugar)}
              style={({ pressed }) => [
                styles.item,
                indice > 0 && styles.itemSeparado,
                pressed && styles.presionado,
              ]}
            >
              <Text style={styles.itemTitulo} numberOfLines={1}>
                {lugar.nombre}
              </Text>
              {!!lugar.detalle && (
                <Text style={styles.itemDetalle} numberOfLines={1}>
                  {lugar.detalle}
                </Text>
              )}
            </Pressable>
          ))}

          {!!mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}

          {/* Acceso al modo manual: por si el lugar no aparece o no es exacto */}
          <Pressable
            onPress={ubicarManual}
            style={({ pressed }) => [
              styles.item,
              styles.itemSeparado,
              pressed && styles.presionado,
            ]}
          >
            <Text style={styles.itemManual}> ¿No es aquí? Ubicar en el mapa</Text>
          </Pressable>
        </View>
      )}

      {/* Resumen de la ruta + botón de ubicar en el mapa */}
      {!hayLista && (
        <View style={styles.acciones}>
          {!!destino && !!info && (
            <View style={styles.info}>
              <Text style={styles.infoTexto}>
                {formatearDuracion(info.duracionMin)} ·{' '}
                {formatearDistancia(info.distanciaKm)}
              </Text>
            </View>
          )}

          <Pressable
            onPress={ubicarManual}
            style={({ pressed }) => [
              styles.botonManual,
              pressed && styles.presionado,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ubicar punto en el mapa"
          >
            <Text style={styles.textoManual}>
                {destino ? 'Ajustar punto' : 'Ubicar en el mapa'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    zIndex: 3,
  },

  barra: {
    height: 52,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(17,19,24,0.30)',
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },

  sombra: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17,19,24,0.34)',
  },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 11,
  },

  puntoDestino: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#fa0000',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },

  cerrar: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '700',
  },

  botonBuscar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AZUL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  flecha: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 19,
  },

  lista: {
    marginTop: 8,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(17,19,24,0.94)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },

  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  itemSeparado: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },

  itemTitulo: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  itemDetalle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },

  itemManual: {
    color: '#72BFCB',
    fontSize: 13,
    fontWeight: '700',
  },

  mensaje: {
    color: '#E5E9EC',
    fontSize: 12,
    padding: 14,
  },

  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },

  info: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: AZUL,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  infoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  botonManual: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(17,19,24,0.85)',
  },

  textoManual: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  presionado: {
    opacity: 0.75,
  },
});