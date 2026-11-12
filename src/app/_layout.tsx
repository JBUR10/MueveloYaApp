import '@/global.css';

import { Href, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AlertaPantalla from '../components/ui/AlertaPantalla';
import { cambiarModo, obtenerModo } from '../services/modoStore';
import { escucharToquesNotificacion } from '../services/notificacionesPush';
import { useSesion } from '../services/sesionStore';

/** Al tocar una notificación push, abre la pantalla que corresponde. */
function AbrirDesdeNotificacion() {
  const router = useRouter();

  useEffect(
    () =>
      escucharToquesNotificacion((ruta) => {
        // Los avisos del conductor se ven en el panel del transportista.
        if (ruta === '/transportista' && obtenerModo().modo !== 'transportista') {
          cambiarModo('transportista');
        }
        router.push(ruta as Href);
      }),
    [router],
  );

  return null;
}

export default function RootLayout() {
  const { sesion, cargado, recuperandoClave } = useSesion();
  const conSesion = !!sesion && !recuperandoClave;

  // Mientras se lee la sesión guardada, evita mostrar el login por un instante.
  if (!cargado) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#111318',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color="#2969e9" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Sin sesión: solo las pantallas de acceso. */}
        <Stack.Protected guard={!conSesion}>
          <Stack.Screen name="login" />
          <Stack.Screen name="registro" />
          <Stack.Screen name="verificar" />
          <Stack.Screen name="recuperar" />
        </Stack.Protected>

        {/* Con sesión: la app. */}
        <Stack.Protected guard={conSesion}>
          <Stack.Screen name="index" />
          <Stack.Screen name="servicios" />
          <Stack.Screen name="solicitudes" />
          <Stack.Screen name="perfil" />
          <Stack.Screen name="transportista" />
          <Stack.Screen name="vehiculo" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="queja" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="ayuda" />
        </Stack.Protected>
      </Stack>

      {conSesion && <AbrirDesdeNotificacion />}

      <AlertaPantalla />
    </>
  );
}
