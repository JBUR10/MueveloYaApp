// src/components/transportista/PanelTransportista.tsx
// Panel del modo transportista. Se usa en dos pestañas:
//  - Inicio (vista="mapa"): mapa con las solicitudes, el aviso de solicitud
//    nueva y la ruta del servicio en curso.
//  - Solicitudes (vista="lista"): Disponibles, Aceptadas e Historial.
//
// Detalle de cada vista:
//  - Mapa: las solicitudes disponibles como pines; al tocar uno sube una
//    tarjeta y se dibuja la ruta de A a B con un camión que la recorre.
//  - Lista: disponibles, aceptadas e historial.
//  - Ruta: al iniciar el servicio (inmediatos: al aceptar; programados: con
//    "Iniciar"), ruta de mi ubicación a la recogida (A) y, después de
//    "Ya recogí", de la recogida a la entrega (B).
import { Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "../ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";

import { aviso, confirmar } from "../ui/AlertaPantalla";
import BarraNavegacion from "../ui/BarraNavegacion";
import { buscarLugares } from "../ui/BuscadorDestino";
import CalificarServicio from "../ui/CalificarServicio";
import MotivoCancelacion from "../ui/MotivoCancelacion";
import EvidenciaRecogida from "./EvidenciaRecogida";
import { tomarFoto } from "../../services/evidenciasService";
import MapaPrincipal, {
  Coordenadas,
  InfoRuta,
  MarcadorMapa,
} from "../ui/MapaPrincipal";
import MensajeTemporal from "../ui/MensajeTemporal";
import {
  marcarDisponiblesVistas,
  alLlegarAviso,
  mostrarAvisosPendientes,
  refrescarAvisos,
} from "../../services/avisosStore";
import {
  cambiarDisponibilidad,
  useDisponibilidad,
} from "../../services/disponibilidadStore";
import { usePush } from "../../services/notificacionesPush";
import {
  cambiarCuentaConAyudantes,
  obtenerModo,
  cambiarModo,
  useModo,
} from "../../services/modoStore";
import {
  escucharCambiosServicios,
  SolicitudServicioDTO,
} from "../../services/servicioService";
import { useSesion } from "../../services/sesionStore";
import {
  aceptarSolicitud,
  cancelarSolicitud,
  completarServicio,
  DatosTransportista,
  type EstadoConductor,
  esInmediato,
  estaIniciado,
  HORAS_MINIMAS_CANCELACION,
  iniciarServicio,
  marcarRecogido,
  formatearFechaHora,
  obtenerDatosTransportista,
  obtenerEstadoConductor,
  puedeCancelar,
  rechazarSolicitud,
} from "../../services/transportistaService";
import { formatearPesos } from "../../services/tarifa";
import DetalleTarifaSolicitud from "../DetalleTarifaSolicitud";
import ResumenPagoTransportista from "./ResumenPagoTransportista";
import {
  textoAvisoComision,
  textoAvisoFinalizar,
} from "../../services/saldoService";
import { obtenerMiVehiculo, revisarDocumentos } from "../../services/vehiculoService";
import Icono, { type NombreIcono } from "../ui/Icono";
import TextoIcono from "../ui/TextoIcono";
import TextoCalificacion from "../ui/TextoCalificacion";
import { usePaleta, useEstilos, type Paleta } from "../../services/temaStore";

const AZUL = "#2969e9";

/** Respaldo del tiempo real: las solicitudes que toma otro transportista
 *  dejan de ser visibles y Supabase no avisa de eso. */
const RECARGA_MS = 30_000;

export type VistaPanel = "mapa" | "lista";
type Seccion = "disponibles" | "aceptadas" | "historial";

const SECCIONES: { id: Seccion; titulo: string }[] = [
  { id: "disponibles", titulo: "Disponibles" },
  { id: "aceptadas", titulo: "Aceptadas" },
  { id: "historial", titulo: "Historial" },
];

const VACIOS: Record<Seccion, { titulo: string; texto: string }> = {
  disponibles: {
    titulo: "No hay solicitudes disponibles",
    texto: "Cuando un usuario solicite un servicio aparecerá aquí.",
  },
  aceptadas: {
    titulo: "Aún no has aceptado solicitudes",
    texto: "Las solicitudes que aceptes aparecerán aquí.",
  },
  historial: {
    titulo: "Tu historial está vacío",
    texto: "Aquí verás los servicios que finalizaste o cancelaste.",
  },
};

const DATOS_VACIOS: DatosTransportista = {
  disponibles: [],
  asignadas: [],
  completadas: [],
  cancelaciones: [],
  canceladasPorCliente: [],
};

type ItemHistorial = {
  servicio: SolicitudServicioDTO;
  /** cancelada = la cancelé yo; cancelada_cliente = la canceló el cliente. */
  tipo: "completada" | "cancelada" | "cancelada_cliente";
  fecha: string;
  motivo?: string | null;
};

const TEXTO_HISTORIAL: Record<
  ItemHistorial["tipo"],
  { icono: NombreIcono; chip: string; fecha: string }
> = {
  completada: { icono: "checkmark", chip: "Finalizada", fecha: "Finalizada" },
  cancelada: { icono: "close", chip: "La cancelaste", fecha: "Cancelada" },
  cancelada_cliente: {
    icono: "close",
    chip: "Canceló el cliente",
    fecha: "Cancelada",
  },
};

const formatearFecha = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Distancia en línea recta (km) entre dos puntos. */
const distanciaKm = (a: Coordenadas, b: Coordenadas) => {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const textoKm = (km: number) =>
  km < 1
    ? `${Math.round(km * 1000)} m`
    : `${km.toFixed(1).replace(".", ",")} km`;

const llamar = (telefono: string) =>
  Linking.openURL(`tel:${telefono.replace(/\s/g, "")}`).catch(() =>
    aviso("Error", "No se pudo iniciar la llamada.", "error"),
  );

export default function PanelTransportista({ vista }: { vista: VistaPanel }) {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const { height: altoVentana } = useWindowDimensions();
  // Alto máximo de la parte desplazable de los paneles del mapa; los botones de
  // acción quedan debajo, fuera de ella.
  const altoMaximoPanelMapa = Math.max(120, altoVentana * 0.45);
  const router = useRouter();
  // Mapa: ?ruta=<id> abre la ruta de un servicio; ?ver=<id> abre una solicitud.
  // Lista: ?seccion=aceptadas abre esa sección.
  const params = useLocalSearchParams<{
    ruta?: string;
    ver?: string;
    seccion?: string;
  }>();
  const { cuentaConAyudantes } = useModo();
  const uid = useSesion().sesion?.user.id;
  const [calificandoId, setCalificandoId] = useState<string | null>(null);
  // Servicio que se está cancelando (abre el selector de motivo).
  const [cancelando, setCancelando] = useState<SolicitudServicioDTO | null>(null);
  // Servicio que se está recogiendo y sus fotos (abre la evidencia).
  const [recogiendo, setRecogiendo] = useState<{
    item: SolicitudServicioDTO;
    fotos: string[];
  } | null>(null);
  // Advertencias, suspensión y condición por quejas confirmadas (019).
  const [estadoConductor, setEstadoConductor] = useState<EstadoConductor | null>(null);
  const { disponible } = useDisponibilidad();
  const push = usePush();
  const [cambiandoDisponible, setCambiandoDisponible] = useState(false);

  const [datos, setDatos] = useState<DatosTransportista>(DATOS_VACIOS);
  const [seccion, setSeccion] = useState<Seccion>("disponibles");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [rutaId, setRutaId] = useState<string | null>(null);
  const [miUbicacion, setMiUbicacion] = useState<Coordenadas | null>(null);
  // La info de la ruta se guarda con la clave de la ruta (servicio + fase)
  // para no mostrar la distancia de la fase anterior.
  const [infoRutaGuardada, setInfoRutaGuardada] = useState<{
    clave: string;
    info: InfoRuta | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const ocultarMensaje = useCallback(() => setMensaje(null), []);
  const rutaAbiertaAlEntrar = useRef(false);
  // Ids de las solicitudes ya vistas, para avisar cuando llega una nueva.
  const idsVistos = useRef<Set<string> | null>(null);
  const [nuevaSolicitud, setNuevaSolicitud] = useState<SolicitudServicioDTO | null>(
    null,
  );

  // En la lista el aviso de solicitud nueva se oculta solo a los 8 segundos.
  // En el mapa queda hasta que el conductor lo abra o lo cierre.
  useEffect(() => {
    if (!nuevaSolicitud || vista !== "lista") return;
    const t = setTimeout(() => setNuevaSolicitud(null), 8000);
    return () => clearTimeout(t);
  }, [nuevaSolicitud, vista]);

  // Se refresca cada minuto para bloquear "Cancelar" justo al llegar a 48 h.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      const nuevos = await obtenerDatosTransportista();
      setDatos(nuevos);
      setAhora(new Date());

      // ¿Llegó una solicitud nueva desde la última carga? (no en la primera)
      // En un servicio en curso solo cuentan las programadas.
      const enRutaAhora = nuevos.asignadas.some(estaIniciado);
      // Sin ayudantes tampoco cuentan las que los piden.
      const conAyudantes = obtenerModo().cuentaConAyudantes;
      const visibles = nuevos.disponibles.filter(
        (s) =>
          (!enRutaAhora || !esInmediato(s)) && (conAyudantes || !s.ayudantes),
      );
      if (idsVistos.current) {
        const vistos = idsVistos.current;
        const nueva = visibles.find((s) => s.id && !vistos.has(s.id));
        if (nueva) setNuevaSolicitud(nueva);
      }
      idsVistos.current = new Set(
        nuevos.disponibles.map((s) => s.id).filter((id): id is string => !!id),
      );

      // Si quedó un servicio iniciado, se retoma su ruta al entrar.
      if (!rutaAbiertaAlEntrar.current) {
        rutaAbiertaAlEntrar.current = true;
        const iniciado = nuevos.asignadas.find(estaIniciado);
        if (iniciado?.id) setRutaId(iniciado.id);
      }
    } catch (error) {
      console.error("Error cargando solicitudes del transportista:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Al entrar: revisa vehículo/documentos, carga datos y escucha cambios en vivo.
  useFocusEffect(
    useCallback(() => {
      let activo = true;

      (async () => {
        try {
          const vehiculo = await obtenerMiVehiculo();
          if (!activo) return;
          if (!vehiculo) {
            await aviso(
              "Registra tu vehículo",
              "Para recibir solicitudes primero debes registrar tu vehículo y documentos.",
              "advertencia",
            );
            router.replace({ pathname: "/vehiculo", params: { activar: "1" } });
            return;
          }
          // Sin la aprobación de un administrador no se reciben solicitudes.
          if (vehiculo.verificacion !== "aprobado") {
            const rechazado = vehiculo.verificacion === "rechazado";
            await cambiarModo("usuario");
            await aviso(
              rechazado ? "Perfil rechazado" : "Perfil en revisión",
              rechazado
                ? `Un administrador rechazó tu perfil: ${vehiculo.motivoRechazo || "revisa tus datos"}. Corrige tu vehículo y se enviará a revisión de nuevo.`
                : "Un administrador está revisando tu perfil. Podrás recibir solicitudes cuando lo apruebe.",
              rechazado ? "error" : "info",
            );
            router.replace(rechazado ? "/vehiculo" : "/perfil");
            return;
          }
          const revision = revisarDocumentos(vehiculo);
          if (!revision.vigentes) {
            await aviso(
              "Documentos vencidos",
              `No puedes recibir solicitudes: ${revision.vencidos.join(", ")}. Actualiza las fechas de tu vehículo.`,
              "error",
            );
            router.replace("/vehiculo");
            return;
          }
          // Suspendido por una queja confirmada: solo puede usar la app
          // como cliente.
          const estado = await obtenerEstadoConductor();
          if (!activo) return;
          setEstadoConductor(estado);
          if (estado?.suspendido) {
            await cambiarModo("usuario");
            await aviso(
              "Cuenta de conductor suspendida",
              estado.definitiva || !estado.suspendidoHasta
                ? "Tu modo conductor fue suspendido de forma definitiva por una queja de daño confirmada. Puedes seguir usando la app como cliente."
                : `Tu modo conductor está suspendido hasta el ${formatearFechaHora(estado.suspendidoHasta)} por una queja de daño confirmada. Mientras tanto puedes usar la app como cliente.`,
              "error",
            );
            router.replace("/perfil");
            return;
          }
        } catch (error) {
          console.error("Error revisando el vehículo:", error);
        }
        if (!activo) return;
        await cargarDatos();
        // Las disponibles dejan de contarse como "nuevas" y se muestran los
        // avisos pendientes (por ejemplo, si un cliente canceló).
        marcarDisponiblesVistas();
        mostrarAvisosPendientes();
      })();

      let espera: ReturnType<typeof setTimeout> | null = null;
      const dejarDeEscuchar = escucharCambiosServicios(() => {
        // Varios cambios seguidos se agrupan en una sola recarga.
        if (espera) clearTimeout(espera);
        espera = setTimeout(cargarDatos, 400);
      });
      const intervalo = setInterval(cargarDatos, RECARGA_MS);
      // Con el panel abierto, un aviso nuevo (por ejemplo, el cliente canceló)
      // se muestra al instante, sin tener que salir y volver a entrar.
      const dejarAvisos = alLlegarAviso(() =>
        cargarDatos().then(() => mostrarAvisosPendientes()),
      );

      return () => {
        activo = false;
        dejarDeEscuchar();
        dejarAvisos();
        clearInterval(intervalo);
        if (espera) clearTimeout(espera);
      };
    }, [cargarDatos, router]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarDatos();
  }, [cargarDatos]);

  const historial = useMemo<ItemHistorial[]>(
    () =>
      [
        ...datos.completadas.map((s) => ({
          servicio: s,
          tipo: "completada" as const,
          fecha: s.completadaEl ?? "",
        })),
        ...datos.cancelaciones.map((c) => ({
          servicio: c.servicio,
          tipo: "cancelada" as const,
          fecha: c.canceladaEl,
          motivo: c.motivo,
        })),
        ...datos.canceladasPorCliente.map((s) => ({
          servicio: s,
          tipo: "cancelada_cliente" as const,
          fecha: s.canceladaEl ?? "",
          motivo: s.motivoCancelacion,
        })),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [datos],
  );

  // Con un servicio en curso no se pueden aceptar inmediatas (la base de
  // datos lo impide): en el mapa y en la lista solo se ven las programadas.
  const enRuta = datos.asignadas.some(estaIniciado);
  // Sin ayudantes, tampoco se ven las solicitudes que los piden.
  const disponiblesVisibles = useMemo(
    () =>
      datos.disponibles.filter(
        (s) =>
          (!enRuta || !esInmediato(s)) && (cuentaConAyudantes || !s.ayudantes),
      ),
    [datos.disponibles, enRuta, cuentaConAyudantes],
  );

  const conteos: Record<Seccion, number> = {
    disponibles: disponiblesVisibles.length,
    aceptadas: datos.asignadas.length,
    historial: historial.length,
  };

  // ---------- Ruta del servicio activo ----------
  // Solo servicios iniciados. Si ya no está asignado (finalizado o
  // cancelado) queda en null.
  const servicioRuta =
    datos.asignadas.find((s) => s.id === rutaId && estaIniciado(s)) ?? null;
  const enCurso = servicioRuta?.estado === "en_curso";

  // Si la solicitud seleccionada desaparece (la tomó otro), la tarjeta se cierra sola.
  const seleccionado =
    disponiblesVisibles.find((s) => s.id === seleccionadoId) ?? null;
  // Vista previa: al tocar un pin se dibuja la ruta de A a B (si tiene ambos puntos).
  const vistaPrevia =
    !servicioRuta && seleccionado?.origenCoords && seleccionado?.destinoCoords
      ? seleccionado
      : null;

  const claveRuta = servicioRuta
    ? `${servicioRuta.id}-${servicioRuta.estado}`
    : vistaPrevia
      ? `previa-${vistaPrevia.id}`
      : "";
  const infoRuta =
    infoRutaGuardada?.clave === claveRuta ? infoRutaGuardada.info : null;
  const alCalcularRuta = useCallback(
    (info: InfoRuta | null) => setInfoRutaGuardada({ clave: claveRuta, info }),
    [claveRuta],
  );

  // Pines: solo solicitudes con punto exacto de recogida.
  const marcadores = useMemo<MarcadorMapa[]>(
    () =>
      servicioRuta
        ? []
        : disponiblesVisibles
            .filter((s) => s.id && s.origenCoords)
            .map((s) => ({
              id: s.id!,
              lat: s.origenCoords!.lat,
              lng: s.origenCoords!.lng,
              letra: s.tipoServicio.charAt(0).toUpperCase(),
              inmediato: esInmediato(s),
            })),
    [disponiblesVisibles, servicioRuta],
  );
  const sinUbicacion = disponiblesVisibles.length - marcadores.length;

  // Direcciones escritas a mano (sin punto en el mapa): se buscan con
  // Nominatim (OpenStreetMap, gratis). null = no se encontró.
  const [direccionesBuscadas, setDireccionesBuscadas] = useState<
    Record<string, Coordenadas | null>
  >({});

  const textoOrigen = servicioRuta?.origen ?? "";
  const textoDestino = servicioRuta?.destino ?? "";
  const faltaOrigen = !!servicioRuta && !servicioRuta.origenCoords;
  // El destino solo se necesita en la fase de entrega.
  const faltaDestino = enCurso && !servicioRuta?.destinoCoords;

  useEffect(() => {
    const pendientes = [
      faltaOrigen ? textoOrigen : "",
      faltaDestino ? textoDestino : "",
    ].filter((t) => t && !(t in direccionesBuscadas));
    if (!pendientes.length) return;

    let activo = true;
    (async () => {
      for (const texto of pendientes) {
        let punto: Coordenadas | null = null;
        try {
          const [primero] = await buscarLugares(texto);
          if (primero) punto = { lat: primero.lat, lng: primero.lng };
        } catch {
          // Sin resultado: se muestra el aviso en el panel.
        }
        if (!activo) return;
        setDireccionesBuscadas((actual) => ({ ...actual, [texto]: punto }));
      }
    })();

    return () => {
      activo = false;
    };
  }, [faltaOrigen, faltaDestino, textoOrigen, textoDestino, direccionesBuscadas]);

  const puntoOrigen =
    servicioRuta?.origenCoords ?? direccionesBuscadas[textoOrigen] ?? null;
  const puntoDestino =
    servicioRuta?.destinoCoords ?? direccionesBuscadas[textoDestino] ?? null;
  // true mientras se espera la búsqueda de una dirección que hace falta.
  const buscandoDireccion =
    (faltaOrigen && !(textoOrigen in direccionesBuscadas)) ||
    (faltaDestino && !(textoDestino in direccionesBuscadas));

  const destinoRuta = useMemo(() => {
    if (vistaPrevia?.destinoCoords) {
      return { ...vistaPrevia.destinoCoords, nombre: vistaPrevia.destino };
    }
    if (!servicioRuta) return null;
    const punto = enCurso ? puntoDestino : puntoOrigen;
    return punto
      ? { ...punto, nombre: enCurso ? textoDestino : textoOrigen }
      : null;
  }, [
    vistaPrevia,
    servicioRuta,
    enCurso,
    puntoOrigen,
    puntoDestino,
    textoOrigen,
    textoDestino,
  ]);

  const origenRuta = useMemo(() => {
    if (vistaPrevia?.origenCoords) return { ...vistaPrevia.origenCoords, etiqueta: "A" };
    return enCurso && puntoOrigen ? { ...puntoOrigen, etiqueta: "A" } : null;
  }, [vistaPrevia, enCurso, puntoOrigen]);

  // ---------- Navegación entre Inicio (mapa) y Solicitudes (lista) ----------
  /** En el mapa abre una ruta (?ruta) o una solicitud (?ver); desde la lista
   *  lleva al Inicio con eso abierto. */
  const irAlMapa = (abrir: { ruta?: string; ver?: string } = {}) => {
    if (vista === "mapa") {
      if (abrir.ruta) {
        setSeleccionadoId(null);
        setRutaId(abrir.ruta);
      } else if (abrir.ver) {
        setRutaId(null);
        setSeleccionadoId(abrir.ver);
      }
      return;
    }
    router.push({ pathname: "/", params: abrir } as Href);
  };

  const irALista = (seccionLista?: Seccion) =>
    router.push({
      pathname: "/transportista",
      params: seccionLista ? { seccion: seccionLista } : {},
    } as Href);

  // Llega con ?ruta / ?ver / ?seccion (desde la otra pestaña o una
  // notificación): se aplica una vez y se quita de la URL.
  useFocusEffect(
    useCallback(() => {
      const { ruta, ver, seccion: seccionParam } = params;
      if (!ruta && !ver && !seccionParam) return;
      if (vista === "mapa") {
        if (ruta) {
          setSeleccionadoId(null);
          setRutaId(ruta);
        } else if (ver) {
          setRutaId(null);
          setSeleccionadoId(ver);
          setNuevaSolicitud(null);
        }
      } else if (
        seccionParam === "disponibles" ||
        seccionParam === "aceptadas" ||
        seccionParam === "historial"
      ) {
        setSeccion(seccionParam);
      }
      router.setParams({ ruta: undefined, ver: undefined, seccion: undefined });
    }, [params, vista, router]),
  );

  // ---------- Acciones ----------
  /** Abre en el mapa la solicitud del aviso "Nueva solicitud". */
  const verNuevaSolicitud = () => {
    const nueva = nuevaSolicitud;
    setNuevaSolicitud(null);
    if (nueva?.id) irAlMapa({ ver: nueva.id });
  };

  /** Vuelve a la ruta del servicio en curso. */
  const volverAMiRuta = () => {
    const iniciado = datos.asignadas.find(estaIniciado);
    setSeleccionadoId(null);
    if (iniciado?.id) setRutaId(iniciado.id);
  };

  /** Rechazar: la solicitud deja de aparecerle a este conductor. */
  const handleRechazar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    const ok = await confirmar({
      titulo: "Rechazar solicitud",
      mensaje:
        "Esta solicitud dejará de aparecerte. Seguirá disponible para otros transportistas.",
      textoAceptar: "Rechazar",
      textoCancelar: "Volver",
      destructivo: true,
    });
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      await rechazarSolicitud(item.id);
      setSeleccionadoId(null);
      if (nuevaSolicitud?.id === item.id) setNuevaSolicitud(null);
      await cargarDatos();
      setMensaje("Solicitud rechazada");
    } catch (error: any) {
      await aviso("No se pudo rechazar", error?.message || "Inténtalo de nuevo.", "error");
    } finally {
      setProcesandoId(null);
    }
  };

  // Un transportista también puede pedir servicios: vuelve a modo usuario.
  const volverAModoUsuario = async () => {
    const ok = await confirmar({
      titulo: "Volver a modo usuario",
      mensaje:
        "Dejarás de ver solicitudes de transporte y podrás pedir servicios. Puedes volver al modo transportista desde tu perfil.",
      textoAceptar: "Cambiar",
      tipo: "info",
    });
    if (!ok) return;
    await cambiarModo("usuario");
    router.replace("/");
  };

  const handleAyudantes = async () => {
    const nuevoValor = !cuentaConAyudantes;
    const ok = await confirmar({
      titulo: "Ayudantes",
      mensaje: nuevoValor
        ? "¿Confirmas que ahora cuentas con ayudantes? Te aparecerán también las solicitudes que piden ayudantes."
        : "¿Confirmas que ya no cuentas con ayudantes? Dejarán de aparecerte las solicitudes que piden ayudantes.",
      textoAceptar: "Confirmar",
      tipo: "info",
    });
    if (!ok) return;

    try {
      await cambiarCuentaConAyudantes(nuevoValor);
    } catch (error: any) {
      await aviso("No se pudo cambiar", error?.message || "Inténtalo de nuevo.", "error");
      return;
    }
    refrescarAvisos();
    setMensaje(
      nuevoValor
        ? "Ahora ves también las solicitudes con ayudantes"
        : "Ya no verás solicitudes que piden ayudantes",
    );
  };

  const handleAceptar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;

    const programado = !esInmediato(item);
    const sinCancelacion = !puedeCancelar(item);
    const ok = await confirmar({
      titulo: "Aceptar solicitud",
      mensaje: textoAvisoComision(item) + "\n\n" + (!programado
        ? "Es un servicio inmediato: al aceptarlo verás la ruta al punto de recogida y no podrás cancelarlo."
        : sinCancelacion
          ? `Faltan menos de ${HORAS_MINIMAS_CANCELACION} horas para este servicio. Si lo aceptas no podrás cancelarlo.`
          : `Lo iniciarás desde «Aceptadas» cuando vayas a salir. Podrás cancelarlo hasta ${HORAS_MINIMAS_CANCELACION} horas antes.`),
      textoAceptar: "Aceptar",
      tipo: "info",
    });
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      await aceptarSolicitud(item.id);
      await cargarDatos();
      setSeleccionadoId(null);

      if (programado) {
        // Programado: no arranca la ruta; queda en "Aceptadas" para iniciarlo.
        await aviso(
          "Servicio programado aceptado",
          `Quedó en tus aceptadas para el ${item.fechaProgramada}. Cuando vayas a salir, tócalo e inicia el servicio.`,
          "exito",
        );
        return;
      }

      irAlMapa({ ruta: item.id });
      setMensaje("Solicitud aceptada");
    } catch (error: any) {
      await aviso(
        "No se pudo aceptar",
        error?.message || "No se pudo aceptar la solicitud.",
        "error",
      );
      cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const handleIniciar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    const ok = await confirmar({
      titulo: "Iniciar servicio",
      mensaje:
        "Se mostrará la ruta al punto de recogida y el cliente verá que vas en camino. Después ya no podrás cancelarlo.",
      textoAceptar: "Iniciar",
      textoCancelar: "Aún no",
      tipo: "info",
    });
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      await iniciarServicio(item.id);
      await cargarDatos();
      irAlMapa({ ruta: item.id });
      setMensaje("Servicio iniciado");
    } catch (error: any) {
      await aviso("No se pudo iniciar", error?.message || "Inténtalo de nuevo.", "error");
    } finally {
      setProcesandoId(null);
    }
  };

  const handleCancelar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;

    if (estaIniciado(item)) {
      await aviso(
        "No se puede cancelar",
        "Ya iniciaste este servicio: no se puede cancelar.",
        "advertencia",
      );
      return;
    }

    if (!puedeCancelar(item)) {
      await aviso(
        "No se puede cancelar",
        `Las solicitudes aceptadas solo se pueden cancelar con al menos ${HORAS_MINIMAS_CANCELACION} horas de anticipación.`,
        "advertencia",
      );
      return;
    }

    // El motivo es obligatorio: se elige en el modal y se envía al confirmar.
    setCancelando(item);
  };

  /** Lo llama el selector de motivo. Si falla, el error se ve en el modal. */
  const confirmarCancelacion = async (motivo: string) => {
    const item = cancelando;
    if (!item?.id) return;
    setProcesandoId(item.id);
    try {
      await cancelarSolicitud(item, motivo);
    } finally {
      setProcesandoId(null);
    }
    setCancelando(null);
    if (rutaId === item.id) setRutaId(null);
    await cargarDatos();
    setMensaje("Solicitud cancelada");
  };

  // ---------- Disponible (push de solicitudes nuevas) ----------
  const handleDisponible = async () => {
    const nuevo = !disponible;
    setCambiandoDisponible(true);
    try {
      await cambiarDisponibilidad(nuevo);
    } catch (error: any) {
      await aviso("No se pudo cambiar", error?.message || "Inténtalo de nuevo.", "error");
      return;
    } finally {
      setCambiandoDisponible(false);
    }

    if (!nuevo) {
      setMensaje("Ya no recibirás avisos de solicitudes nuevas");
    } else if (!push.soportado) {
      await aviso(
        "Estás disponible",
        "Las notificaciones push solo llegan en la app instalada (APK). Aquí verás las solicitudes al abrir el panel.",
        "info",
      );
    } else if (!push.activo || push.sinPermiso) {
      await aviso(
        "Estás disponible",
        "Tienes las notificaciones apagadas: actívalas en tu Perfil para que te avisemos de solicitudes nuevas.",
        "advertencia",
      );
    } else {
      setMensaje("Disponible: te avisaremos de solicitudes nuevas");
    }
  };

  const renderInterruptorDisponible = (compacto: boolean) => (
    <Pressable
      onPress={handleDisponible}
      disabled={cambiandoDisponible}
      accessibilityRole="switch"
      accessibilityState={{ checked: disponible, disabled: cambiandoDisponible }}
      accessibilityLabel="Disponible para recibir solicitudes"
      style={({ pressed }) => [
        compacto ? styles.chipDisponible : styles.tarjetaDisponible,
        disponible && styles.disponibleActivo,
        pressed && { opacity: 0.8 },
      ]}
    >
      {/* En el chip del mapa el texto no se estira (flex:1 lo encogería). */}
      <View style={compacto ? undefined : styles.ayudantesTexto}>
        <TextoIcono
          icono="ellipse"
          tamanoIcono={10}
          colorIcono={disponible ? p.textoExito : p.textoTenue}
          style={styles.ayudantesTitulo}
        >
          {disponible ? "Disponible" : "No disponible"}
        </TextoIcono>
        {!compacto && (
          <Text style={styles.ayudantesDescripcion}>
            {disponible
              ? "Te avisaremos de solicitudes nuevas aunque tengas la app cerrada."
              : "Actívalo para recibir avisos de solicitudes nuevas."}
          </Text>
        )}
      </View>
      {cambiandoDisponible ? (
        <ActivityIndicator size="small" color={p.texto} />
      ) : (
        <View style={[styles.interruptor, disponible && styles.interruptorDisponible]}>
          <View
            style={[
              styles.interruptorPunto,
              disponible && styles.interruptorPuntoActivo,
            ]}
          />
        </View>
      )}
    </Pressable>
  );

  // Antes de marcar recogido hay que tomar fotos del estado de los
  // artículos: primero se avisa, luego se abre la cámara.
  const handleRecogido = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    const ok = await confirmar({
      titulo: "Evidencia de los artículos",
      mensaje:
        "Para iniciar debes adjuntar evidencia del estado de los artículos. Toma fotos claras, sobre todo de golpes, rayones o daños que ya tengan: te sirven de soporte si el cliente reporta un daño.",
      textoAceptar: "Tomar fotos",
      textoCancelar: "Aún no",
      tipo: "advertencia",
    });
    if (!ok) return;

    try {
      const foto = await tomarFoto();
      if (!foto) return;
      setRecogiendo({ item, fotos: [foto] });
    } catch (error: any) {
      await aviso("Cámara", error?.message || "No se pudo abrir la cámara.", "error");
    }
  };

  const confirmarRecogida = async (fotos: string[]) => {
    const item = recogiendo?.item;
    if (!item?.id) return;
    setProcesandoId(item.id);
    try {
      await marcarRecogido(item.id, fotos);
    } finally {
      setProcesandoId(null);
    }
    setRecogiendo(null);
    await cargarDatos();
    setMensaje("Rumbo al punto de entrega");
  };

  const handleFinalizar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    const ok = await confirmar({
      titulo: "Finalizar servicio",
      mensaje:
        "¿Confirmas que entregaste la carga en el destino?" +
        textoAvisoFinalizar(item),
      textoAceptar: "Finalizar",
      textoCancelar: "Volver",
      tipo: "info",
    });
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      await completarServicio(item.id);
      setRutaId(null);
      await cargarDatos();
      await aviso(
        "¡Servicio finalizado!",
        "Buen trabajo. Tu saldo ya se actualizó (míralo en tu perfil). Ahora cuéntanos cómo te fue con el cliente.",
        "exito",
      );
      setCalificandoId(item.id);
    } catch (error: any) {
      await aviso("Error", error?.message || "No se pudo finalizar.", "error");
    } finally {
      setProcesandoId(null);
    }
  };

  const verRuta = (item: SolicitudServicioDTO) => {
    if (item.id) irAlMapa({ ruta: item.id });
  };

  // ---------- Render: vista de mapa ----------
  const renderPanelSeleccionado = (item: SolicitudServicioDTO) => {
    const inmediato = esInmediato(item);
    const procesando = procesandoId === item.id;
    const km =
      miUbicacion && item.origenCoords
        ? distanciaKm(miUbicacion, item.origenCoords)
        : null;

    return (
      <View style={styles.panelInferior}>
        <ScrollView
          key={item.id}
          style={{ maxHeight: altoMaximoPanelMapa, flexGrow: 0 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTypeBadge} numberOfLines={1}>
            {item.tipoServicio}
          </Text>
          <View style={styles.filaChipCerrar}>
            <View
              style={[
                styles.statusChip,
                inmediato ? styles.chipImmediate : styles.chipScheduled,
              ]}
            >
              <TextoIcono
                icono={inmediato ? "flash" : "calendar-outline"}
                style={[styles.statusChipText, { color: inmediato ? p.textoAviso : p.azulTexto }]}
              >
                {inmediato ? "Inmediato" : item.fechaProgramada}
              </TextoIcono>
            </View>
            {/* X: vuelve al mapa sin decidir */}
            <Pressable
              onPress={() => setSeleccionadoId(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={styles.btnCerrarX}
            >
              <Icono nombre="close" tamano={16} color={p.texto} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.distancia}>
          {[
            km !== null ? `A ${textoKm(km)} de ti` : null,
            infoRuta && vistaPrevia
              ? `Recorrido ${textoKm(infoRuta.distanciaKm)} · ${infoRuta.duracionMin} min`
              : null,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
        <TextoCalificacion
          style={styles.calificacionCliente}
          prefijo="Cliente: "
          calificacion={item.cliente?.calificacion}
        />

        <Ruta origen={item.origen} destino={item.destino} compacta />

        {etiquetasCarga(item).length > 0 && (
          <View style={styles.cargaBadges}>
            {etiquetasCarga(item).map((etiqueta) => (
              <View key={etiqueta} style={styles.cargaBadge}>
                <Text style={styles.cargaBadgeText}>{etiqueta}</Text>
              </View>
            ))}
          </View>
        )}

        <DetalleTarifaSolicitud item={item} />
        <ResumenPagoTransportista item={item} />

        {item.descripcion ? (
          <Text style={styles.cardDesc}>
            {item.descripcion}
          </Text>
        ) : null}
        </ScrollView>

        <View style={styles.botonesPanel}>
          <TouchableOpacity
            style={styles.btnRechazar}
            onPress={() => handleRechazar(item)}
            disabled={procesando}
            activeOpacity={0.8}
            accessibilityLabel="Rechazar solicitud"
            accessibilityState={{ disabled: procesando, busy: procesando }}
          >
            <Text style={styles.btnRechazarText}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnPrimario}
            onPress={() => handleAceptar(item)}
            disabled={procesando}
            activeOpacity={0.8}
            accessibilityLabel="Aceptar solicitud"
            accessibilityState={{ disabled: procesando, busy: procesando }}
          >
            {procesando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <TextoIcono icono="checkmark" style={styles.btnPrimarioText}>
                Aceptar solicitud
              </TextoIcono>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPanelRuta = (item: SolicitudServicioDTO) => {
    const procesando = procesandoId === item.id;
    const puntoFase = enCurso ? puntoDestino : puntoOrigen;
    const textoFase = enCurso ? item.destino : item.origen;

    return (
      <View style={[styles.panelInferior, styles.panelRuta]}>
        <ScrollView
          key={item.id}
          style={{ maxHeight: altoMaximoPanelMapa, flexGrow: 0 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.filaFase}>
          <View style={[styles.faseChip, enCurso && styles.faseChipActiva]}>
            <Text style={styles.faseTexto}>
              {enCurso ? "2 · Entrega" : "1 · Recogida"}
            </Text>
          </View>
          {infoRuta && (
            <Text style={styles.infoRuta}>
              {textoKm(infoRuta.distanciaKm)} · {infoRuta.duracionMin} min
            </Text>
          )}
        </View>

        <Text style={styles.tituloRuta}>
          {enCurso ? "Lleva la carga al destino" : "Ve al punto de recogida"}
        </Text>
        <Text style={styles.direccionRuta}>
          {textoFase}
        </Text>
        {buscandoDireccion ? (
          <Text style={styles.textoBloqueo}>Buscando la dirección en el mapa…</Text>
        ) : (
          !puntoFase && (
            <Text style={styles.textoBloqueo}>
              No encontramos esta dirección en el mapa. Llama al cliente para
              confirmar el punto exacto.
            </Text>
          )
        )}
        </ScrollView>

        <View style={styles.contactoRuta}>
          <TextoIcono
            icono="person-outline"
            style={[styles.contactName, { flexShrink: 1 }]}
            numberOfLines={2}
          >
            {item.nombreContacto}
          </TextoIcono>
          {item.telefonoContacto ? (
            <TouchableOpacity onPress={() => llamar(item.telefonoContacto)}>
              <TextoIcono icono="call-outline" style={styles.contactPhone}>
                Llamar
              </TextoIcono>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.botonesPanel}>
          <TouchableOpacity
            style={styles.btnPrimario}
            onPress={() => (enCurso ? handleFinalizar(item) : handleRecogido(item))}
            disabled={procesando}
            activeOpacity={0.8}
          >
            {procesando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <TextoIcono
                icono={enCurso ? "checkmark" : "cube-outline"}
                style={styles.btnPrimarioText}
              >
                {enCurso ? "Finalizar servicio" : "Ya recogí la carga"}
              </TextoIcono>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Aviso "Nueva solicitud" del mapa: resumen, botón Ver y X para cerrarlo.
  // Si otro conductor la toma (o se rechaza), desaparece solo.
  const avisoNueva =
    nuevaSolicitud && disponiblesVisibles.some((s) => s.id === nuevaSolicitud.id)
      ? nuevaSolicitud
      : null;

  const renderAvisoNueva = (item: SolicitudServicioDTO, arriba: boolean) => {
    const inmediato = esInmediato(item);
    return (
      <View style={[styles.panelInferior, styles.avisoNuevaTarjeta, arriba && styles.avisoArriba]}>
        <View style={styles.cardHeaderRow}>
          <TextoIcono icono="notifications" style={styles.avisoEtiqueta}>
            NUEVA SOLICITUD
          </TextoIcono>
          <Pressable
            onPress={() => setNuevaSolicitud(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            style={styles.btnCerrarX}
          >
            <Icono nombre="close" tamano={16} color={p.texto} />
          </Pressable>
        </View>
        <TextoIcono
          icono={inmediato ? "flash" : "calendar-outline"}
          alFinal
          style={styles.avisoTitulo}
        >
          {item.tipoServicio} · {inmediato ? "Inmediata" : item.fechaProgramada}
        </TextoIcono>
        <Text style={styles.avisoRuta} numberOfLines={2}>
          {item.origen}{"  "}
          <Icono nombre="arrow-forward" tamano={14} color={p.textoSuave} />
          {"  "}{item.destino}
        </Text>
        {/* Datos a la izquierda y el botón a la derecha, con su tamaño natural. */}
        <View style={styles.filaAvisoBoton}>
          <Text style={styles.avisoDatos}>
            {[
              item.distanciaKm != null ? textoKm(item.distanciaKm) : null,
              etiquetasCarga(item).length > 0
                ? etiquetasCarga(item).join(" · ")
                : null,
              (item.recargoCarga ?? 0) > 0
                ? `Carga especial ${formatearPesos(item.recargoCarga)}`
                : null,
              (item.descuento ?? 0) > 0 && item.tarifaBase != null
                ? `Subtotal ${formatearPesos(item.tarifaBase)}`
                : null,
              (item.descuento ?? 0) > 0
                ? `Descuento - ${formatearPesos(item.descuento)}`
                : null,
              item.tarifaAcordada != null ? formatearPesos(item.tarifaAcordada) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <TouchableOpacity
            style={styles.btnVerSolicitud}
            onPress={verNuevaSolicitud}
            activeOpacity={0.8}
          >
            <TextoIcono icono="chevron-forward" alFinal style={styles.btnPrimarioText}>
              Ver solicitud
            </TextoIcono>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderVistaMapa = () => (
    <>
      <MapaPrincipal
        onUbicacion={setMiUbicacion}
        destino={destinoRuta}
        origenRuta={origenRuta}
        onRuta={alCalcularRuta}
        marcadores={marcadores}
        marcadorSeleccionado={seleccionadoId}
        onMarcador={setSeleccionadoId}
        animarRuta={!!vistaPrevia}
        margenRuta={{ arriba: 120, abajo: 360 }}
      />

      {/* Barra superior flotante */}
      <View style={styles.barraFlotante}>
        {servicioRuta ? (
          // En ruta solo se pueden tomar programadas: el botón dice cuántas hay.
          <TouchableOpacity
            onPress={() => setRutaId(null)}
            style={styles.btnFlotante}
            activeOpacity={0.8}
          >
            <TextoIcono
              icono={conteos.disponibles > 0 ? "calendar-outline" : "list-outline"}
              style={styles.btnBackText}
            >
              {conteos.disponibles > 0
                ? `${conteos.disponibles} programada${conteos.disponibles === 1 ? "" : "s"}`
                : "Ver solicitudes"}
            </TextoIcono>
          </TouchableOpacity>
        ) : enRuta ? (
          <TouchableOpacity
            onPress={volverAMiRuta}
            style={[styles.btnFlotante, styles.btnMiRuta]}
            activeOpacity={0.8}
          >
            <TextoIcono
              icono="arrow-back"
              style={[styles.btnBackText, styles.btnMiRutaTexto]}
            >
              Mi ruta
            </TextoIcono>
          </TouchableOpacity>
        ) : (
          renderInterruptorDisponible(true)
        )}

        {!servicioRuta && (
          <View style={styles.grupoBotones}>
            <TouchableOpacity
              onPress={volverAModoUsuario}
              style={styles.btnFlotante}
              activeOpacity={0.8}
              accessibilityLabel="Volver a modo usuario"
            >
              <TextoIcono icono="swap-horizontal" style={styles.btnBackText}>
                Usuario
              </TextoIcono>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => irALista()}
              style={styles.btnFlotante}
              activeOpacity={0.8}
            >
              <TextoIcono icono="menu" style={styles.btnBackText}>
                Lista
              </TextoIcono>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* En ruta, el aviso de una programada nueva va arriba para no tapar la ruta. */}
      {servicioRuta && avisoNueva && renderAvisoNueva(avisoNueva, true)}

      {servicioRuta ? (
        renderPanelRuta(servicioRuta)
      ) : seleccionado ? (
        renderPanelSeleccionado(seleccionado)
      ) : avisoNueva ? (
        renderAvisoNueva(avisoNueva, false)
      ) : (
        !loading && (
          <View style={[styles.panelInferior, styles.panelAyuda]}>
            <Text style={styles.textoAyuda}>
              {enRuta
                ? "Tienes un servicio en curso: solo puedes aceptar solicitudes programadas. "
                : ""}
              {`${conteos.disponibles} solicitud${conteos.disponibles === 1 ? "" : "es"} disponible${conteos.disponibles === 1 ? "" : "s"}. `}
              {marcadores.length
                ? "Toca un pin para ver la solicitud."
                : "No hay solicitudes con ubicación en el mapa."}
              {sinUbicacion > 0
                ? ` ${sinUbicacion} sin ubicación exacta: míralas en la lista.`
                : ""}
            </Text>
            {conteos.aceptadas > 0 && (
              <TouchableOpacity
                onPress={() => irALista("aceptadas")}
                style={styles.btnAceptadas}
                activeOpacity={0.8}
              >
                <TextoIcono
                  icono="chevron-forward"
                  alFinal
                  style={styles.btnPrimarioText}
                >
                  Tienes {conteos.aceptadas} aceptada
                  {conteos.aceptadas === 1 ? "" : "s"}
                </TextoIcono>
              </TouchableOpacity>
            )}
          </View>
        )
      )}
    </>
  );

  // ---------- Render: vista de lista ----------
  const renderAccion = (item: SolicitudServicioDTO) => {
    const procesando = procesandoId === item.id;

    if (seccion === "disponibles") {
      return (
        <TouchableOpacity
          onPress={() => handleAceptar(item)}
          style={styles.btnAceptar}
          activeOpacity={0.7}
          disabled={procesando}
        >
          {procesando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <TextoIcono icono="checkmark" style={styles.btnAceptarText}>
              Aceptar
            </TextoIcono>
          )}
        </TouchableOpacity>
      );
    }

    // Aceptadas: si ya inició, solo se puede ver la ruta.
    if (estaIniciado(item)) {
      return (
        <TouchableOpacity
          onPress={() => verRuta(item)}
          style={styles.btnAceptar}
          activeOpacity={0.7}
        >
          <TextoIcono icono="chevron-forward" alFinal style={styles.btnAceptarText}>
            Ver ruta
          </TextoIcono>
        </TouchableOpacity>
      );
    }

    // Programado sin iniciar: iniciar (cuando quiera) o cancelar (48 h antes).
    const bloqueado = !puedeCancelar(item, ahora);
    return (
      <View style={styles.accionesColumna}>
        <TouchableOpacity
          onPress={() => handleIniciar(item)}
          style={styles.btnAceptar}
          activeOpacity={0.7}
          disabled={procesando}
        >
          <TextoIcono icono="play" style={styles.btnAceptarText}>
            Iniciar
          </TextoIcono>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleCancelar(item)}
          style={[styles.btnCancelar, bloqueado && styles.btnBloqueado]}
          activeOpacity={0.7}
          disabled={procesando || bloqueado}
          accessibilityState={{ disabled: procesando || bloqueado }}
        >
          {procesando ? (
            <ActivityIndicator size="small" color={p.textoError} />
          ) : (
            <TextoIcono
              icono={bloqueado ? "lock-closed-outline" : "close"}
              style={[styles.btnCancelarText, bloqueado && styles.btnBloqueadoText]}
            >
              Cancelar
            </TextoIcono>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderTarjeta = (
    item: SolicitudServicioDTO,
    clave: string,
    historialItem?: ItemHistorial,
  ) => {
    const inmediato = esInmediato(item);
    const procesando = procesandoId === item.id;
    const bloqueado =
      seccion === "aceptadas" &&
      item.estado === "aceptada" &&
      !estaIniciado(item) &&
      !puedeCancelar(item, ahora);
    // Los datos de contacto solo se muestran a quien aceptó la solicitud.
    const mostrarContacto = seccion !== "disponibles";

    return (
      <View key={clave} style={[styles.cardService, procesando && { opacity: 0.5 }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTypeBadge} numberOfLines={1}>
            {item.tipoServicio}
          </Text>
          {estaIniciado(item) && seccion === "aceptadas" ? (
            <View style={[styles.statusChip, styles.chipAceptada]}>
              <TextoIcono
                icono="navigate-outline"
                style={[styles.statusChipText, { color: p.textoExito2 }]}
              >
                {item.estado === "en_curso" ? "Hacia la entrega" : "Hacia la recogida"}
              </TextoIcono>
            </View>
          ) : (
            <View
              style={[
                styles.statusChip,
                inmediato ? styles.chipImmediate : styles.chipScheduled,
              ]}
            >
              <TextoIcono
                icono={inmediato ? "flash" : "calendar-outline"}
                style={[styles.statusChipText, { color: inmediato ? p.textoAviso : p.azulTexto }]}
              >
                {inmediato ? "Inmediato" : item.fechaProgramada}
              </TextoIcono>
            </View>
          )}
        </View>

        <Ruta origen={item.origen} destino={item.destino} />

        {etiquetasCarga(item).length > 0 && (
          <View style={styles.cargaBadges}>
            {etiquetasCarga(item).map((etiqueta) => (
              <View key={etiqueta} style={styles.cargaBadge}>
                <Text style={styles.cargaBadgeText}>{etiqueta}</Text>
              </View>
            ))}
          </View>
        )}

        {item.descripcion ? (
          <View style={styles.descBox}>
            <Text style={styles.descLabel}>DETALLE</Text>
            <Text style={styles.cardDesc}>
              {item.descripcion}
            </Text>
          </View>
        ) : null}

        <DetalleTarifaSolicitud item={item} />
        <ResumenPagoTransportista item={item} />
        {miUbicacion && item.origenCoords && seccion === "disponibles" ? (
          <Text style={styles.distanciaSolicitud}>
            A {textoKm(distanciaKm(miUbicacion, item.origenCoords))} de ti
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.contactInfo}>
            {mostrarContacto ? (
              <>
                <TextoIcono
                  icono="person-outline"
                  style={styles.contactName}
                  numberOfLines={1}
                >
                  {item.nombreContacto}
                </TextoIcono>
                {item.telefonoContacto ? (
                  <TextoIcono
                    icono="call-outline"
                    style={styles.contactPhone}
                    numberOfLines={1}
                  >
                    {item.telefonoContacto}
                  </TextoIcono>
                ) : null}
              </>
            ) : (
              <>
                <TextoCalificacion
                  style={styles.calificacionCliente}
                  prefijo="Cliente: "
                  calificacion={item.cliente?.calificacion}
                />
                <Text style={styles.createdAt}>
                  Verás los datos de contacto al aceptar.
                </Text>
              </>
            )}
            {!!historialItem?.motivo && (
              <Text style={styles.motivoHistorial}>
                Motivo: {historialItem.motivo}
              </Text>
            )}
            <Text style={styles.createdAt}>
              {historialItem
                ? `${TEXTO_HISTORIAL[historialItem.tipo].fecha} el ${formatearFecha(historialItem.fecha)}`
                : item.aceptadaEl && seccion === "aceptadas"
                  ? `Aceptada el ${formatearFecha(item.aceptadaEl)}`
                  : item.fecha
                    ? `Creada el ${formatearFecha(item.fecha)}`
                    : ""}
            </Text>
          </View>

          {historialItem?.tipo === "completada" &&
          uid &&
          !item.calificadoPor?.includes(uid) ? (
            <TouchableOpacity
              onPress={() => setCalificandoId(item.id ?? null)}
              style={styles.btnCalificar}
              activeOpacity={0.8}
            >
              <TextoIcono icono="star" style={styles.btnCalificarText}>
                Calificar cliente
              </TextoIcono>
            </TouchableOpacity>
          ) : historialItem ? (
            <View
              style={[
                styles.statusChip,
                historialItem.tipo === "completada"
                  ? styles.chipAceptada
                  : styles.chipCancelada,
              ]}
            >
              <TextoIcono
                icono={TEXTO_HISTORIAL[historialItem.tipo].icono}
                style={[
                  styles.statusChipText,
                  {
                    color:
                      historialItem.tipo === "completada" ? p.textoExito2 : p.textoError,
                  },
                ]}
              >
                {TEXTO_HISTORIAL[historialItem.tipo].chip}
              </TextoIcono>
            </View>
          ) : (
            renderAccion(item)
          )}
        </View>

        {bloqueado && (
          <Text style={styles.textoBloqueo}>
            Faltan menos de {HORAS_MINIMAS_CANCELACION} horas para el servicio:
            ya no se puede cancelar.
          </Text>
        )}
      </View>
    );
  };

  // Cuenta condicionada o con advertencias: aviso fijo arriba de la lista.
  const renderAvisoDisciplina = () => {
    const e = estadoConductor;
    if (!e || (!e.condicionado && e.advertencias === 0)) return null;
    let texto: string;
    if (e.condicionado) {
      const faltanViajes = Math.max(0, e.viajesRequeridos - e.viajesCondicion);
      const libreEl = e.condicionDesde
        ? new Date(new Date(e.condicionDesde).getTime() + e.diasRequeridos * 86400000)
        : null;
      const faltanDias = libreEl
        ? Math.max(0, Math.ceil((libreEl.getTime() - ahora.getTime()) / 86400000))
        : e.diasRequeridos;
      const pendientes = [
        faltanDias > 0 ? `${faltanDias} día${faltanDias === 1 ? "" : "s"}` : null,
        faltanViajes > 0 ? `${faltanViajes} viaje${faltanViajes === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      texto =
        "Si recibes otra queja de daño confirmada, la sanción será más fuerte." +
        (pendientes.length
          ? ` La condición se quita en ${pendientes.join(" y ")} sin quejas.`
          : "");
    } else {
      texto = `Llevas ${e.advertencias} de 3 advertencias por daños mínimos. Al llegar a 3, tu cuenta se suspende 5 días.`;
    }
    return (
      <View style={styles.avisoDisciplina}>
        <Icono nombre="alert-circle" tamano={20} color="#fbbf24" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.avisoDisciplinaTitulo}>
            {e.condicionado ? "Cuenta condicionada" : "Advertencias"}
          </Text>
          <Text style={styles.avisoDisciplinaTexto}>{texto}</Text>
        </View>
      </View>
    );
  };

  const renderVistaLista = () => {
    const vacio = VACIOS[seccion];
    const elementos =
      seccion === "historial"
        ? historial.map((h, i) =>
            renderTarjeta(h.servicio, `${h.tipo}-${h.servicio.id}-${i}`, h),
          )
        : (seccion === "disponibles" ? disponiblesVisibles : datos.asignadas).map(
            (s, i) => renderTarjeta(s, s.id || String(i)),
          );

    return (
      <ScrollView
        role="tabpanel"
        accessibilityLabelledBy={`transportista-tab-${seccion}`}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AZUL} />
        }
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => irAlMapa()}
            style={styles.btnBack}
            activeOpacity={0.8}
          >
            <TextoIcono icono="arrow-back" style={styles.btnBackText}>
              Ver mapa
            </TextoIcono>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={volverAModoUsuario}
            style={styles.chipModo}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Volver a modo usuario"
          >
            <View style={styles.puntoModo} />
            <TextoIcono
              icono="swap-horizontal"
              alFinal
              style={styles.chipModoText}
            >
              Transportista · Usuario
            </TextoIcono>
          </TouchableOpacity>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.subtitleHeader}>PANEL TRANSPORTISTA</Text>
          <Text style={styles.titleHeader}>
            Solicitudes de <Text style={styles.titleHighlight}>servicio</Text>
          </Text>
        </View>

        {renderAvisoDisciplina()}

        {renderInterruptorDisponible(false)}

        <View style={styles.tarjetaAyudantes}>
          <View style={styles.ayudantesTexto}>
            <Text style={styles.ayudantesTitulo}>Cuento con ayudantes</Text>
            <Text style={styles.ayudantesDescripcion}>
              {cuentaConAyudantes
                ? "Ves todas las solicitudes, también las que piden ayudantes"
                : "Solo ves solicitudes que no piden ayudantes"}
            </Text>
          </View>

          <Pressable
            onPress={handleAyudantes}
            accessibilityRole="switch"
            accessibilityState={{ checked: cuentaConAyudantes }}
            accessibilityLabel="Cuento con ayudantes"
            style={[styles.interruptor, cuentaConAyudantes && styles.interruptorActivo]}
          >
            <View
              style={[
                styles.interruptorPunto,
                cuentaConAyudantes && styles.interruptorPuntoActivo,
              ]}
            />
          </Pressable>
        </View>

        <View
          style={styles.segmentos}
          accessibilityRole="tablist"
          accessibilityLabel="Secciones de solicitudes del transportista"
        >
          {SECCIONES.map((s) => {
            const activa = seccion === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSeccion(s.id)}
                style={[styles.segmento, activa && styles.segmentoActivo]}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                accessibilityLabel={`${s.titulo}, ${conteos[s.id]} solicitudes`}
                accessibilityHint={`Muestra las solicitudes ${s.titulo.toLowerCase()}.`}
              >
                <Text
                  nativeID={`transportista-tab-${s.id}`}
                  style={[styles.segmentoText, activa && styles.segmentoTextActivo]}
                >
                  {s.titulo} ({conteos[s.id]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {seccion === "aceptadas" && conteos.aceptadas > 0 && (
          <Text style={styles.notaCancelacion}>
            Solo puedes cancelar con al menos {HORAS_MINIMAS_CANCELACION} horas de
            anticipación al servicio.
          </Text>
        )}

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={AZUL} />
          </View>
        ) : elementos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icono
              nombre="car-outline"
              tamano={44}
              color={p.textoAlfa(0.7)}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>{vacio.titulo}</Text>
            <Text style={styles.emptyText}>{vacio.texto}</Text>
          </View>
        ) : (
          elementos
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={p.barraEstado} backgroundColor={p.fondo} />

      <View style={styles.mainContainer}>
        {vista === "mapa" ? renderVistaMapa() : renderVistaLista()}

        {/* En la ruta se oculta la barra para dar espacio al panel. */}
        {!(vista === "mapa" && servicioRuta) && <BarraNavegacion />}

        <MensajeTemporal
          mensaje={mensaje}
          alTerminar={ocultarMensaje}
          tipo="exito"
        />

        {vista === "lista" && !!nuevaSolicitud && (
          <Pressable
            onPress={verNuevaSolicitud}
            accessibilityRole="button"
            accessibilityLabel={`Nueva solicitud de ${nuevaSolicitud.tipoServicio}: ${nuevaSolicitud.origen} a ${nuevaSolicitud.destino}. Ver solicitud.`}
            accessibilityHint="Abre los detalles para revisar y decidir si aceptarla."
            accessibilityLiveRegion="polite"
            aria-live="polite"
            style={({ pressed }) => [styles.avisoNueva, pressed && { opacity: 0.85 }]}
          >
            <TextoIcono
              icono="notifications"
              style={styles.avisoNuevaTexto}
              numberOfLines={2}
            >
              Nueva solicitud: {nuevaSolicitud.tipoServicio}{" "}
              {esInmediato(nuevaSolicitud)
                ? "inmediata"
                : `programada · ${nuevaSolicitud.fechaProgramada}`}
            </TextoIcono>
            <TextoIcono icono="chevron-forward" alFinal style={styles.avisoNuevaVer}>
              Ver
            </TextoIcono>
          </Pressable>
        )}

        <EvidenciaRecogida
          key={recogiendo?.item.id ?? "cerrado"}
          fotosIniciales={recogiendo?.fotos ?? null}
          onCerrar={() => setRecogiendo(null)}
          onConfirmar={confirmarRecogida}
        />

        <MotivoCancelacion
          visible={!!cancelando}
          rol="conductor"
          onCerrar={() => setCancelando(null)}
          onConfirmar={confirmarCancelacion}
        />

        <CalificarServicio
          servicioId={calificandoId}
          rol="transportista"
          nombreCalificado={
            datos.completadas.find((s) => s.id === calificandoId)?.nombreContacto ?? ""
          }
          onCerrar={() => setCalificandoId(null)}
          onEnviado={async () => {
            setCalificandoId(null);
            cargarDatos();
            await aviso("¡Gracias!", "Tu calificación quedó guardada.", "exito");
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// ---------- Piezas pequeñas ----------
function Ruta({
  origen,
  destino,
  compacta = false,
}: {
  origen: string;
  destino: string;
  compacta?: boolean;
}) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={[styles.routeContainer, compacta && styles.routeCompacta]}>
      <View style={styles.timelineCol}>
        <View style={[styles.dot, { backgroundColor: AZUL }]} />
        <View style={styles.timelineLine} />
        <View style={[styles.dot, { backgroundColor: "#72BFCB" }]} />
      </View>
      <View style={styles.routeTexts}>
        <View style={styles.routeBlock}>
          <Text style={styles.routeLabel}>RECOGIDA</Text>
          <Text style={styles.routeValue}>
            {origen}
          </Text>
        </View>
        <View style={styles.routeBlock}>
          <Text style={styles.routeLabel}>ENTREGA</Text>
          <Text style={styles.routeValue}>
            {destino}
          </Text>
        </View>
      </View>
    </View>
  );
}

function etiquetasCarga(item: SolicitudServicioDTO): string[] {
  if (item.tipoServicio === "Trasteo" || item.tipoServicio === "Mudanza") {
    return [
      item.articulosFragiles ? "Carga Frágil" : null,
      item.objetosExtrapesados ? "Extrapesado" : null,
    ].filter((v): v is string => !!v);
  }
  if (item.tipoCarga === "fragil") return ["Carga Frágil"];
  if (item.tipoCarga === "extrapesado") return ["Extrapesado"];
  return [];
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  avisoDisciplina: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    backgroundColor: "rgba(251,191,36,0.10)",
    marginBottom: 12,
  },
  avisoDisciplinaTitulo: { color: p.textoAviso, fontWeight: "800", fontSize: 14 },
  avisoDisciplinaTexto: { color: p.textoSuave, fontSize: 12, lineHeight: 17 },
  safeArea: { flex: 1, backgroundColor: p.fondo },
  mainContainer: { flex: 1, backgroundColor: p.fondo },
  container: { flex: 1, backgroundColor: p.fondo },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90,
  },

  // Mapa: elementos flotantes
  filaChipCerrar: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnCerrarX: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.velo(0.1),
  },
  btnRechazar: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.55)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  btnRechazarText: { color: p.textoError, fontWeight: "800", fontSize: 13 },
  avisoNuevaTarjeta: {
    borderColor: "rgba(41,105,233,0.75)",
    gap: 4,
  },
  avisoArriba: { top: 64, bottom: undefined },
  avisoEtiqueta: {
    color: p.acento,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  avisoTitulo: { color: p.texto, fontSize: 16, fontWeight: "900" },
  avisoRuta: { color: p.textoSuave, fontSize: 13 },
  avisoDatos: { color: p.textoExito3, fontSize: 14, fontWeight: "800" },
  filaAvisoBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  btnVerSolicitud: {
    paddingHorizontal: 18,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
  },
  btnMiRuta: {
    backgroundColor: p.rellenoExito,
    borderColor: "rgba(134,232,189,0.7)",
  },
  avisoNueva: {
    position: "absolute",
    top: 64,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2969e9",
    borderWidth: 1,
    borderColor: p.linea(0.35),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  avisoNuevaTexto: { flex: 1, color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  avisoNuevaVer: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  chipDisponible: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: p.panel(0.92),
    borderWidth: 1,
    borderColor: p.linea(0.18),
  },
  tarjetaDisponible: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.13),
    backgroundColor: p.velo(0.045),
    marginBottom: 12,
  },
  disponibleActivo: {
    borderColor: "rgba(80,220,164,0.55)",
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  interruptorDisponible: {
    backgroundColor: "rgba(16,185,129,0.85)",
    borderColor: "rgba(134,232,189,0.65)",
  },
  motivoHistorial: {
    color: p.textoAlfa(0.7),
    fontSize: 12,
    marginTop: 4,
  },
  barraFlotante: {
    position: "absolute",
    top: 12,
    left: 20,
    right: 20,
    zIndex: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grupoBotones: { flexDirection: "row", gap: 8 },
  btnFlotante: {
    backgroundColor: p.panel(0.92),
    borderWidth: 1,
    borderColor: p.linea(0.18),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  panelInferior: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 96,
    zIndex: 4,
    padding: 16,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.2),
    backgroundColor: p.panel(0.96),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  panelRuta: { bottom: 16 },
  panelAyuda: { gap: 10 },
  textoAyuda: { color: p.textoAlfa(0.75), fontSize: 13, lineHeight: 18 },
  btnAceptadas: {
    backgroundColor: AZUL,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  distancia: {
    color: p.acento,
    fontSize: 12,
    fontWeight: "800",
    marginTop: -6,
    marginBottom: 10,
  },
  botonesPanel: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnSecundario: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.velo(0.1),
  },
  btnSecundarioText: { color: p.texto, fontWeight: "700", fontSize: 13 },
  btnPrimario: {
    flex: 2,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AZUL,
  },
  btnPrimarioText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  filaFase: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  faseChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(41,105,233,0.18)",
    borderWidth: 1,
    borderColor: "rgba(41,105,233,0.45)",
  },
  faseChipActiva: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderColor: "rgba(16,185,129,0.45)",
  },
  faseTexto: { color: p.texto, fontSize: 11, fontWeight: "800" },
  infoRuta: { color: p.acento, fontSize: 12, fontWeight: "800" },
  tituloRuta: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  direccionRuta: {
    color: p.texto,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  contactoRuta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: p.linea(0.1),
    gap: 10,
  },
  calificacionCliente: {
    color: p.textoAviso,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  btnCalificar: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
  },
  btnCalificarText: { color: "#1a1300", fontSize: 12, fontWeight: "900" },
  accionesColumna: { gap: 8 },

  // Barra superior
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  btnBack: {
    backgroundColor: p.velo(0.1),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnBackText: { color: p.texto, fontWeight: "700", fontSize: 13 },
  // "Mi ruta" va sobre el verde sólido: texto blanco.
  btnMiRutaTexto: { color: "#FFFFFF" },
  chipModo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: p.panel(0.92),
    borderWidth: 1,
    borderColor: "rgba(80,220,164,0.35)",
  },
  puntoModo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50DCA4",
  },
  chipModoText: { color: p.textoExito2, fontSize: 12, fontWeight: "800" },

  // Encabezado
  headerContainer: { marginBottom: 20 },
  subtitleHeader: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: p.textoTitulo,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
    textShadowColor: p.sombraTexto(0.65),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  titleHighlight: { color: AZUL },

  // Ayudantes (mismo estilo que la tarjeta de preferencias del perfil)
  tarjetaAyudantes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.13),
    backgroundColor: p.velo(0.045),
    marginBottom: 16,
  },
  ayudantesTexto: { flex: 1, gap: 6 },
  ayudantesTitulo: { color: p.textoFuerte2, fontSize: 12, fontWeight: "700" },
  ayudantesDescripcion: { color: p.textoTenue, fontSize: 10, lineHeight: 15 },
  interruptor: {
    width: 44,
    height: 25,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
    backgroundColor: p.interruptor,
    borderWidth: 1,
    borderColor: p.linea(0.12),
  },
  interruptorActivo: {
    backgroundColor: "rgba(41,105,233,0.85)",
    borderColor: "rgba(141,178,255,0.65)",
  },
  interruptorPunto: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: p.interruptorPunto,
  },
  interruptorPuntoActivo: {
    alignSelf: "flex-end",
    backgroundColor: "#FFFFFF",
  },

  // Secciones
  segmentos: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.linea(0.1),
    backgroundColor: p.velo(0.04),
    marginBottom: 16,
  },
  segmento: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 12,
  },
  segmentoActivo: { backgroundColor: AZUL },
  segmentoText: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    fontWeight: "700",
  },
  segmentoTextActivo: { color: "#FFFFFF", fontWeight: "800" },
  notaCancelacion: {
    color: p.textoTenue2,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
  },

  loaderContainer: { marginTop: 50, alignItems: "center" },

  // Estado vacío
  emptyContainer: {
    marginTop: 10,
    alignItems: "center",
    backgroundColor: p.panel(0.94),
    padding: 28,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.2),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  emptyIcon: { marginBottom: 10 },
  emptyTitle: {
    color: p.texto,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: p.textoAlfa(0.6),
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  // Tarjeta
  cardService: {
    backgroundColor: p.panel(0.94),
    borderRadius: 19,
    borderWidth: 1,
    borderColor: p.linea(0.15),
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  cardTypeBadge: {
    flexShrink: 1,
    color: "#FFFFFF",
    backgroundColor: AZUL,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    fontWeight: "800",
    fontSize: 12,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipImmediate: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.4)",
  },
  chipScheduled: {
    backgroundColor: "rgba(41,105,233,0.12)",
    borderColor: "rgba(41,105,233,0.4)",
  },
  chipAceptada: {
    backgroundColor: "rgba(80,220,164,0.10)",
    borderColor: "rgba(80,220,164,0.35)",
  },
  chipCancelada: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.4)",
  },
  statusChipText: { fontSize: 11, fontWeight: "700" },

  // Ruta
  routeContainer: {
    flexDirection: "row",
    backgroundColor: p.velo(0.03),
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.linea(0.08),
    marginBottom: 12,
  },
  routeCompacta: { padding: 10, marginBottom: 10 },
  timelineCol: { alignItems: "center", marginRight: 12, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: p.velo(0.15),
    marginVertical: 4,
  },
  routeTexts: { flex: 1 },
  routeBlock: { marginBottom: 10 },
  routeLabel: {
    color: p.textoAlfa(0.6),
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeValue: { color: p.texto, fontSize: 14, fontWeight: "700" },

  // Detalle
  descBox: { marginBottom: 12 },
  descLabel: {
    color: p.textoAlfa(0.6),
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardDesc: { color: p.textoSuave, fontSize: 13, lineHeight: 18 },
  cargaBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  cargaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.acento,
    backgroundColor: p.velo(0.05),
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cargaBadgeText: { color: p.acento, fontSize: 11, fontWeight: "800" },

  distanciaSolicitud: {
    color: p.textoAlfa(0.6),
    fontSize: 11,
    marginTop: -8,
    marginBottom: 14,
  },

  // Pie
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: p.linea(0.1),
    paddingTop: 12,
    gap: 10,
  },
  contactInfo: { flex: 1 },
  contactName: { color: p.texto, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  contactPhone: {
    color: p.azulTexto,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  createdAt: { color: p.textoAlfa(0.5), fontSize: 11, marginTop: 4 },

  // Acciones
  btnAceptar: {
    backgroundColor: AZUL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAceptarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  btnCancelar: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancelarText: { color: p.textoError, fontSize: 12, fontWeight: "800" },
  btnBloqueado: {
    backgroundColor: p.velo(0.05),
    borderColor: p.linea(0.12),
  },
  btnBloqueadoText: { color: p.textoAlfa(0.35) },
  textoBloqueo: {
    color: p.textoAlfa(0.5),
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
});
