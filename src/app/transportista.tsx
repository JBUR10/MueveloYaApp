// src/app/transportista.tsx
// Panel del modo transportista:
//  - Mapa: las solicitudes disponibles como pines; al tocar uno sube una
//    tarjeta y se dibuja la ruta de A a B con un camión que la recorre.
//  - Lista: disponibles, aceptadas e historial.
//  - Ruta: al iniciar el servicio (inmediatos: al aceptar; programados: con
//    "Iniciar"), ruta de mi ubicación a la recogida (A) y, después de
//    "Ya recogí", de la recogida a la entrega (B).
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import { buscarLugares } from "../components/ui/BuscadorDestino";
import CalificarServicio from "../components/ui/CalificarServicio";
import MapaPrincipal, {
  Coordenadas,
  InfoRuta,
  MarcadorMapa,
} from "../components/ui/MapaPrincipal";
import MensajeTemporal from "../components/ui/MensajeTemporal";
import {
  marcarDisponiblesVistas,
  mostrarAvisosPendientes,
} from "../services/avisosStore";
import {
  cambiarCuentaConAyudantes,
  cambiarModo,
  useModo,
} from "../services/modoStore";
import {
  escucharCambiosServicios,
  SolicitudServicioDTO,
  textoCalificacion,
} from "../services/servicioService";
import { useSesion } from "../services/sesionStore";
import {
  aceptarSolicitud,
  cancelarSolicitud,
  completarServicio,
  DatosTransportista,
  esInmediato,
  estaIniciado,
  HORAS_MINIMAS_CANCELACION,
  iniciarServicio,
  marcarRecogido,
  obtenerDatosTransportista,
  puedeCancelar,
} from "../services/transportistaService";
import { obtenerMiVehiculo, revisarDocumentos } from "../services/vehiculoService";

const AZUL = "#2969e9";
const FONDO = "#111318";

/** Respaldo del tiempo real: las solicitudes que toma otro transportista
 *  dejan de ser visibles y Supabase no avisa de eso. */
const RECARGA_MS = 30_000;

type Vista = "mapa" | "lista";
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
};

