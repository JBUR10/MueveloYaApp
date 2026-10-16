import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapaPrincipal from '../components/ui/MapaPrincipal';

const CIAN = '#2969e9';
const FONDO = '#111318';

type Pestaña = 'Inicio' | 'Servicios' | 'Solicitudes' | 'Perfil';

const pestañas: { id: Pestaña; icono: string }[] = [  
  { id: 'Inicio', icono: '⌂' },
  { id: 'Servicios', icono: '◇' },
  { id: 'Solicitudes', icono: '▤' },
  { id: 'Perfil', icono: '○' },
];

export default function HomeScreen() {
  const [pestañaActiva, setPestañaActiva] =
    useState<Pestaña>('Inicio');

  const manejarPestaña = (pestaña: Pestaña) => {
    setPestañaActiva(pestaña);

    if (pestaña !== 'Inicio') {
      console.log('Pestaña seleccionada: ' + pestaña);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <View style={styles.contenedor}>
        <MapaPrincipal />

        {/* Encabezado */}
        <View style={styles.encabezado}>
          <View style={styles.marca}>
            <View style={styles.logo}>
              <Text style={styles.logoIcono}>↗</Text>
            </View>

            <Text style={styles.nombreApp}>
              Muévelo <Text style={styles.nombreCian}>Ya</Text>
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
              'rgba(255,255,255,0.20)',
              'rgba(255,255,255,0.09)',
              'rgba(255,255,255,0.04)',
            ]}
            locations={[0, 0.45, 1]}
            style={styles.cristalUbicacion}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.28)',
                'rgba(255,255,255,0.06)',
                'rgba(255,255,255,0)',
              ]}
              locations={[0, 0.45, 1]}
              style={styles.reflejoSuperior}
            />

            <View style={styles.contenidoUbicacion}>
              <View style={styles.puntoUbicacionExterior}>
                <View style={styles.puntoUbicacion} />
              </View>

              <View style={styles.textoUbicacion}>
                <Text style={styles.etiquetaUbicacion}>
                  TU UBICACIÓN
                </Text>

                <Text style={styles.nombreUbicacion}>
                  Medellín y Valle de Aburrá
                </Text>
              </View>

              <Text style={styles.flechaUbicacion}>›</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Barra de navegación con cristal y fondo difuminado */}
        <View style={styles.barraNavegacion}>
          <BlurView
            intensity={24}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.fondoBlurBarra}
          />

          <View style={styles.sombraCristalBarra} />

          <LinearGradient
            colors={[
              'rgba(255,255,255,0.18)',
              'rgba(235,242,248,0.08)',
              'rgba(215,226,238,0.04)',
            ]}
            locations={[0, 0.45, 1]}
            style={styles.cristalBarra}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.28)',
                'rgba(255,255,255,0.06)',
                'rgba(255,255,255,0)',
              ]}
              locations={[0, 0.5, 1]}
              style={styles.reflejoBarra}
            />

            <View style={styles.lineaLuzBarra} />

            <View style={styles.elementosBarra}>
              {pestañas.map((pestaña) => {
                const activa = pestañaActiva === pestaña.id;

                return (
                  <Pressable
                    key={pestaña.id}
                    style={({ pressed }) => [
                      styles.elementoNavegacion,
                      pressed && styles.presionado,
                    ]}
                    onPress={() => manejarPestaña(pestaña.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activa }}
                    accessibilityLabel={pestaña.id}
                  >
                    {activa && (
                      <View style={styles.cristalActivo}>
                        <LinearGradient
                          colors={[
                            'rgba(255,255,255,0.30)',
                            'rgba(255,255,255,0.11)',
                            'rgba(255,255,255,0.04)',
                          ]}
                          style={StyleSheet.absoluteFill}
                        />
                      </View>
                    )}

                    <Text
                      style={[
                        styles.simboloNavegacion,
                        activa && styles.simboloNavegacionActivo,
                      ]}
                    >
                      {pestaña.icono}
                    </Text>

                    <Text
                      style={[
                        styles.textoNavegacion,
                        activa && styles.textoNavegacionActivo,
                      ]}
                    >
                      {pestaña.id}
                    </Text>

                    {activa && (
                      <View style={styles.indicadorActivo} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </LinearGradient>
        </View>
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
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 4,
  },

  logoIcono: {
    fontSize: 27,
    fontWeight: '900',
    color: '#26333C',
  },

  nombreApp: {
    color: '#eeecec',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },

  nombreCian: {
    color: CIAN,
  },

  ubicacion: {
    position: 'absolute',
    top: 66,
    left: 20,
    right: 20,
    zIndex: 2,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(17,19,24,0.30)',
    overflow: 'hidden',
    shadowColor: '#000000',
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
    backgroundColor: 'rgba(17,19,24,0.24)',
  },

  cristalUbicacion: {
    minHeight: 64,
    borderRadius: 19,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,19,24,0.08)',
  },

  reflejoSuperior: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 25,
  },

  contenidoUbicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 11,
    zIndex: 1,
  },

  puntoUbicacionExterior: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },

  puntoUbicacion: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#72BFCB',
  },

  textoUbicacion: {
    flex: 1,
  },

  etiquetaUbicacion: {
    color: '#E7F0F4',
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  nombreUbicacion: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  flechaUbicacion: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '300',
  },

  barraNavegacion: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 8,
    zIndex: 5,
    height: 76,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(17,19,24,0.36)',
    overflow: 'hidden',
    shadowColor: '#000000',
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
    backgroundColor: 'rgba(17,19,24,0.30)',
  },

  cristalBarra: {
    flex: 1,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: 'rgba(17,19,24,0.08)',
  },

  reflejoBarra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 31,
  },

  lineaLuzBarra: {
    position: 'absolute',
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  elementosBarra: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    zIndex: 1,
  },

  elementoNavegacion: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  cristalActivo: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 4,
    right: 4,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
  },

  simboloNavegacion: {
    color: '#F0F3F5',
    fontSize: 23,
    lineHeight: 27,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  simboloNavegacionActivo: {
    color: '#FFFFFF',
  },

  textoNavegacion: {
    color: '#E5E9EC',
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  textoNavegacionActivo: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  indicadorActivo: {
    position: 'absolute',
    bottom: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  presionado: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
