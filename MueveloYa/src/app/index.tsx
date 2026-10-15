import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MapaPrincipal from '../components/ui/MapaPrincipal';

const CIAN = '#00D4FF';
const FONDO = '#111318';
const TEXTO_SECUNDARIO = '#A4A9B4';

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

          <Pressable
            style={({ pressed }) => [
              styles.botonPerfil,
              pressed && styles.presionado,
            ]}
            onPress={() => manejarPestaña('Perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <LinearGradient
              colors={[
                'rgba(35,75,112,0.82)',
                'rgba(14,43,73,0.90)',
                'rgba(5,23,44,0.96)',
              ]}
              locations={[0, 0.35, 1]}
              style={styles.cristalPerfil}
            >
              <View style={styles.reflejoPerfil} />
              <Text style={styles.iconoPerfil}>👤</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Panel de ubicación */}
        <View style={styles.ubicacion}>
          <LinearGradient
            colors={[
              'rgba(42,83,120,0.78)',
              'rgba(18,49,80,0.88)',
              'rgba(9,33,59,0.94)',
              'rgba(4,20,39,0.97)',
            ]}
            locations={[0, 0.18, 0.58, 1]}
            style={styles.cristalUbicacion}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.24)',
                'rgba(255,255,255,0.06)',
                'rgba(255,255,255,0)',
              ]}
              locations={[0, 0.3, 1]}
              style={styles.reflejoSuperior}
            />

            <View style={styles.reflejoDiagonal} />

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

        {/* Barra de navegación */}
        <View style={styles.barraNavegacion}>
          <LinearGradient
            colors={[
              'rgba(18,45,73,0.92)',
              'rgba(8,29,52,0.96)',
              'rgba(3,15,31,0.99)',
              'rgba(2,11,24,0.99)',
            ]}
            locations={[0, 0.35, 0.72, 1]}
            style={styles.cristalBarra}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.20)',
                'rgba(255,255,255,0.05)',
                'rgba(255,255,255,0)',
              ]}
              locations={[0, 0.22, 1]}
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
                      <LinearGradient
                        colors={[
                          'rgba(0,212,255,0.20)',
                          'rgba(0,212,255,0.07)',
                          'rgba(0,212,255,0.01)',
                        ]}
                        style={styles.cristalActivo}
                      />
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
                      <View style={styles.indicadorActivo}>
                        <LinearGradient
                          colors={['#FFFFFF', CIAN, '#008DB8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.brilloIndicador}
                        />
                      </View>
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
    backgroundColor: CIAN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CIAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },

  logoIcono: {
    fontSize: 27,
    fontWeight: '900',
    color: FONDO,
  },

  nombreApp: {
    color: '#FFFFFF',
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

  botonPerfil: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: CIAN,
    backgroundColor: 'rgba(5,23,44,0.50)',
    overflow: 'hidden',
  },

  cristalPerfil: {
    flex: 1,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  reflejoPerfil: {
    position: 'absolute',
    top: 1,
    left: 5,
    right: 5,
    height: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.38)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  iconoPerfil: {
    fontSize: 18,
  },

  ubicacion: {
    position: 'absolute',
    top: 66,
    left: 20,
    right: 20,
    zIndex: 2,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: CIAN,
    backgroundColor: 'rgba(4,20,39,0.75)',
    overflow: 'hidden',
  },

  cristalUbicacion: {
    minHeight: 64,
    borderRadius: 19,
    overflow: 'hidden',
    justifyContent: 'center',
  },

  reflejoSuperior: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },

  reflejoDiagonal: {
    position: 'absolute',
    top: -24,
    left: '36%',
    width: 52,
    height: 125,
    backgroundColor: 'rgba(255,255,255,0.035)',
    transform: [{ rotate: '24deg' }],
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
    backgroundColor: 'rgba(0,212,255,0.14)',
  },

  puntoUbicacion: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#BDF8FF',
    borderWidth: 2,
    borderColor: CIAN,
    shadowColor: CIAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 3,
  },

  textoUbicacion: {
    flex: 1,
  },

  etiquetaUbicacion: {
    color: '#B5D9E8',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '800',
  },

  nombreUbicacion: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  flechaUbicacion: {
    color: '#C8F8FF',
    fontSize: 27,
    fontWeight: '300',
    textShadowColor: CIAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },

  barraNavegacion: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 8,
    zIndex: 5,
    height: 76,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: CIAN,
    backgroundColor: '#030F1F',
    overflow: 'hidden',
  },

  cristalBarra: {
    flex: 1,
    borderRadius: 27,
    overflow: 'hidden',
  },

  reflejoBarra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
  },

  lineaLuzBarra: {
    position: 'absolute',
    top: 1,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.30)',
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
  },

  simboloNavegacion: {
    color: '#C0CEDB',
    fontSize: 23,
    lineHeight: 27,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  simboloNavegacionActivo: {
    color: '#FFFFFF',
    textShadowColor: CIAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  textoNavegacion: {
    color: '#B3C0CE',
    fontSize: 10,
    fontWeight: '600',
  },

  textoNavegacionActivo: {
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: 'rgba(0,212,255,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },

  indicadorActivo: {
    position: 'absolute',
    bottom: 3,
    width: 18,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: CIAN,
    shadowColor: CIAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },

  brilloIndicador: {
    flex: 1,
    borderRadius: 2,
  },

  presionado: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