const TEXTO_HISTORIAL: Record<ItemHistorial["tipo"], { chip: string; fecha: string }> = {
  completada: { chip: "✓ Finalizada", fecha: "Finalizada" },
  cancelada: { chip: "✕ La cancelaste", fecha: "Cancelada" },
  cancelada_cliente: { chip: "✕ Canceló el cliente", fecha: "Cancelada" },
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
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

const llamar = (telefono: string) =>
  Linking.openURL(`tel:${telefono.replace(/\s/g, "")}`).catch(() =>
    aviso("Error", "No se pudo iniciar la llamada.", "error"),
  );

export default function TransportistaScreen() {
  const router = useRouter();
  const { cuentaConAyudantes } = useModo();
  const uid = useSesion().sesion?.user.id;
  const [calificandoId, setCalificandoId] = useState<string | null>(null);

  const [datos, setDatos] = useState<DatosTransportista>(DATOS_VACIOS);
  const [vista, setVista] = useState<Vista>("mapa");
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

      return () => {
        activo = false;
        dejarDeEscuchar();
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
        })),
        ...datos.canceladasPorCliente.map((s) => ({
          servicio: s,
          tipo: "cancelada_cliente" as const,
          fecha: s.canceladaEl ?? "",
        })),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [datos],
  );

  const conteos: Record<Seccion, number> = {
    disponibles: datos.disponibles.length,
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
    datos.disponibles.find((s) => s.id === seleccionadoId) ?? null;
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
        : datos.disponibles
            .filter((s) => s.id && s.origenCoords)
            .map((s) => ({
              id: s.id!,
              lat: s.origenCoords!.lat,
              lng: s.origenCoords!.lng,
              letra: s.tipoServicio.charAt(0).toUpperCase(),
              inmediato: esInmediato(s),
            })),
    [datos.disponibles, servicioRuta],
  );
  const sinUbicacion = datos.disponibles.length - marcadores.length;

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

  // ---------- Acciones ----------
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
        ? "¿Confirmas que ahora cuentas con ayudantes para tus servicios?"
        : "¿Confirmas que ya no cuentas con ayudantes para tus servicios?",
      textoAceptar: "Confirmar",
      tipo: "info",
    });
    if (!ok) return;

    await cambiarCuentaConAyudantes(nuevoValor);
    setMensaje(
      nuevoValor ? "Ahora cuentas con ayudantes" : "Ahora trabajas sin ayudantes",
    );
  };

  const handleAceptar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;

    const programado = !esInmediato(item);
    const sinCancelacion = !puedeCancelar(item);
    const ok = await confirmar({
      titulo: "Aceptar solicitud",
      mensaje: !programado
        ? "Es un servicio inmediato: al aceptarlo verás la ruta al punto de recogida y no podrás cancelarlo."
        : sinCancelacion
          ? `Faltan menos de ${HORAS_MINIMAS_CANCELACION} horas para este servicio. Si lo aceptas no podrás cancelarlo.`
          : `Lo iniciarás desde «Aceptadas» cuando vayas a salir. Podrás cancelarlo hasta ${HORAS_MINIMAS_CANCELACION} horas antes.`,
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

      setRutaId(item.id);
      setVista("mapa");
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
      setRutaId(item.id);
      setVista("mapa");
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

    const ok = await confirmar({
      titulo: "Cancelar solicitud",
      mensaje:
        "¿Seguro que deseas cancelar este servicio? Volverá a estar disponible para otros transportistas.",
      textoAceptar: "Cancelar servicio",
      textoCancelar: "Volver",
      destructivo: true,
    });
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      await cancelarSolicitud(item);
      if (rutaId === item.id) setRutaId(null);
      await cargarDatos();
      setMensaje("Solicitud cancelada");
    } catch (error: any) {
      await aviso("Error", error?.message || "No se pudo cancelar la solicitud.", "error");
    } finally {
      setProcesandoId(null);
    }
  };

  const handleRecogido = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    const ok = await confirmar({
      titulo: "¿Ya recogiste la carga?",
      mensaje: "Se mostrará la ruta hasta el punto de entrega y el cliente verá que vas en camino.",
      textoAceptar: "Sí, ya recogí",
      textoCancelar: "Aún no",
      tipo: "info",
    });
    if (!ok) return;

    try {
      setProcesandoId(item.id);
      await marcarRecogido(item.id);
      await cargarDatos();
      setMensaje("Rumbo al punto de entrega");
    } catch (error: any) {
      await aviso("Error", error?.message || "No se pudo actualizar.", "error");
    } finally {
      setProcesandoId(null);
    }
  };

  const handleFinalizar = async (item: SolicitudServicioDTO) => {
    if (!item.id) return;
    const ok = await confirmar({
      titulo: "Finalizar servicio",
      mensaje: "¿Confirmas que entregaste la carga en el destino?",
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
        "¡Servicio finalizado! 🎉",
        "Buen trabajo. Ahora cuéntanos cómo te fue con el cliente.",
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
    if (!item.id) return;
    setRutaId(item.id);
    setVista("mapa");
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
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTypeBadge} numberOfLines={1}>
            {item.tipoServicio}
          </Text>
          <View
            style={[
              styles.statusChip,
              inmediato ? styles.chipImmediate : styles.chipScheduled,
            ]}
          >
            <Text
              style={[styles.statusChipText, { color: inmediato ? "#fbbf24" : AZUL }]}
            >
              {inmediato ? "⚡ Inmediato" : `📅 ${item.fechaProgramada}`}
            </Text>
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
        <Text style={styles.calificacionCliente}>
          Cliente: {textoCalificacion(item.cliente?.calificacion)}
        </Text>

        <Ruta origen={item.origen} destino={item.destino} compacta />

        <View style={styles.metricsRow}>
          <Metrica valor={item.ayudantes} etiqueta="Ayudantes" />
          <View style={styles.metricDivider} />
          <Metrica valor={item.pisosEscaleras} etiqueta="Pisos" />
        </View>

        {item.descripcion ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.descripcion}
          </Text>
        ) : null}

        <View style={styles.botonesPanel}>
          <TouchableOpacity
            style={styles.btnSecundario}
            onPress={() => setSeleccionadoId(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecundarioText}>Cerrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnPrimario}
            onPress={() => handleAceptar(item)}
            disabled={procesando}
            activeOpacity={0.8}
          >
            {procesando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnPrimarioText}>✓ Aceptar solicitud</Text>
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
        <Text style={styles.direccionRuta} numberOfLines={2}>
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

        <View style={styles.contactoRuta}>
          <Text style={styles.contactName} numberOfLines={1}>
            👤 {item.nombreContacto}
          </Text>
          {item.telefonoContacto ? (
            <TouchableOpacity onPress={() => llamar(item.telefonoContacto)}>
              <Text style={styles.contactPhone}>📞 Llamar</Text>
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
              <Text style={styles.btnPrimarioText}>
                {enCurso ? "✓ Finalizar servicio" : "📦 Ya recogí la carga"}
              </Text>
            )}
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
          <TouchableOpacity
            onPress={() => setRutaId(null)}
            style={styles.btnFlotante}
            activeOpacity={0.8}
          >
            <Text style={styles.btnBackText}>← Solicitudes</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.chipModo}>
            <View style={styles.puntoModo} />
            <Text style={styles.chipModoText}>
              {loading ? "Cargando…" : `${conteos.disponibles} disponibles`}
            </Text>
          </View>
        )}

        {!servicioRuta && (
          <View style={styles.grupoBotones}>
            <TouchableOpacity
              onPress={volverAModoUsuario}
              style={styles.btnFlotante}
              activeOpacity={0.8}
              accessibilityLabel="Volver a modo usuario"
            >
              <Text style={styles.btnBackText}>⇄ Usuario</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setVista("lista")}
              style={styles.btnFlotante}
              activeOpacity={0.8}
            >
              <Text style={styles.btnBackText}>☰ Lista</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {servicioRuta ? (
        renderPanelRuta(servicioRuta)
      ) : seleccionado ? (
        renderPanelSeleccionado(seleccionado)
      ) : (
        !loading && (
          <View style={[styles.panelInferior, styles.panelAyuda]}>
            <Text style={styles.textoAyuda}>
              {marcadores.length
                ? "Toca un pin para ver la solicitud."
                : "No hay solicitudes con ubicación en el mapa."}
              {sinUbicacion > 0
                ? ` ${sinUbicacion} sin ubicación exacta: míralas en la lista.`
                : ""}
            </Text>
            {conteos.aceptadas > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSeccion("aceptadas");
                  setVista("lista");
                }}
                style={styles.btnAceptadas}
                activeOpacity={0.8}
              >
                <Text style={styles.btnPrimarioText}>
                  Tienes {conteos.aceptadas} aceptada
                  {conteos.aceptadas === 1 ? "" : "s"} ›
                </Text>
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
            <Text style={styles.btnAceptarText}>✓ Aceptar</Text>
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
          <Text style={styles.btnAceptarText}>Ver ruta ›</Text>
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
          <Text style={styles.btnAceptarText}>▶ Iniciar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleCancelar(item)}
          style={[styles.btnCancelar, bloqueado && styles.btnBloqueado]}
          activeOpacity={0.7}
          disabled={procesando || bloqueado}
          accessibilityState={{ disabled: procesando || bloqueado }}
        >
          {procesando ? (
            <ActivityIndicator size="small" color="#fca5a5" />
          ) : (
            <Text
              style={[styles.btnCancelarText, bloqueado && styles.btnBloqueadoText]}
            >
              {bloqueado ? "🔒 Cancelar" : "✕ Cancelar"}
            </Text>
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
              <Text style={[styles.statusChipText, { color: "#86E8BD" }]}>
                🚚 {item.estado === "en_curso" ? "Hacia la entrega" : "Hacia la recogida"}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.statusChip,
                inmediato ? styles.chipImmediate : styles.chipScheduled,
              ]}
            >
              <Text
                style={[styles.statusChipText, { color: inmediato ? "#fbbf24" : AZUL }]}
              >
                {inmediato ? "⚡ Inmediato" : `📅 ${item.fechaProgramada}`}
              </Text>
            </View>
          )}
        </View>

        <Ruta origen={item.origen} destino={item.destino} />

        {item.descripcion ? (
          <View style={styles.descBox}>
            <Text style={styles.descLabel}>DETALLE</Text>
            <Text style={styles.cardDesc} numberOfLines={3}>
              {item.descripcion}
            </Text>
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          <Metrica valor={item.ayudantes} etiqueta="Ayudantes" />
          <View style={styles.metricDivider} />
          <Metrica valor={item.pisosEscaleras} etiqueta="Pisos" />
          {miUbicacion && item.origenCoords && seccion === "disponibles" ? (
            <>
              <View style={styles.metricDivider} />
              <Metrica
                valor={textoKm(distanciaKm(miUbicacion, item.origenCoords))}
                etiqueta="De ti"
              />
            </>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.contactInfo}>
            {mostrarContacto ? (
              <>
                <Text style={styles.contactName} numberOfLines={1}>
                  👤 {item.nombreContacto}
                </Text>
                {item.telefonoContacto ? (
                  <Text style={styles.contactPhone} numberOfLines={1}>
                    📞 {item.telefonoContacto}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.calificacionCliente}>
                  Cliente: {textoCalificacion(item.cliente?.calificacion)}
                </Text>
                <Text style={styles.createdAt}>
                  Verás los datos de contacto al aceptar.
                </Text>
              </>
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
              <Text style={styles.btnCalificarText}>★ Calificar cliente</Text>
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
              <Text
                style={[
                  styles.statusChipText,
                  {
                    color:
                      historialItem.tipo === "completada" ? "#86E8BD" : "#fca5a5",
                  },
                ]}
              >
                {TEXTO_HISTORIAL[historialItem.tipo].chip}
              </Text>
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

  const renderVistaLista = () => {
    const vacio = VACIOS[seccion];
    const elementos =
      seccion === "historial"
        ? historial.map((h, i) =>
            renderTarjeta(h.servicio, `${h.tipo}-${h.servicio.id}-${i}`, h),
          )
        : (seccion === "disponibles" ? datos.disponibles : datos.asignadas).map(
            (s, i) => renderTarjeta(s, s.id || String(i)),
          );

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AZUL} />
        }
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => setVista("mapa")}
            style={styles.btnBack}
            activeOpacity={0.8}
          >
            <Text style={styles.btnBackText}>← Ver mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={volverAModoUsuario}
            style={styles.chipModo}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Volver a modo usuario"
          >
            <View style={styles.puntoModo} />
            <Text style={styles.chipModoText}>Transportista · ⇄ Usuario</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.subtitleHeader}>PANEL TRANSPORTISTA</Text>
          <Text style={styles.titleHeader}>
            Solicitudes de <Text style={styles.titleHighlight}>servicio</Text>
          </Text>
        </View>

        <View style={styles.tarjetaAyudantes}>
          <View style={styles.ayudantesTexto}>
            <Text style={styles.ayudantesTitulo}>Cuento con ayudantes</Text>
            <Text style={styles.ayudantesDescripcion}>
              {cuentaConAyudantes
                ? "Ofreces ayudantes en tus servicios"
                : "Por ahora trabajas sin ayudantes"}
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

        <View style={styles.segmentos}>
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
              >
                <Text style={[styles.segmentoText, activa && styles.segmentoTextActivo]}>
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
            <Text style={styles.emptyIcon}>🚚</Text>
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
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <View style={styles.mainContainer}>
        {vista === "mapa" ? renderVistaMapa() : renderVistaLista()}

        {/* En la ruta se oculta la barra para dar espacio al panel. */}
        {!(vista === "mapa" && servicioRuta) && <BarraNavegacion />}

        <MensajeTemporal mensaje={mensaje} alTerminar={ocultarMensaje} />

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
          <Text style={styles.routeValue} numberOfLines={compacta ? 1 : 2}>
            {origen}
          </Text>
        </View>
        <View style={styles.routeBlock}>
          <Text style={styles.routeLabel}>ENTREGA</Text>
          <Text style={styles.routeValue} numberOfLines={compacta ? 1 : 2}>
            {destino}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Metrica({ valor, etiqueta }: { valor: number | string; etiqueta: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{valor}</Text>
      <Text style={styles.metricLabel}>{etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FONDO },
  mainContainer: { flex: 1, backgroundColor: FONDO },
  container: { flex: 1, backgroundColor: FONDO },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90,
  },

  // Mapa: elementos flotantes
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
    backgroundColor: "rgba(17,19,24,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
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
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(17,19,24,0.96)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  panelRuta: { bottom: 16 },
  panelAyuda: { gap: 10 },
  textoAyuda: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 18 },
  btnAceptadas: {
    backgroundColor: AZUL,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  distancia: {
    color: "#8DB2FF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: -6,
    marginBottom: 10,
  },
  botonesPanel: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnSecundario: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  btnSecundarioText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  btnPrimario: {
    flex: 2,
    height: 46,
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
  faseTexto: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  infoRuta: { color: "#8DB2FF", fontSize: 12, fontWeight: "800" },
  tituloRuta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  direccionRuta: {
    color: "#FFFFFF",
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
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  calificacionCliente: {
    color: "#fbbf24",
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
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnBackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  chipModo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(17,19,24,0.92)",
    borderWidth: 1,
    borderColor: "rgba(80,220,164,0.35)",
  },
  puntoModo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50DCA4",
  },
  chipModoText: { color: "#86E8BD", fontSize: 12, fontWeight: "800" },

  // Encabezado
  headerContainer: { marginBottom: 20 },
  subtitleHeader: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: "#eeecec",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.65)",
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
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.045)",
    marginBottom: 16,
  },
  ayudantesTexto: { flex: 1, gap: 6 },
  ayudantesTitulo: { color: "#F0F3F8", fontSize: 12, fontWeight: "700" },
  ayudantesDescripcion: { color: "#9BA7BA", fontSize: 10, lineHeight: 15 },
  interruptor: {
    width: 44,
    height: 25,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
    backgroundColor: "#353A46",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  interruptorActivo: {
    backgroundColor: "rgba(41,105,233,0.85)",
    borderColor: "rgba(141,178,255,0.65)",
  },
  interruptorPunto: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#D4D9E1",
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
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
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
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
  },
  segmentoTextActivo: { color: "#FFFFFF", fontWeight: "800" },
  notaCancelacion: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
  },

  loaderContainer: { marginTop: 50, alignItems: "center" },

  // Estado vacío
  emptyContainer: {
    marginTop: 10,
    alignItems: "center",
    backgroundColor: "rgba(17,19,24,0.94)",
    padding: 28,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  // Tarjeta
  cardService: {
    backgroundColor: "rgba(17,19,24,0.94)",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
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
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  routeCompacta: { padding: 10, marginBottom: 10 },
  timelineCol: { alignItems: "center", marginRight: 12, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 4,
  },
  routeTexts: { flex: 1 },
  routeBlock: { marginBottom: 10 },
  routeLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // Detalle
  descBox: { marginBottom: 12 },
  descLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardDesc: { color: "#E7F0F4", fontSize: 13, lineHeight: 18 },

  // Métricas
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    marginBottom: 14,
  },
  metricBox: { flex: 1, alignItems: "center" },
  metricValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  metricLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  metricDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },

  // Pie
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 12,
    gap: 10,
  },
  contactInfo: { flex: 1 },
  contactName: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", flexShrink: 1 },
  contactPhone: {
    color: AZUL,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  createdAt: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 },

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
  btnCancelarText: { color: "#fca5a5", fontSize: 12, fontWeight: "800" },
  btnBloqueado: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  btnBloqueadoText: { color: "rgba(255,255,255,0.35)" },
  textoBloqueo: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
});
