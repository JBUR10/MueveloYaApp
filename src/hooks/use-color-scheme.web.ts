import { useTema } from '../services/temaStore';

/** Esquema de color de la app según el tema elegido ("dark" es el principal). */
export function useColorScheme(): 'light' | 'dark' {
  return useTema() === 'claro' ? 'light' : 'dark';
}
