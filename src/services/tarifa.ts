// src/services/tarifa.ts
//
// Tarifa de un servicio (pesos colombianos). Es la misma fórmula que usa la
// base de datos (función calcular_tarifa en la migración 009): aquí solo se
// calcula para mostrarle el precio estimado al cliente antes de solicitar.
//
//   120.000 por los primeros 5 km
// + 20.000 por cada km adicional (proporcional: 2,3 km = 46.000)
// + 20.000 por cada ayudante
// + 10.000 por cada piso

export const TARIFA_BASE = 120_000;
export const KM_INCLUIDOS = 5;
export const PRECIO_KM_ADICIONAL = 20_000;
export const PRECIO_AYUDANTE = 20_000;
export const PRECIO_PISO = 10_000;

export interface DesgloseTarifa {
  base: number;
  kmAdicionales: number;
  valorKm: number;
  valorAyudantes: number;
  valorPisos: number;
  total: number;
}

export function calcularTarifa(
  km: number,
  ayudantes: number,
  pisos: number,
): DesgloseTarifa {
  // Se redondea la distancia a 2 decimales, igual que la columna distancia_km.
  const kmRuta = Math.round(Math.max(km, 0) * 100) / 100;
  const kmAdicionales = Math.max(kmRuta - KM_INCLUIDOS, 0);
  const valorKm = kmAdicionales * PRECIO_KM_ADICIONAL;
  const valorAyudantes = Math.max(ayudantes, 0) * PRECIO_AYUDANTE;
  const valorPisos = Math.max(pisos, 0) * PRECIO_PISO;
  return {
    base: TARIFA_BASE,
    kmAdicionales,
    valorKm: Math.round(valorKm),
    valorAyudantes,
    valorPisos,
    total: Math.round(TARIFA_BASE + valorKm + valorAyudantes + valorPisos),
  };
}

/** 226000 -> "$ 226.000" (sin depender de Intl, que varía entre Android y web). */
export function formatearPesos(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const entero = Math.round(valor).toString();
  return `$ ${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

type Coords = { lat: number; lng: number };

/**
 * Distancia (km) de la ruta en calles entre dos puntos, con OSRM (el mismo
 * servicio gratuito que dibuja la ruta en el mapa). Es la ruta principal que
 * entrega OSRM, la misma que se ve en la vista previa: las alternativas más
 * cortas a veces pasan por trochas o caminos de montaña. Lanza error si no hay ruta.
 */
export async function distanciaRutaKm(a: Coords, b: Coords): Promise<number> {
  const url =
    "https://router.project-osrm.org/route/v1/driving/" +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
  const respuesta = await fetch(url);
  const datos = await respuesta.json();
  const metros = datos?.routes?.[0]?.distance;
  if (typeof metros !== "number") throw new Error("Sin ruta");
  return Math.round((metros / 1000) * 100) / 100;
}
