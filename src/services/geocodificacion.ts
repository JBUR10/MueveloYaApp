// src/services/geocodificacion.ts
// Dirección a partir de coordenadas (geocodificación inversa). Se comparte
// entre el mapa de inicio y el mapa de vista previa de Servicios.
import * as Location from "expo-location";

type Coordenadas = { lat: number; lng: number };

/** Une calle, número y barrio en un texto corto: "Cra 43A 10-50, El Poblado". */
export function armarDireccion(
  calle?: string | null,
  numero?: string | null,
  barrio?: string | null,
  ciudad?: string | null,
) {
  const via = [calle, numero].filter(Boolean).join(" ");
  const zona = barrio || ciudad;
  return [via, zona].filter(Boolean).join(", ");
}

/** Obtiene la dirección de unas coordenadas. Primero expo-location; si no hay resultado
 *  (por ejemplo en web), usa OpenStreetMap (Nominatim). */
export async function obtenerDireccion({ lat, lng }: Coordenadas): Promise<string> {
  try {
    const [lugar] = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    if (lugar) {
      const texto = armarDireccion(
        lugar.street || lugar.name,
        lugar.streetNumber,
        lugar.district || lugar.subregion,
        lugar.city,
      );
      if (texto) return texto;
    }
  } catch {
    // Se intenta con el servicio alterno.
  }

  try {
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
    );
    const datos = await respuesta.json();
    const a = datos?.address ?? {};

    return armarDireccion(
      a.road || a.pedestrian || a.footway,
      a.house_number,
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village,
    );
  } catch {
    return "";
  }
}
