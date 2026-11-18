import '@/global.css';

import { Href, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AlertaPantalla from '../components/ui/AlertaPantalla';
import { cambiarModo, obtenerModo } from '../services/modoStore';
import { escucharToquesNotificacion } from '../services/notificacionesPush';
import { useSesion } from '../services/sesionStore';
import { useEstadoTema, usePaleta } from "../services/temaStore";

/** Al tocar una notificación push, abre la pantalla que corresponde. */
function AbrirDesdeNotificacion() {
  const router = useRouter();

  useEffect(
    () =>
      escucharToquesNotificacion((ruta) => {
        // Los avisos del conductor se ven en su panel (lista) o en su Inicio
        // (mapa, "/?ver=<id>" para las solicitudes nuevas).
        const delConductor = ruta === '/transportista' || ruta.startsWith('/?ver=');
        if (delConductor && obtenerModo().modo !== 'transportista') {
          cambiarModo('transportista');
        }
        router.push(ruta as Href);
      }),
    [router],
  );

  return null;
}

export default function RootLayout() {
  const p = usePaleta();
  const { cargado: temaCargado } = useEstadoTema();
  const { sesion, cargado, recuperandoClave } = useSesion();
  const conSesion = !!sesion && !recuperandoClave;

  // Mientras se lee la sesión guardada, evita mostrar el login por un instante.
  // También espera el tema guardado, para no mostrar un destello del tema equivocado.
  if (!cargado || !temaCargado) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: p.fondo,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color="#2969e9" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: p.fondo },
        }}>
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
