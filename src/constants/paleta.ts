// src/constants/paleta.ts
//
// Paletas de color de MueveloYa. Cada token tiene un valor para el tema
// OSCURO (el principal: son exactamente los colores que ya usaba la app) y
// otro para el tema CLARO (azul de la marca + blanco suave que no cansa la
// vista).
//
// Las pantallas no escriben colores a mano: reciben la paleta con
// `usePaleta()` o crean sus estilos con `useEstilos(crearEstilos)`
// (ver src/services/temaStore.ts).
//
// Si agregas un color nuevo, defínelo aquí en las DOS paletas.

export type NombreTema = "oscuro" | "claro";

export type Paleta = {
  tema: NombreTema;
  esClaro: boolean;

  // ── Superficies ──────────────────────────────────────────────
  /** Fondo general de las pantallas. */
  fondo: string;
  /** Fondo más hondo: pantallas de Servicios y campos de texto. */
  fondoProfundo: string;
  /** Tarjetas sólidas. */
  superficie: string;
  /** Tarjeta o chip seleccionado (tinte azul). */
  superficieSeleccion: string;
  /** Botones sobre superficies (ej. botón de cambiar foto). */
  superficieAlta: string;
  /** Fondo del mapa mientras cargan las teselas. */
  fondoMapa: string;
  /** Pista del interruptor apagado. */
  interruptor: string;
  /** Bolita del interruptor apagado. */
  interruptorPunto: string;
  /** Toast (mensaje temporal). */
  toastFondo: string;
  toastBorde: string;
  /** Globos sobre el mapa. */
  panelMapa: string;
  avisoMapa: string;

  // ── Bordes ───────────────────────────────────────────────────
  bordeCampo: string;
  bordeFuerte: string;
  /** Borde de la insignia roja sobre la barra de navegación. */
  bordeInsignia: string;

  // ── Texto ────────────────────────────────────────────────────
  texto: string;
  textoTitulo: string;
  textoFuerte: string;
  textoFuerte2: string;
  textoFuerte3: string;
  textoSuave: string;
  textoSuave2: string;
  textoDato: string;
  textoDato2: string;
  textoTenue: string;
  textoTenue2: string;
  textoTenue3: string;
  textoDeshabilitado: string;
  textoPista: string;
  textoPista2: string;
  textoPista3: string;

  // ── Acentos (texto) ──────────────────────────────────────────
  acento: string;
  acento2: string;
  acento3: string;
  /** Azul de la marca cuando se usa como texto pequeño. */
  azulTexto: string;
  textoError: string;
  textoError2: string;
  textoError3: string;
  textoExito: string;
  textoExito2: string;
  textoExito3: string;
  textoAviso: string;
  textoMorado: string;
  textoTeal: string;
  /** Estrellas de calificación. */
  estrella: string;

  // ── Rellenos sólidos con texto blanco encima ─────────────────
  /** Botones y marcas de éxito (verde). */
  rellenoExito: string;
  /** Botones y marcas de error / peligro (rojo). */
  rellenoError: string;

  // ── Utilidades con transparencia ─────────────────────────────
  /** Relleno translúcido: blanco sobre oscuro, tinta sobre claro. */
  velo: (alfa: number) => string;
  /** Línea / borde translúcido. */
  linea: (alfa: number) => string;
  /** Texto translúcido. */
  textoAlfa: (alfa: number) => string;
  /** Panel de cristal sobre el mapa. */
  panel: (alfa: number) => string;
  /** Sombra de texto (solo en oscuro, en claro no hace falta). */
  sombraTexto: (alfa: number) => string;

  // ── Componentes nativos ──────────────────────────────────────
  /** Estilo de la barra de estado. */
  barraEstado: "light-content" | "dark-content";
  /** Tinte del difuminado (BlurView). */
  blur: "dark" | "light";
};

const r = (n: number) => Math.round(n * 1000) / 1000;

