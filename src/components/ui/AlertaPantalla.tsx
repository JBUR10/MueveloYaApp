// src/components/ui/AlertaPantalla.tsx
//
// Alertas y confirmaciones dentro de la app (reemplazan window.alert /
// window.confirm / Alert.alert). Se monta una sola vez en el _layout y se
// usa desde cualquier pantalla:
//
//   await aviso("Listo", "Solicitud aceptada", "exito");
//   if (await confirmar({ titulo: "Eliminar", mensaje: "¿Seguro?" })) { ... }
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ComponentRef,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "./Texto";
import Icono, { type NombreIcono } from "./Icono";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

export type TipoAlerta = "exito" | "error" | "advertencia" | "info";

type Alerta = {
  titulo: string;
  mensaje: string;
  tipo: TipoAlerta;
  textoAceptar: string;
  /** Si existe, se muestra el botón secundario (confirmación). */
  textoCancelar?: string;
  acciones?: {
    valor: string;
    texto: string;
    estilo: "principal" | "secundario";
  }[];
  destructivo: boolean;
  resolver: (respuesta: boolean | string) => void;
};

// Cola: si llega una alerta mientras otra está abierta, espera su turno.
let cola: Alerta[] = [];
const oyentes = new Set<() => void>();

function emitir() {
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function encolar(alerta: Omit<Alerta, "resolver">) {
  return new Promise<boolean | string>((resolver) => {
    cola = [...cola, { ...alerta, resolver }];
    emitir();
  });
}

function cerrar(respuesta: boolean | string) {
  const [actual, ...resto] = cola;
  if (!actual) return;
  cola = resto;
  emitir();
  actual.resolver(respuesta);
}

/** Aviso con un solo botón. La promesa se resuelve al cerrarlo. */
export async function aviso(
  titulo: string,
  mensaje: string,
  tipo: TipoAlerta = "info",
  textoAceptar = "Aceptar",
) {
  await encolar({ titulo, mensaje, tipo, textoAceptar, destructivo: false });
}

/** Confirmación Sí/No. Devuelve true si el usuario acepta. */
export function confirmar({
  titulo,
  mensaje,
  textoAceptar = "Aceptar",
  textoCancelar = "Cancelar",
  destructivo = false,
  tipo = "advertencia",
}: {
  titulo: string;
  mensaje: string;
  textoAceptar?: string;
  textoCancelar?: string;
  destructivo?: boolean;
  tipo?: TipoAlerta;
}) {
  return encolar({
    titulo,
    mensaje,
    tipo,
    textoAceptar,
    textoCancelar,
    destructivo,
  }).then((respuesta) => respuesta === true);
}

export type AccionCambioTamano = "salir" | "guardar" | "editar";

export function confirmarCambiosTamanoFuente({
  titulo,
  mensaje,
}: {
  titulo: string;
  mensaje: string;
}): Promise<AccionCambioTamano> {
  return encolar({
    titulo,
    mensaje,
    tipo: "advertencia",
    textoAceptar: "",
    destructivo: false,
    acciones: [
      { valor: "salir", texto: "Salir", estilo: "secundario" },
      { valor: "guardar", texto: "Guardar cambios", estilo: "principal" },
      { valor: "editar", texto: "Seguir editando", estilo: "secundario" },
    ],
  }).then((respuesta) =>
    respuesta === "salir" || respuesta === "guardar" || respuesta === "editar"
      ? respuesta
      : "editar",
  );
}

const ICONOS: Record<TipoAlerta, NombreIcono> = {
  exito: "checkmark",
  error: "close",
  advertencia: "alert",
  info: "information",
};

const COLORES: Record<TipoAlerta, string> = {
  exito: "#10b981",
  error: "#ef4444",
  advertencia: "#fbbf24",
  info: "#2969e9",
};

export default function AlertaPantalla() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const id = useId().replace(/:/g, "");
  const tituloId = `alerta-titulo-${id}`;
  const mensajeId = `alerta-mensaje-${id}`;
  const tituloAccesible = useRef<ComponentRef<typeof Text>>(null);
  const alertaAnterior = useRef<Alerta | undefined>(undefined);
  const actual = useSyncExternalStore(
    suscribir,
    () => cola[0],
    () => cola[0],
  );

  // El ámbar se oscurece en el tema claro para que el icono se vea.
  const color = actual
    ? actual.tipo === "advertencia"
      ? p.estrella
      : COLORES[actual.tipo]
    : COLORES.info;
  const esConfirmacion =
    !!actual?.textoCancelar || !!actual?.acciones?.length;
  const atributosDescripcionWeb =
    Platform.OS === "web" ? { "aria-describedby": mensajeId } : {};

  const enfocarTitulo = useCallback(() => {
    if (Platform.OS === "web" || !tituloAccesible.current) return;
    const etiqueta = findNodeHandle(tituloAccesible.current);
    if (etiqueta !== null) AccessibilityInfo.setAccessibilityFocus(etiqueta);
  }, []);

  useEffect(() => {
    if (!actual) {
      alertaAnterior.current = undefined;
      return;
    }

    const esSiguienteAlerta =
      alertaAnterior.current !== undefined &&
      alertaAnterior.current !== actual;
    alertaAnterior.current = actual;
    if (!esSiguienteAlerta || Platform.OS === "web") return;

    const temporizador = setTimeout(enfocarTitulo, 100);
    return () => clearTimeout(temporizador);
  }, [actual, enfocarTitulo]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={!!actual}
      statusBarTranslucent
      accessibilityLabelledBy={tituloId}
      aria-labelledby={tituloId}
      accessibilityHint={actual?.mensaje}
      {...atributosDescripcionWeb}
      onShow={enfocarTitulo}
      onRequestClose={() =>
        cerrar(actual?.acciones?.length ? "editar" : false)
      }
    >
      <Pressable
        style={styles.overlay}
        accessibilityViewIsModal
        aria-modal
        // Tocar fuera solo cierra los avisos simples, no las confirmaciones.
        onPress={() => !esConfirmacion && cerrar(true)}
      >
        {actual && (
          <Pressable style={styles.contenedor} onPress={() => {}}>
            <ScrollView
              style={styles.contenidoDesplazable}
              contentContainerStyle={styles.contenidoAlerta}
              showsVerticalScrollIndicator
            >
              <View
                style={[
                  styles.icono,
                  { backgroundColor: `${color}22`, borderColor: `${color}66` },
                ]}
              >
                <Icono nombre={ICONOS[actual.tipo]} tamano={26} color={color} />
              </View>

              <Text
                ref={tituloAccesible}
                nativeID={tituloId}
                accessibilityRole="header"
                accessibilityLabel={`${actual.tipo === "error" ? "Error" : actual.tipo === "advertencia" ? "Advertencia" : actual.tipo === "exito" ? "Éxito" : "Información"}: ${actual.titulo}`}
                style={styles.titulo}
              >
                {actual.titulo}
              </Text>
              <Text nativeID={mensajeId} style={styles.mensaje}>
                {actual.mensaje}
              </Text>

              {actual.acciones?.length ? (
                <View style={styles.botonesAcciones}>
                  {actual.acciones.map((accion) => (
                    <Pressable
                      key={accion.valor}
                      onPress={() => cerrar(accion.valor)}
                      accessibilityRole="button"
                      accessibilityLabel={accion.texto}
                      style={({ pressed }) => [
                        styles.boton,
                        styles.botonAccionVertical,
                        accion.estilo === "principal"
                          ? { backgroundColor: "#2969e9" }
                          : styles.botonSecundario,
                        pressed && styles.presionado,
                      ]}
                    >
                      <Text
                        style={
                          accion.estilo === "principal"
                            ? styles.textoPrincipal
                            : styles.textoSecundario
                        }
                      >
                        {accion.texto}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.botones}>
                  {esConfirmacion && (
                    <Pressable
                      onPress={() => cerrar(false)}
                      accessibilityRole="button"
                      accessibilityLabel={actual.textoCancelar}
                      style={({ pressed }) => [
                        styles.boton,
                        styles.botonSecundario,
                        pressed && styles.presionado,
                      ]}
                    >
                      <Text style={styles.textoSecundario}>
                        {actual.textoCancelar}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => cerrar(true)}
                    accessibilityRole="button"
                    accessibilityLabel={actual.textoAceptar}
                    style={({ pressed }) => [
                      styles.boton,
                      {
                        backgroundColor: actual.destructivo
                          ? p.rellenoError
                          : actual.tipo === "exito"
                            ? p.rellenoExito
                            : "#2969e9",
                      },
                      pressed && styles.presionado,
                    ]}
                  >
                    <Text style={styles.textoPrincipal}>
                      {actual.textoAceptar}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  contenedor: {
    width: "100%",
    maxWidth: 340,
    maxHeight: "90%",
    backgroundColor: p.superficie,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: p.bordeFuerte,
    alignItems: "center",
  },
  contenidoDesplazable: { width: "100%", flexShrink: 1 },
  contenidoAlerta: { alignItems: "center" },
  icono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  titulo: {
    color: p.texto,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  mensaje: {
    color: p.textoDato2,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  botones: { flexDirection: "row", gap: 10, width: "100%" },
  botonesAcciones: { gap: 8, width: "100%" },
  boton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  botonAccionVertical: { flex: 0, minHeight: 48, width: "100%" },
  botonSecundario: { backgroundColor: p.velo(0.1) },
  // El botón principal siempre es de color sólido (azul, verde o rojo).
  textoPrincipal: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  textoSecundario: { color: p.texto, fontWeight: "700", fontSize: 14 },
  presionado: { opacity: 0.75 },
});
