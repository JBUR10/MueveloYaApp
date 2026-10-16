import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function MapaPrincipal() {
  const mapaUrl =
    'https://www.openstreetmap.org/export/embed.html?bbox=-75.66%2C6.17%2C-75.48%2C6.34&layer=mapnik&marker=6.2442%2C-75.5812';

  return (
    <View style={styles.contenedor}>
      {React.createElement('iframe' as any, {
        src: mapaUrl,
        title: 'Mapa de Muévelo Ya - Medellín',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
          filter: 'brightness(0.72) sepia(0.25) hue-rotate(165deg) saturate(1.5)',
        },
        allowFullScreen: true,
        loading: 'eager',
      })}
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
    backgroundColor: '#071426',
    overflow: 'hidden',
  },
});