// src/services/servicioService.ts

export interface SolicitudServicioDTO {
  origen: string;
  destino: string;
  descripcion: string;
  fecha?: string;
}

// Reemplaza esta URL con la IP o dominio de tu backend
const API_URL = 'https://tu-backend-api.com/api'; 

export const registrarServicio = async (datos: SolicitudServicioDTO, token: string) => {
  try {
    const response = await fetch(`${API_URL}/servicios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(datos),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al procesar la solicitud en el servidor');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en servicioService:', error);
    throw error;
  }
};