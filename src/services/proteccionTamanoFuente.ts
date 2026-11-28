import {
  guardarTamanoFuente,
  obtenerEstadoTamanoFuente,
} from "./tamanoFuenteStore";

type ContinuacionNavegacion = () => void | Promise<void>;
type ResolverProteccion = (continuar: ContinuacionNavegacion) => Promise<boolean>;

let resolverActual: ResolverProteccion | null = null;
let navegacionEnCurso = false;

export function registrarProteccionTamanoFuente(resolver: ResolverProteccion) {
  resolverActual = resolver;
  return () => {
    if (resolverActual === resolver) resolverActual = null;
  };
}

export async function navegarConProteccionTamanoFuente(
  continuar: ContinuacionNavegacion,
) {
  if (navegacionEnCurso) return false;
  navegacionEnCurso = true;

  try {
    let estado = obtenerEstadoTamanoFuente();
    if (estado.guardando) {
      await guardarTamanoFuente();
      estado = obtenerEstadoTamanoFuente();
    }

    const hayBorradorPendiente =
      estado.carga === "ready" && estado.borrador !== estado.guardado;
    const resolver = resolverActual;

    if (!hayBorradorPendiente) {
      await continuar();
      return true;
    }

    if (!resolver) return false;
    return await resolver(continuar);
  } finally {
    navegacionEnCurso = false;
  }
}
