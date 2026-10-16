// src/services/servicioService.ts

export interface SolicitudServicioDTO {
  tipoServicio: string;
  origen: string;
  destino: string;
  descripcion: string;
  ayudantes: number;
  pisosEscaleras: number;
  nombreContacto: string;
  telefonoContacto: string;
  fecha?: string;
}

// Reemplaza esta URL por la IP o dominio de tu servidor backend en desarrollo o producción
// Si estás probando localmente desde tu celular Android, usa la IP de tu PC (ej: http://192.168.1.50:8000/api)
const API_URL = 'https://tu-backend-api.com/api';

export const registrarServicio = async (
  datos: SolicitudServicioDTO,
  token: string
) => {
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
      throw new Error(
        errorData.detail || 'Error al registrar la solicitud de servicio en el servidor'
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error en servicioService:', error);
    throw error;
  }
};