export const PaletaOscura: Paleta = {
  tema: "oscuro",
  esClaro: false,

  fondo: "#111318",
  fondoProfundo: "#0B0E14",
  superficie: "#161B22",
  superficieSeleccion: "#1E293B",
  superficieAlta: "#1E222B",
  fondoMapa: "#111111",
  interruptor: "#353A46",
  interruptorPunto: "#D4D9E1",
  toastFondo: "rgba(23,40,78,0.96)",
  toastBorde: "rgba(141,178,255,0.65)",
  panelMapa: "rgba(17,17,17,0.85)",
  avisoMapa: "rgba(28,28,28,0.95)",

  bordeCampo: "#1F2937",
  bordeFuerte: "#374151",
  bordeInsignia: "#1A1D24",

  texto: "#FFFFFF",
  textoTitulo: "#EEECEC",
  textoFuerte: "#F2F5FA",
  textoFuerte2: "#F0F3F8",
  textoFuerte3: "#F0F3F5",
  textoSuave: "#E7F0F4",
  textoSuave2: "#E5E9EC",
  textoDato: "#D5DCE8",
  textoDato2: "#D1D5DB",
  textoTenue: "#9BA7BA",
  textoTenue2: "#9CA3AF",
  textoTenue3: "#9AA9C0",
  textoDeshabilitado: "#8E9AAE",
  textoPista: "#6B7280",
  textoPista2: "#657187",
  textoPista3: "#8395B0",

  acento: "#8DB2FF",
  acento2: "#60A5FA",
  acento3: "#3B82F6",
  azulTexto: "#2969E9",
  textoError: "#FCA5A5",
  textoError2: "#F87171",
  textoError3: "#FF8794",
  textoExito: "#34D399",
  textoExito2: "#86E8BD",
  textoExito3: "#10B981",
  textoAviso: "#FBBF24",
  textoMorado: "#A78BFA",
  textoTeal: "#72BFCB",
  estrella: "#FBBF24",

  rellenoExito: "#10B981",
  rellenoError: "#EF4444",

  velo: (a) => `rgba(255,255,255,${a})`,
  linea: (a) => `rgba(255,255,255,${a})`,
  textoAlfa: (a) => `rgba(255,255,255,${a})`,
  panel: (a) => `rgba(17,19,24,${a})`,
  sombraTexto: (a) => `rgba(0,0,0,${a})`,

  barraEstado: "light-content",
  blur: "dark",
};

// Tinta del tema claro: azul noche, para que el texto combine con el azul de
// la marca (#2969E9) en lugar de un negro puro.
const TINTA = "15,27,45";

export const PaletaClara: Paleta = {
  tema: "claro",
  esClaro: true,

  // Blanco "roto" con un toque azul: se ve limpio sin deslumbrar.
  fondo: "#EEF2F8",
  fondoProfundo: "#E7ECF4",
  superficie: "#F9FBFE",
  superficieSeleccion: "#E1EBFF",
  superficieAlta: "#DCE4F0",
  fondoMapa: "#E9ECF1",
  interruptor: "#C3CCDB",
  interruptorPunto: "#FFFFFF",
  toastFondo: "rgba(233,241,255,0.98)",
  toastBorde: "rgba(41,105,233,0.45)",
  panelMapa: "rgba(249,251,254,0.94)",
  avisoMapa: "rgba(249,251,254,0.97)",

  bordeCampo: "#D1D9E6",
  bordeFuerte: "#C1CBDA",
  bordeInsignia: "#F9FBFE",

  texto: "#0F1B2D",
  textoTitulo: "#0F1B2D",
  textoFuerte: "#13203A",
  textoFuerte2: "#13203A",
  textoFuerte3: "#13203A",
  textoSuave: "#1D2B42",
  textoSuave2: "#1D2B42",
  textoDato: "#2A374D",
  textoDato2: "#34425A",
  textoTenue: "#546177",
  textoTenue2: "#566379",
  textoTenue3: "#546177",
  textoDeshabilitado: "#5B687D",
  textoPista: "#5A677C",
  textoPista2: "#5C697E",
  textoPista3: "#5A697F",

  acento: "#1D4FD7",
  acento2: "#1D4FD7",
  acento3: "#1D4FD7",
  azulTexto: "#1D4FD7",
  textoError: "#B42318",
  textoError2: "#B42318",
  textoError3: "#B42318",
  textoExito: "#036B4D",
  textoExito2: "#036B4D",
  textoExito3: "#036B4D",
  textoAviso: "#8F5108",
  textoMorado: "#6D3FD1",
  textoTeal: "#0B6882",
  estrella: "#C77700",

  // Un tono más profundo para que el texto blanco se lea bien sobre ellos.
  rellenoExito: "#0A8260",
  rellenoError: "#D92D20",

  velo: (a) => `rgba(${TINTA},${r(a * 0.6)})`,
  linea: (a) => `rgba(${TINTA},${r(Math.min(0.32, a * 0.85 + 0.04))})`,
  textoAlfa: (a) => `rgba(${TINTA},${r(Math.min(0.9, a * 0.9 + 0.2))})`,
  panel: (a) =>
    `rgba(249,251,254,${r(a >= 0.8 ? Math.min(0.97, a + 0.02) : Math.min(0.9, a * 1.2 + 0.12))})`,
  sombraTexto: () => "transparent",

  barraEstado: "dark-content",
  blur: "light",
};

export const PALETAS: Record<NombreTema, Paleta> = {
  oscuro: PaletaOscura,
  claro: PaletaClara,
};
