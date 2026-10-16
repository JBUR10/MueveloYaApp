// src/app/servicio.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registrarServicio } from '../services/servicioService';

export default function ServicioScreen() {
  const router = useRouter();

  // Estados del formulario
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSolicitar = async () => {
    // 1. Validar campos obligatorios
    if (!origen.trim() || !destino.trim() || !descripcion.trim()) {
      Alert.alert('Campos incompletos', 'Por favor llena todos los campos obligatorios.');
      return;
    }

    setLoading(true);

    try {
      // 2. Obtener el token real almacenado en el dispositivo (asegúrate de que en el login lo guarden como 'token')
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Sesión no encontrada', 'Por favor inicia sesión nuevamente para solicitar un servicio.');
        setLoading(false);
        return;
      }

      const payload = {
        origen,
        destino,
        descripcion,
        fecha: new Date().toISOString(),
      };

      // 3. Enviar solicitud a la API con el token de sesión real
      await registrarServicio(payload, token);

      Alert.alert(
        '¡Solicitud Exitosa!', 
        'Tu flete o mudanza ha sido solicitado correctamente.',
        [{ text: 'OK', onPress: () => router.push('/') }]
      );

      // Limpiar formulario
      setOrigen('');
      setDestino('');
      setDescripcion('');

    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      {/* Cabecera */}
      <View className="my-6">
        <Text className="text-2xl font-bold text-gray-900">Solicitar Servicio</Text>
        <Text className="text-sm text-gray-500 mt-1">
          Ingresa los puntos de origen, destino y los detalles de tu carga.
        </Text>
      </View>

      {/* Formulario */}
      <View className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        
        {/* Origen */}
        <View className="mb-4">
          <Text className="text-gray-700 font-semibold mb-1">Punto de Origen</Text>
          <TextInput
            className="border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-800"
            placeholder="Ej: Calle 50 # 40-20, Medellín"
            placeholderTextColor="#9ca3af"
            value={origen}
            onChangeText={setOrigen}
          />
        </View>

        {/* Destino */}
        <View className="mb-4">
          <Text className="text-gray-700 font-semibold mb-1">Punto de Destino</Text>
          <TextInput
            className="border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-800"
            placeholder="Ej: Carrera 70 # 10-15, Envigado"
            placeholderTextColor="#9ca3af"
            value={destino}
            onChangeText={setDestino}
          />
        </View>

        {/* Descripción */}
        <View className="mb-4">
          <Text className="text-gray-700 font-semibold mb-1">Detalles de la Carga</Text>
          <TextInput
            className="border border-gray-300 rounded-xl p-3 bg-gray-50 text-gray-800 h-28"
            placeholder="Ej: 1 Cama doble, 1 nevera mediana y 4 cajas..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={descripcion}
            onChangeText={setDescripcion}
          />
        </View>

        {/* Botón de Enviar */}
        <TouchableOpacity
          className={`rounded-xl p-4 mt-4 items-center ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
          disabled={loading}
          onPress={handleSolicitar}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Confirmar Solicitud</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}