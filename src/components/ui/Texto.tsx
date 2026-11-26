import {
  createContext,
  forwardRef,
  useContext,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import {
  Platform,
  StyleSheet,
  Text as TextoNativo,
  TextInput as CampoNativo,
  useWindowDimensions,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";

import {
  obtenerFactorTamanoFuente,
  suscribirFactorTamanoFuente,
} from "../../services/tamanoFuenteStore";

const ANCHO_BASE = 390;
const ESCALA_MIN = 0.9;
const ESCALA_MAX = 1.12;
const TAMANO_REFERENCIA_MINIMO = 13;
const TAMANO_FINAL_MINIMO = 11;
const TAMANO_PREDETERMINADO = 14;
/** Crecimiento máximo permitido por el tamaño de fuente del sistema. */
export const TOPE_FUENTE_SISTEMA = 1.2;

type ContextoTexto = { factor: number };
type PropsTexto = TextProps & { escalaCompacta?: boolean };
type PropsCampo = TextInputProps & {
  escalaCompacta?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

const ContextoFactorPreferencia = createContext(1);
const ContextoTextoAnidado = createContext<ContextoTexto | null>(null);

export function ProveedorEscalaFuente({ children }: PropsWithChildren) {
  const factor = useSyncExternalStore(
    suscribirFactorTamanoFuente,
    obtenerFactorTamanoFuente,
    obtenerFactorTamanoFuente,
  );
  return (
    <ContextoFactorPreferencia.Provider value={factor}>
      {children}
    </ContextoFactorPreferencia.Provider>
  );
}

export function calcularTamanoFuente(
  tamanoOriginal: number,
  escalaAncho: number,
  factorPreferencia: number,
  compacto = false,
) {
  const referencia = compacto
    ? Math.max(TAMANO_FINAL_MINIMO, tamanoOriginal * escalaAncho)
    : Math.max(
        TAMANO_REFERENCIA_MINIMO,
        tamanoOriginal * escalaAncho,
      );
  const final = Math.max(TAMANO_FINAL_MINIMO, referencia * factorPreferencia);
  return Math.round(final * 2) / 2;
}

export function useEscala() {
  const { width } = useWindowDimensions();
  return Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, width / ANCHO_BASE));
}

export function useFactorPreferenciaFuente() {
  return useContext(ContextoFactorPreferencia);
}

function escalarEstilo(
  estilo: TextProps["style"],
  escalaAncho: number,
  factorPreferencia: number,
  compacto: boolean,
  padre: ContextoTexto | null,
) {
  const plano = StyleSheet.flatten(estilo) as TextStyle | undefined;
  const tamanoOriginal =
    typeof plano?.fontSize === "number"
      ? plano.fontSize
      : padre
        ? null
        : TAMANO_PREDETERMINADO;

  if (tamanoOriginal === null) {
    if (plano?.lineHeight == null || !padre) {
      return { estilo, contexto: padre };
    }
    return {
      estilo: [estilo, { lineHeight: redondear(plano.lineHeight * padre.factor) }],
      contexto: padre,
    };
  }

  const tamanoFinal = calcularTamanoFuente(
    tamanoOriginal,
    escalaAncho,
    factorPreferencia,
    compacto,
  );
  const factor = tamanoFinal / tamanoOriginal;
  const ajustes: TextStyle = { fontSize: tamanoFinal };
  if (plano?.lineHeight != null) {
    ajustes.lineHeight = redondear(plano.lineHeight * factor);
  }

  return {
    estilo: [estilo, ajustes],
    contexto: { factor },
  };
}

function redondear(valor: number) {
  return Math.round(valor * 2) / 2;
}

export const Text = forwardRef<TextoNativo, PropsTexto>(function Texto(
  { style, maxFontSizeMultiplier, escalaCompacta = false, ...resto },
  ref,
) {
  const escalaAncho = useEscala();
  const factorPreferencia = useFactorPreferenciaFuente();
  const padre = useContext(ContextoTextoAnidado);
  const resultado = escalarEstilo(
    style,
    escalaAncho,
    factorPreferencia,
    escalaCompacta,
    padre,
  );

  return (
    <ContextoTextoAnidado.Provider value={resultado.contexto}>
      <TextoNativo
        ref={ref}
        style={resultado.estilo}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? TOPE_FUENTE_SISTEMA}
        {...resto}
      />
    </ContextoTextoAnidado.Provider>
  );
});

export const TextInput = forwardRef<CampoNativo, PropsCampo>(
  function Campo(
    {
      style,
      maxFontSizeMultiplier,
      escalaCompacta = false,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      "aria-required": ariaRequired,
      ...resto
    },
    ref,
  ) {
    const escalaAncho = useEscala();
    const factorPreferencia = useFactorPreferenciaFuente();
    const resultado = escalarEstilo(
      style as TextProps["style"],
      escalaAncho,
      factorPreferencia,
      escalaCompacta,
      null,
    );
    const atributosWeb =
      Platform.OS === "web"
        ? {
            "aria-describedby": ariaDescribedBy,
            "aria-invalid": ariaInvalid,
            "aria-required": ariaRequired,
          }
        : {};

    return (
      <CampoNativo
        ref={ref}
        style={resultado.estilo}
        maxFontSizeMultiplier={maxFontSizeMultiplier ?? TOPE_FUENTE_SISTEMA}
        {...resto}
        {...atributosWeb}
      />
    );
  },
);

export type TextoEscalableProps = PropsTexto;

export default Text;
