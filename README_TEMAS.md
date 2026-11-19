# Tema oscuro / claro para MueveloYa

## Cómo se usa
- El tema **oscuro** sigue siendo el de siempre y es el que se usa por defecto.
- En **Perfil → Preferencias → Tema claro** se activa el tema claro. La elección
  se guarda en el dispositivo y se mantiene al cerrar y abrir la app.
- El mapa cambia de teselas (claras / oscuras) al instante, sin recargarse.

## Archivos NUEVOS
| Archivo | Para qué |
|---|---|
| `src/constants/paleta.ts` | **Todos los colores** de ambos temas. Para cambiar un color, edítalo aquí. |
| `src/services/temaStore.ts` | Guarda y cambia el tema. Hooks: `usePaleta()`, `useEstilos()`, `cambiarTema()`. |

## Cómo escribir pantallas nuevas
```tsx
import { useEstilos, usePaleta, type Paleta } from "../services/temaStore";

export default function MiPantalla() {
  const p = usePaleta();                    // para colores sueltos (iconos, spinners…)
  const styles = useEstilos(crearEstilos);  // para los estilos
  ...
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    caja: { backgroundColor: p.superficie, borderColor: p.bordeCampo },
    titulo: { color: p.texto },
  });
```
Regla: sobre un botón de color sólido (azul, verde, rojo) el texto va en `"#FFFFFF"`;
sobre fondos translúcidos o superficies, usa `p.texto`.

## Colores del tema claro
- Fondo `#EEF2F8` (blanco azulado suave, no deslumbra) · tarjetas `#F9FBFE`.
- Texto en azul noche `#0F1B2D` (no negro puro).
- Azul de la marca `#2969E9` en botones; para texto pequeño azul se usa `#1D4FD7` (más contraste).
- Verde y rojo sólidos un poco más profundos para que el texto blanco se lea.
- Contraste de texto revisado (≥ 4.5:1) sobre los fondos claros.

## Otros archivos tocados
- `app/_layout.tsx`: espera a leer el tema guardado antes de pintar (evita un destello).
- `app/+html.tsx` y `global.css` (web): fondo y autocompletado según el tema.
- `hooks/use-color-scheme*.ts`: ahora siguen el tema elegido.
- Mapas (`MapaPrincipal`, `MapaZonas`): teselas Carto `light_*` / `dark_*` y popups.

## Un cambio también en el tema oscuro
En `AlertaPantalla` el texto del botón principal quedó siempre blanco (el botón nunca es ámbar).
Nada más cambia en el oscuro: sus colores son los mismos de antes.
