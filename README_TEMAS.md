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

## Tamaño de fuente
- `Perfil → Preferencias → Tamaño de fuente` ofrece Pequeño (90 %), Normal
  (100 %) y Grande (110 %). El borrador se previsualiza globalmente; solo
  `Guardar tamaño` lo persiste. El selector usa un control segmentado con
  nombres y porcentajes visibles, una bolita azul `#2969E9`, una guía horizontal
  y una transición suave. Permite tocar o arrastrar sin escribir en
  almacenamiento.
- Los textos funcionales usan `src/components/ui/Texto.tsx`: primero se aplica
  el factor de ancho existente (390 pt como referencia, limitado a 0.9–1.12),
  se fija una referencia mínima de 13 pt en Normal, se aplica la preferencia y
  se impone un mínimo final de 11 pt. El interlineado sigue la proporción del
  tamaño final. El escalado del sistema conserva el límite existente de 1.2.
- Los iconos no se escalan con la preferencia. Usa `Text` y `TextInput` desde
  `Texto.tsx`; un texto anidado sin tamaño propio hereda el tamaño ya ajustado.
- **Excepciones compactas explícitas:** la cifra de la insignia de avisos de
  `BarraNavegacion`, los valores numéricos de las barras de `PanelAnalisis`,
  la atribución de los mapas y las cifras dentro de sus pines.
  Se marcan con `escalaCompacta` en React Native o con la regla CSS/JS del mapa.
  No se usa esta excepción para botones, formularios, etiquetas funcionales,
  instrucciones, mensajes ni descripciones. Las excepciones mantienen el
  mínimo final de 11 pt y siguen el factor de preferencia.
- Los popups de mapas y los controles HTML de fecha y hora se ajustan aparte
  usando la misma fórmula, sin recargar los mapas durante la previsualización.
- La preferencia se guarda en almacenamiento local por UID y plataforma; web y
  Android no comparten ni sincronizan el valor. Un borrador no se escribe al
  almacenamiento y se conserva separado por UID en memoria si una transición
  de sesión externa impide mostrar la confirmación; al volver a esa cuenta se
  restaura como cambio pendiente.

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
