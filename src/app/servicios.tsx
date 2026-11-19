// src/app/servicios.tsx
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/Texto";
import { SafeAreaView } from "react-native-safe-area-context";
import { aviso, confirmar, TipoAlerta } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import { buscarLugares } from "../components/ui/BuscadorDestino";
import VistaPreviaRuta from "../components/ui/VistaPreviaRuta";
import { obtenerDireccion } from "../services/geocodificacion";
import { obtenerMiPerfil } from "../services/perfilService";
import TarjetaCupones from "../components/ui/TarjetaCupones";
import {
  Cupon,
  descuentoDe,
  mejorCupon,
  obtenerCuponesDisponibles,
} from "../services/cuponesService";
import { registrarServicio } from "../services/servicioService";
import {
  calcularTarifa,
  distanciaRutaKm,
  formatearPesos,
  KM_INCLUIDOS,
  PRECIO_AYUDANTE,
  PRECIO_KM_ADICIONAL,
  PRECIO_PISO,
} from "../services/tarifa";
import {
  obtenerUbicaciones,
  useUbicaciones,
  type PuntoMapa,
} from "../services/ubicacionStore";
import TextoIcono from "../components/ui/TextoIcono";
import { usePaleta, useEstilos, type Paleta } from "../services/temaStore";

type Rol = "origen" | "destino";
type Coords = { lat: number; lng: number };

/** "Cra 43A 10-50, El Poblado" -> { direccion: "Cra 43A 10-50", barrio: "El Poblado" } */
function separarDireccion(nombre: string) {
  const i = nombre.indexOf(",");
  if (i === -1) return { direccion: nombre.trim(), barrio: "" };
  return {
    direccion: nombre.slice(0, i).trim(),
    barrio: nombre.slice(i + 1).trim(),
  };
}

/** Botones para traer la ubicación del mapa o marcarla allí. */
function AccionesMapa({
  disponible,
  textoTraer,
  textoMarcar,
  tieneExacto,
  onTraer,
  onMarcar,
  onQuitar,
}: {
  disponible: PuntoMapa | null;
  textoTraer: string;
  textoMarcar: string;
  tieneExacto: boolean;
  onTraer: () => void;
  onMarcar: () => void;
  onQuitar: () => void;
}) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.accionesMapa}>
      <View style={styles.filaChips}>
        {!!disponible && (
          <TouchableOpacity
            style={[styles.chip, styles.chipAzul]}
            onPress={onTraer}
          >
            <Text style={[styles.chipTexto, styles.chipTextoAzul]}>
              {textoTraer}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.chip} onPress={onMarcar}>
          <Text style={styles.chipTexto}>{textoMarcar}</Text>
        </TouchableOpacity>
      </View>

      {!!disponible && (
        <Text style={styles.chipPista} numberOfLines={1}>
          {disponible.nombre}
        </Text>
      )}

      {tieneExacto && (
        <View style={styles.filaExacto}>
          <TextoIcono icono="checkmark-circle" style={styles.textoExacto}>
            Punto exacto del mapa guardado
          </TextoIcono>
          <TouchableOpacity onPress={onQuitar} hitSlop={10}>
            <Text style={styles.textoQuitar}>Quitar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/** Una línea del desglose del precio: "2 ayudantes × $ 25.000 .... $ 50.000". */
function FilaPrecio({ texto, valor }: { texto: string; valor: number }) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.filaPrecio}>
      <Text style={styles.textoPrecio}>{texto}</Text>
      <Text style={styles.valorPrecio}>{formatearPesos(valor)}</Text>
    </View>
  );
}

export default function ServiciosScreen() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const router = useRouter();
  const ubic = useUbicaciones();
  // ?desde=inicio cuando se llega con el botón "Solicitar servicio" del buscador.
  const { desde } = useLocalSearchParams<{ desde?: string }>();

  // Control de Pasos (Wizard Slide): 1, 2, 3, 4
  const [paso, setPaso] = useState(1);

  // Estados del Formulario
  const [tipoServicio, setTipoServicio] = useState<
    "Envío" | "Acarreo" | "Trasteo" | "Mudanza"
  >("Acarreo");
  const [origenDireccion, setOrigenDireccion] = useState("");
  const [origenBarrio, setOrigenBarrio] = useState("");
  const [destinoDireccion, setDestinoDireccion] = useState("");
  const [destinoBarrio, setDestinoBarrio] = useState("");

  // Coordenadas exactas cuando el punto viene del mapa
  const [origenPunto, setOrigenPunto] = useState<Coords | null>(null);
  const [destinoPunto, setDestinoPunto] = useState<Coords | null>(null);

  // Tipo de Programación
  const [tipoProgramacion, setTipoProgramacion] = useState<
    "inmediato" | "programado"
  >("inmediato");

  // Estados para Fecha y Hora Nativos / Web
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date());
  const [horaSeleccionada, setHoraSeleccionada] = useState<Date>(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [fechaEstablecida, setFechaEstablecida] = useState(false);
  const [horaEstablecida, setHoraEstablecida] = useState(false);

  const [descripcion, setDescripcion] = useState("");
  const [ayudantes, setAyudantes] = useState(0);
  const [pisosEscaleras, setPisosEscaleras] = useState(0);
  const [nombreContacto, setNombreContacto] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");

  const [loading, setLoading] = useState(false);

  // Alerta en pantalla (componente global AlertaPantalla).
  const mostrarAlertaPantalla = async (
    titulo: string,
    mensaje: string,
    tipo: TipoAlerta = "advertencia",
    onConfirm?: () => void,
  ) => {
    await aviso(titulo, mensaje, tipo);
    onConfirm?.();
  };

  // Distancia de la ruta (km) entre A y B. Se guarda con la clave de los dos
  // puntos: si se mueve un pin, deja de valer y se vuelve a calcular.
  const claveRuta =
    origenPunto && destinoPunto
      ? `${origenPunto.lat},${origenPunto.lng};${destinoPunto.lat},${destinoPunto.lng}`
      : "";
  const [rutaGuardada, setRutaGuardada] = useState<{
    clave: string;
    km: number;
  } | null>(null);
  const distanciaKm = rutaGuardada?.clave === claveRuta ? rutaGuardada.km : null;
  const [ubicandoRuta, setUbicandoRuta] = useState(false);
  // Puntos A y B que el cliente revisó en el mapa (misma forma que claveRuta).
  // Las direcciones escritas se ubican de forma aproximada, por eso se piden revisar.
  const [puntosConfirmados, setPuntosConfirmados] = useState("");

  useEffect(() => {
    if (!origenPunto || !destinoPunto) return;
    const clave = claveRuta;
    let activo = true;
    distanciaRutaKm(origenPunto, destinoPunto)
      .then((km) => activo && setRutaGuardada({ clave, km }))
      .catch(() => {
        // Se reintenta al pasar al siguiente paso.
      });
    return () => {
      activo = false;
    };
    // claveRuta resume los dos puntos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRuta]);

  const tarifa =
    distanciaKm != null ? calcularTarifa(distanciaKm, ayudantes, pisosEscaleras) : null;

  // Cupones del cliente. La base de datos aplica el mejor al crear la solicitud;
  // aquí solo se calcula lo mismo para mostrarle el precio con descuento.
  const [cupones, setCupones] = useState<Cupon[]>([]);
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      obtenerCuponesDisponibles().then((c) => vigente && setCupones(c));
      return () => {
        vigente = false;
      };
    }, []),
  );
  const cupon = mejorCupon(cupones, tipoServicio);
  const descuento = tarifa && cupon ? descuentoDe(tarifa.total, cupon.porcentaje) : 0;

  // El contacto se llena con los datos de la cuenta (se pueden cambiar).
  const contactoPerfil = useRef({ nombre: "", telefono: "" });

  useEffect(() => {
    obtenerMiPerfil().then((perfil) => {
      if (!perfil) return;
      contactoPerfil.current = {
        nombre: perfil.nombre,
        telefono: perfil.telefono,
      };
      setNombreContacto((actual) => actual || perfil.nombre);
      setTelefonoContacto((actual) => actual || perfil.telefono);
    });
  }, []);

  const resetFormulario = () => {
    setPaso(1);
    setTipoServicio("Acarreo");
    setOrigenDireccion("");
    setOrigenBarrio("");
    setDestinoDireccion("");
    setDestinoBarrio("");
    setOrigenPunto(null);
    setDestinoPunto(null);
    setTipoProgramacion("inmediato");
    setFechaSeleccionada(new Date());
    setHoraSeleccionada(new Date());
    setFechaEstablecida(false);
    setHoraEstablecida(false);
    setDescripcion("");
    setAyudantes(0);
    setPisosEscaleras(0);
    setNombreContacto(contactoPerfil.current.nombre);
    setTelefonoContacto(contactoPerfil.current.telefono);
    setRutaGuardada(null);
    setPuntosConfirmados("");
  };

  // Formateadores de fecha (DD/MM/AAAA) y hora (12h AM/PM)
  const formatearFecha = (date: Date) => {
    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const formatearHora = (date: Date) => {
    let horas = date.getHours();
    const minutos = String(date.getMinutes()).padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";
    horas = horas % 12;
    horas = horas ? horas : 12;
    const horasStr = String(horas).padStart(2, "0");
    return `${horasStr}:${minutos} ${ampm}`;
  };

  // Handlers para DateTimePicker Nativo
  const onChangeFecha = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setFechaSeleccionada(selectedDate);
      setFechaEstablecida(true);
    }
  };

  const onChangeHora = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === "ios");
    if (selectedDate) {
      setHoraSeleccionada(selectedDate);
      setHoraEstablecida(true);
    }
  };

  // Llena los campos de recogida o entrega con un punto del mapa.
  const aplicarPunto = useCallback((rol: Rol, punto: PuntoMapa) => {
    const { direccion, barrio } = separarDireccion(punto.nombre);
    const coords = { lat: punto.lat, lng: punto.lng };

    if (rol === "origen") {
      setOrigenDireccion(direccion);
      setOrigenBarrio(barrio);
      setOrigenPunto(coords);
    } else {
      setDestinoDireccion(direccion);
      setDestinoBarrio(barrio);
      setDestinoPunto(coords);
    }
  }, []);

  // Abre el mapa en modo "ubicar punto" y, al volver, aplica el punto marcado.
  const esperando = useRef<Rol | null>(null);

  const marcarEnMapa = (rol: Rol) => {
    esperando.current = rol;
    router.push({ pathname: "/", params: { seleccionar: rol } });
  };

  useFocusEffect(
    useCallback(() => {
      const rol = esperando.current;
      if (!rol) return;
      esperando.current = null;

      const guardadas = obtenerUbicaciones();
      const punto = rol === "origen" ? guardadas.origen : guardadas.destino;
      if (punto) aplicarPunto(rol, punto);
    }, [aplicarPunto]),
  );

  // Llegada desde el buscador del inicio: solicitud nueva con recogida = mi
  // ubicación y entrega = el destino buscado. El cliente ya vio la ruta en el
  // mapa, así que los pines cuentan como revisados.
  useFocusEffect(
    useCallback(() => {
      if (desde !== "inicio") return;
      // Se quita el parámetro para no volver a aplicarlo al regresar a esta pantalla.
      router.setParams({ desde: undefined });

      const { miUbicacion, destino } = obtenerUbicaciones();
      resetFormulario();
      if (destino) aplicarPunto("destino", destino);
      if (miUbicacion) aplicarPunto("origen", miUbicacion);
      if (miUbicacion && destino) {
        setPuntosConfirmados(
          `${miUbicacion.lat},${miUbicacion.lng};${destino.lat},${destino.lng}`,
        );
      } else if (destino) {
        aviso(
          "Falta el punto de recogida",
          "No pudimos obtener tu ubicación actual. En el paso 2 escribe o marca en el mapa dónde recogemos la carga.",
          "advertencia",
        );
      }
    }, [desde, aplicarPunto, router]),
  );

  // Vista previa: al ubicar o arrastrar un pin se guardan sus coordenadas.
  // Si se arrastró, la dirección escrita se reemplaza por la del nuevo punto.
  const alUbicarPunto = async (
    rol: Rol,
    coords: Coords,
    arrastrado: boolean,
  ) => {
    if (rol === "origen") setOrigenPunto(coords);
    else setDestinoPunto(coords);
    if (!arrastrado) return;

    // Si el cliente movió un pin, ya revisó el mapa: no se le vuelve a preguntar.
    const a = rol === "origen" ? coords : origenPunto;
    const b = rol === "destino" ? coords : destinoPunto;
    if (a && b) setPuntosConfirmados(`${a.lat},${a.lng};${b.lat},${b.lng}`);

    const nombre = await obtenerDireccion(coords);
    if (!nombre) return;
    const { direccion, barrio } = separarDireccion(nombre);
    if (rol === "origen") {
      setOrigenDireccion(direccion);
      setOrigenBarrio(barrio);
    } else {
      setDestinoDireccion(direccion);
      setDestinoBarrio(barrio);
    }
  };

  // Punto de recogida disponible: el marcado a mano o, si no hay, la ubicación actual.
  const origenDisponible = ubic.origen ?? ubic.miUbicacion;

  /**
   * Como en Google Maps: si una dirección se escribió a mano, se busca para
   * obtener sus coordenadas, y luego se calcula la distancia de la ruta.
   * Devuelve false (y avisa) si no se pudo.
   */
  const asegurarRuta = async (): Promise<{ clave: string; km: number } | null> => {
    let a = origenPunto;
    let b = destinoPunto;

    const ubicar = async (direccion: string, barrio: string) => {
      const texto = [direccion.trim(), barrio.trim()].filter(Boolean).join(", ");
      const [primero] = texto ? await buscarLugares(texto).catch(() => []) : [];
      return primero ? { lat: primero.lat, lng: primero.lng } : null;
    };

    if (!a) {
      a = await ubicar(origenDireccion, origenBarrio);
      if (!a) {
        await mostrarAlertaPantalla(
          "No encontramos la recogida",
          "No pudimos ubicar la dirección de recogida. Usa «Marcar en el mapa» para señalar el punto exacto.",
          "advertencia",
        );
        return null;
      }
      setOrigenPunto(a);
    }
    if (!b) {
      b = await ubicar(destinoDireccion, destinoBarrio);
      if (!b) {
        await mostrarAlertaPantalla(
          "No encontramos la entrega",
          "No pudimos ubicar la dirección de entrega. Usa «Marcar en el mapa» para señalar el punto exacto.",
          "advertencia",
        );
        return null;
      }
      setDestinoPunto(b);
    }

    const clave = `${a.lat},${a.lng};${b.lat},${b.lng}`;
    if (rutaGuardada?.clave === clave) return rutaGuardada;
    try {
      const km = await distanciaRutaKm(a, b);
      setRutaGuardada({ clave, km });
      return { clave, km };
    } catch {
      await mostrarAlertaPantalla(
        "No pudimos calcular la ruta",
        "Revisa tu conexión a internet e inténtalo de nuevo. La distancia es necesaria para calcular el precio.",
        "error",
      );
      return null;
    }
  };

  const handleSiguiente = async () => {
    if (paso === 2 && (!origenDireccion.trim() || !destinoDireccion.trim())) {
      mostrarAlertaPantalla(
        "Atención",
        "Por favor ingresa la dirección de recogida y entrega.",
        "advertencia",
      );
      return;
    }
    if (paso === 2) {
      setUbicandoRuta(true);
      const ruta = await asegurarRuta();
      setUbicandoRuta(false);
      if (!ruta) return;

      // El precio depende de la distancia: el cliente confirma que los pines
      // están en el lugar exacto (si arrastró alguno, ya cuenta como revisado).
      if (puntosConfirmados !== ruta.clave) {
        const ok = await confirmar({
          titulo: "¿Los puntos están bien ubicados?",
          mensaje: `Revisa en el mapa que A (recogida) y el camión (entrega) estén en el lugar exacto. Si no, arrástralos. La ruta mide ${ruta.km.toFixed(1).replace(".", ",")} km y con eso se calcula el precio.`,
          textoAceptar: "Sí, continuar",
          textoCancelar: "Ajustar",
          tipo: "info",
        });
        if (!ok) return;
        setPuntosConfirmados(ruta.clave);
      }
    }
    if (
      paso === 3 &&
      tipoProgramacion === "programado" &&
      (!fechaEstablecida || !horaEstablecida)
    ) {
      mostrarAlertaPantalla(
        "Atención",
        "Por favor selecciona la fecha y hora para programar el servicio.",
        "advertencia",
      );
      return;
    }
    setPaso(paso + 1);
  };

  const handleAnterior = () => {
    if (paso > 1) {
      setPaso(paso - 1);
    } else {
      router.push("/");
    }
  };

  const handleSolicitar = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Sin distancia no hay precio: se vuelve a intentar antes de enviar.
      if (distanciaKm == null && !(await asegurarRuta())) return;

      const payload = {
        tipoServicio,
        origen: [origenDireccion.trim(), origenBarrio.trim()]
          .filter(Boolean)
          .join(", "),
        destino: [destinoDireccion.trim(), destinoBarrio.trim()]
          .filter(Boolean)
          .join(", "),
        origenCoords: origenPunto,
        destinoCoords: destinoPunto,
        tipoProgramacion,
        fechaProgramada:
          tipoProgramacion === "programado"
            ? `${formatearFecha(fechaSeleccionada)} ${formatearHora(
                horaSeleccionada,
              )}`
            : "Inmediato",
        descripcion,
        ayudantes,
        pisosEscaleras,
        nombreContacto,
        telefonoContacto,
        fecha: new Date().toISOString(),
        distanciaKm,
      };

      await registrarServicio(payload);

      mostrarAlertaPantalla(
        "¡Servicio solicitado!",
        "Tu servicio ha sido registrado con éxito. Puedes consultarlo en tus solicitudes.",
        "exito",
        () => {
          resetFormulario();
          router.push("/solicitudes" as any);
        },
      );
    } catch (error: any) {
      mostrarAlertaPantalla(
        "Error",
        error.message || "No se pudo enviar la solicitud.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const serviciosList = [
    { id: "Envío", label: "Envío", desc: "Paquetes / Cajas" },
    { id: "Acarreo", label: "Acarreo", desc: "Objetos grandes" },
    { id: "Trasteo", label: "Trasteo", desc: "Muebles / Electros" },
    { id: "Mudanza", label: "Mudanza", desc: "Hogar completo" },
  ];

  return (
    // Misma estructura que la pantalla principal y solicitudes: así la barra de
    // navegación queda en la misma posición.
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.mainContainer}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Barra superior con Botón Retroceder y Pasos */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleAnterior} style={styles.btnBack}>
              <TextoIcono icono="arrow-back" style={styles.btnBackText}>
              Volver
            </TextoIcono>
            </TouchableOpacity>
            <Text style={styles.stepIndicator}>Paso {paso} de 4</Text>
          </View>

          {/* Encabezado */}
          <View style={styles.headerContainer}>
            <Text style={styles.subtitleHeader}>SOLICITUD EN LÍNEA</Text>
            <Text style={styles.titleHeader}>
              Solicitar <Text style={styles.titleHighlight}>Servicio</Text>
            </Text>
          </View>

          {/* ================= PASO 1: TIPO DE SERVICIO ================= */}
          {paso === 1 && (
            <View>
              <TarjetaCupones cupones={cupones} />
              <Text style={styles.sectionTitle}>1. ¿QUÉ NECESITAS MOVER?</Text>
              <View style={styles.gridServicios}>
                {serviciosList.map((item) => {
                  const isSelected = tipoServicio === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setTipoServicio(item.id as any)}
                      style={[
                        styles.cardServicio,
                        isSelected
                          ? styles.cardServicioSelected
                          : styles.cardServicioNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cardTitle,
                          isSelected && styles.textHighlight,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.cardDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.btnNext}
                onPress={handleSiguiente}
              >
                <TextoIcono icono="arrow-forward" alFinal style={styles.btnNextText}>
                  Siguiente
                </TextoIcono>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= PASO 2: ORIGEN Y DESTINO ================= */}
          {paso === 2 && (
            <View>
              <Text style={styles.sectionTitle}>2. RUTA DEL SERVICIO</Text>

              <View style={styles.cardSection}>
                <TextoIcono icono="ellipse" tamanoIcono={10} style={styles.labelPointBlue}>
                  Punto de recogida
                </TextoIcono>

                <AccionesMapa
                  disponible={origenDisponible}
                  textoTraer={
                    ubic.origen
                      ? "Traer punto marcado"
                      : "Usar mi ubicación actual"
                  }
                  textoMarcar={
                    ubic.origen ? "Cambiar en el mapa" : "Marcar en el mapa"
                  }
                  tieneExacto={!!origenPunto}
                  onTraer={() =>
                    origenDisponible && aplicarPunto("origen", origenDisponible)
                  }
                  onMarcar={() => marcarEnMapa("origen")}
                  onQuitar={() => setOrigenPunto(null)}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Dirección (Ej: Calle 45 # 70-20)"
                  placeholderTextColor={p.textoPista}
                  value={origenDireccion}
                  onChangeText={setOrigenDireccion}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Barrio o Municipio (Ej: Laureles)"
                  placeholderTextColor={p.textoPista}
                  value={origenBarrio}
                  onChangeText={setOrigenBarrio}
                />
              </View>

              <View style={styles.cardSection}>
                <TextoIcono icono="ellipse" tamanoIcono={10} style={styles.labelPointGreen}>
                  Punto de entrega
                </TextoIcono>

                <AccionesMapa
                  disponible={ubic.destino}
                  textoTraer="Traer destino del mapa"
                  textoMarcar={
                    ubic.destino ? "Cambiar en el mapa" : "Marcar en el mapa"
                  }
                  tieneExacto={!!destinoPunto}
                  onTraer={() =>
                    ubic.destino && aplicarPunto("destino", ubic.destino)
                  }
                  onMarcar={() => marcarEnMapa("destino")}
                  onQuitar={() => setDestinoPunto(null)}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Dirección (Ej: Carrera 80 # 30-15)"
                  placeholderTextColor={p.textoPista}
                  value={destinoDireccion}
                  onChangeText={setDestinoDireccion}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Barrio o Municipio (Ej: Poblado)"
                  placeholderTextColor={p.textoPista}
                  value={destinoBarrio}
                  onChangeText={setDestinoBarrio}
                />
              </View>

              <VistaPreviaRuta
                origen={origenPunto}
                destino={destinoPunto}
                textoOrigen={[origenDireccion, origenBarrio].filter(Boolean).join(", ")}
                textoDestino={[destinoDireccion, destinoBarrio].filter(Boolean).join(", ")}
                onPunto={alUbicarPunto}
              />

              <TouchableOpacity
                style={styles.btnNext}
                onPress={handleSiguiente}
                disabled={ubicandoRuta}
              >
                {ubicandoRuta ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <TextoIcono icono="arrow-forward" alFinal style={styles.btnNextText}>
                  Siguiente
                </TextoIcono>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ================= PASO 3: INMEDIATO O PROGRAMADO ================= */}
          {paso === 3 && (
            <View>
              <Text style={styles.sectionTitle}>3. ¿CUÁNDO LO NECESITAS?</Text>

              <View style={styles.gridServicios}>
                <TouchableOpacity
                  onPress={() => setTipoProgramacion("inmediato")}
                  style={[
                    styles.cardServicio,
                    tipoProgramacion === "inmediato"
                      ? styles.cardServicioSelected
                      : styles.cardServicioNormal,
                  ]}
                >
                  <TextoIcono
                    icono="flash"
                    style={[
                      styles.cardTitle,
                      tipoProgramacion === "inmediato" && styles.textHighlight,
                    ]}
                  >
                    Inmediato
                  </TextoIcono>
                  <Text style={styles.cardDesc}>Recogida lo antes posible</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setTipoProgramacion("programado")}
                  style={[
                    styles.cardServicio,
                    tipoProgramacion === "programado"
                      ? styles.cardServicioSelected
                      : styles.cardServicioNormal,
                  ]}
                >
                  <TextoIcono
                    icono="calendar"
                    style={[
                      styles.cardTitle,
                      tipoProgramacion === "programado" && styles.textHighlight,
                    ]}
                  >
                    Programado
                  </TextoIcono>
                  <Text style={styles.cardDesc}>Elegir fecha y hora</Text>
                </TouchableOpacity>
              </View>

              {tipoProgramacion === "programado" && (
                <View style={styles.cardSection}>
                  <Text style={styles.inputLabel}>Fecha del servicio</Text>
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      onChange={(e) => {
                        if (e.target.value) {
                          const [yyyy, mm, dd] = e.target.value.split("-");
                          const d = new Date(
                            Number(yyyy),
                            Number(mm) - 1,
                            Number(dd),
                          );
                          setFechaSeleccionada(d);
                          setFechaEstablecida(true);
                        }
                      }}
                      style={{
                        backgroundColor: p.fondoProfundo,
                        color: p.texto,
                        padding: "12px",
                        borderRadius: "12px",
                        border: `1px solid ${p.bordeCampo}`,
                        marginBottom: "12px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box",
                        colorScheme: p.esClaro ? "light" : "dark",
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.pickerSelectorButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <TextoIcono
                        icono="calendar-outline"
                        style={styles.pickerSelectorText}
                      >
                        {fechaEstablecida
                          ? formatearFecha(fechaSeleccionada)
                          : "Seleccionar fecha en calendario"}
                      </TextoIcono>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.inputLabel}>Hora estimada</Text>
                  {Platform.OS === "web" ? (
                    <input
                      type="time"
                      onChange={(e) => {
                        if (e.target.value) {
                          const [hrs, mins] = e.target.value.split(":");
                          const d = new Date();
                          d.setHours(Number(hrs), Number(mins));
                          setHoraSeleccionada(d);
                          setHoraEstablecida(true);
                        }
                      }}
                      style={{
                        backgroundColor: p.fondoProfundo,
                        color: p.texto,
                        padding: "12px",
                        borderRadius: "12px",
                        border: `1px solid ${p.bordeCampo}`,
                        marginBottom: "12px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box",
                        colorScheme: p.esClaro ? "light" : "dark",
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.pickerSelectorButton}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <TextoIcono
                        icono="time-outline"
                        style={styles.pickerSelectorText}
                      >
                        {horaEstablecida
                          ? formatearHora(horaSeleccionada)
                          : "Seleccionar hora en reloj"}
                      </TextoIcono>
                    </TouchableOpacity>
                  )}

                  {/* Modales DateTimePicker para Android e iOS */}
                  {showDatePicker && Platform.OS !== "web" && (
                    <DateTimePicker
                      value={fechaSeleccionada}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={onChangeFecha}
                    />
                  )}

                  {showTimePicker && Platform.OS !== "web" && (
                    <DateTimePicker
                      value={horaSeleccionada}
                      mode="time"
                      is24Hour={false}
                      display="default"
                      onChange={onChangeHora}
                    />
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.btnNext}
                onPress={handleSiguiente}
              >
                <TextoIcono icono="arrow-forward" alFinal style={styles.btnNextText}>
                  Siguiente
                </TextoIcono>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= PASO 4: AYUDANTES Y DETALLES FINALES ================= */}
          {paso === 4 && (
            <View>
              <Text style={styles.sectionTitle}>4. DETALLES Y AYUDANTES</Text>

              <View style={styles.cardSection}>
                <Text style={styles.inputLabel}>¿Qué vamos a transportar?</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej: 1 nevera, 1 cama doble y 5 cajas..."
                  placeholderTextColor={p.textoPista}
                  multiline
                  textAlignVertical="top"
                  value={descripcion}
                  onChangeText={setDescripcion}
                />

                {/* Contador Ayudantes */}
                <View style={styles.counterRow}>
                  <View>
                    <Text style={styles.counterTitle}>
                      Ayudantes adicionales
                    </Text>
                    <Text style={styles.counterSub}>Carga y descarga</Text>
                  </View>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      onPress={() => setAyudantes(Math.max(0, ayudantes - 1))}
                      style={styles.btnCounterMinus}
                    >
                      <Text style={styles.btnCounterText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{ayudantes}</Text>
                    <TouchableOpacity
                      onPress={() => setAyudantes(ayudantes + 1)}
                      style={styles.btnCounterPlus}
                    >
                      <Text style={[styles.btnCounterText, styles.btnCounterTextPlus]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Contador Escaleras */}
                <View style={styles.counterRow}>
                  <View>
                    <Text style={styles.counterTitle}>Pisos por escaleras</Text>
                    <Text style={styles.counterSub}>Sin ascensor</Text>
                  </View>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      onPress={() =>
                        setPisosEscaleras(Math.max(0, pisosEscaleras - 1))
                      }
                      style={styles.btnCounterMinus}
                    >
                      <Text style={styles.btnCounterText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{pisosEscaleras}</Text>
                    <TouchableOpacity
                      onPress={() => setPisosEscaleras(pisosEscaleras + 1)}
                      style={styles.btnCounterPlus}
                    >
                      <Text style={[styles.btnCounterText, styles.btnCounterTextPlus]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Contacto */}
                <View style={styles.contactDivider}>
                  <Text style={styles.inputLabel}>
                    Contacto de quién recibe/entrega
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre completo"
                    placeholderTextColor={p.textoPista}
                    value={nombreContacto}
                    onChangeText={setNombreContacto}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Teléfono (Ej: 300 000 0000)"
                    placeholderTextColor={p.textoPista}
                    keyboardType="phone-pad"
                    value={telefonoContacto}
                    onChangeText={setTelefonoContacto}
                  />
                </View>
              </View>

              {/* Precio estimado (la base de datos guarda el definitivo con la misma fórmula) */}
              <View style={styles.cardSection}>
                <Text style={styles.inputLabel}>Precio estimado</Text>
                {tarifa ? (
                  <>
                    <FilaPrecio
                      texto={`Base (primeros ${KM_INCLUIDOS} km)`}
                      valor={tarifa.base}
                    />
                    {tarifa.kmAdicionales > 0 && (
                      <FilaPrecio
                        texto={`${tarifa.kmAdicionales.toFixed(2).replace(".", ",")} km adicionales × ${formatearPesos(PRECIO_KM_ADICIONAL)}`}
                        valor={tarifa.valorKm}
                      />
                    )}
                    {ayudantes > 0 && (
                      <FilaPrecio
                        texto={`${ayudantes} ayudante${ayudantes === 1 ? "" : "s"} × ${formatearPesos(PRECIO_AYUDANTE)}`}
                        valor={tarifa.valorAyudantes}
                      />
                    )}
                    {pisosEscaleras > 0 && (
                      <FilaPrecio
                        texto={`${pisosEscaleras} piso${pisosEscaleras === 1 ? "" : "s"} × ${formatearPesos(PRECIO_PISO)}`}
                        valor={tarifa.valorPisos}
                      />
                    )}
                    {cupon && descuento > 0 && (
                      <View style={styles.filaPrecio}>
                        <TextoIcono
                          icono="gift-outline"
                          style={[styles.textoPrecio, { color: p.textoExito }]}
                        >
                          Cupón {cupon.porcentaje} %
                        </TextoIcono>
                        <Text style={[styles.valorPrecio, { color: p.textoExito }]}>
                          - {formatearPesos(descuento)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.filaTotal}>
                      <Text style={styles.textoTotal}>
                        Total · {distanciaKm?.toFixed(1).replace(".", ",")} km de ruta
                      </Text>
                      <Text style={styles.valorTotal}>
                        {formatearPesos(tarifa.total - descuento)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.textoPrecioPendiente}>
                    Calculando la distancia de la ruta…
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.btnSubmit}
                disabled={loading}
                onPress={handleSolicitar}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnSubmitText}>
                    CONFIRMAR Y SOLICITAR
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>


        {/* Barra de Navegación fija abajo */}
        <BarraNavegacion />
      </View>
    </SafeAreaView>
  );
}

const crearEstilos = (p: Paleta) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: p.fondoProfundo,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: p.fondoProfundo,
  },
  container: {
    flex: 1,
    backgroundColor: p.fondoProfundo,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16, // el SafeAreaView ya reserva el espacio de la barra de estado
    paddingBottom: 90, // Espacio para que la barra inferior no tape el botón final
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  btnBack: {
    backgroundColor: p.superficie,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.bordeFuerte,
  },
  btnBackText: {
    color: p.textoTenue2,
    fontWeight: "600",
    fontSize: 12,
  },
  stepIndicator: {
    color: p.acento2,
    fontSize: 12,
    fontWeight: "700",
  },
  headerContainer: {
    marginBottom: 20,
  },
  subtitleHeader: {
    color: p.acento2,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: p.texto,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  titleHighlight: {
    color: p.acento3,
  },
  sectionTitle: {
    color: p.textoTenue2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },
  gridServicios: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cardServicio: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardServicioNormal: {
    backgroundColor: p.superficie,
    borderColor: p.bordeCampo,
  },
  cardServicioSelected: {
    backgroundColor: p.superficieSeleccion,
    borderColor: "#3b82f6",
  },
  cardTitle: {
    color: p.texto,
    fontSize: 16,
    fontWeight: "700",
  },
  textHighlight: {
    color: p.acento2,
  },
  cardDesc: {
    color: p.textoTenue2,
    fontSize: 11,
    marginTop: 4,
  },
  cardSection: {
    backgroundColor: p.superficie,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.bordeCampo,
    marginBottom: 20,
  },
  labelPointBlue: {
    color: p.acento2,
    fontWeight: "700",
    marginBottom: 12,
  },
  labelPointGreen: {
    color: p.textoExito,
    fontWeight: "700",
    marginBottom: 12,
  },

  // Acciones del mapa (traer / marcar)
  accionesMapa: {
    marginBottom: 12,
  },
  filaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: p.bordeFuerte,
    backgroundColor: p.fondoProfundo,
  },
  chipAzul: {
    borderColor: "#3b82f6",
    backgroundColor: p.superficieSeleccion,
  },
  chipTexto: {
    color: p.textoDato2,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextoAzul: {
    color: p.acento2,
  },
  chipPista: {
    color: p.textoPista,
    fontSize: 11,
    marginTop: 8,
  },
  filaExacto: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  textoExacto: {
    flex: 1,
    color: p.textoExito,
    fontSize: 12,
    fontWeight: "700",
  },
  textoQuitar: {
    color: p.textoTenue2,
    fontSize: 11,
    fontWeight: "600",
  },

  inputLabel: {
    color: p.textoDato2,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: p.fondoProfundo,
    color: p.texto,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.bordeCampo,
    marginBottom: 12,
    fontSize: 14,
  },
  pickerSelectorButton: {
    backgroundColor: p.fondoProfundo,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.bordeFuerte,
    marginBottom: 16,
    justifyContent: "center",
  },
  pickerSelectorText: {
    color: p.acento2,
    fontSize: 14,
    fontWeight: "600",
  },
  textArea: {
    height: 90,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: p.bordeCampo,
  },
  counterTitle: {
    color: p.texto,
    fontSize: 14,
    fontWeight: "600",
  },
  counterSub: {
    color: p.textoPista,
    fontSize: 11,
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnCounterMinus: {
    backgroundColor: p.fondoProfundo,
    borderWidth: 1,
    borderColor: p.bordeFuerte,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCounterPlus: {
    backgroundColor: "#2563eb",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCounterText: {
    color: p.texto,
    fontSize: 18,
    fontWeight: "700",
  },

  // El botón "+" es azul sólido: su texto va siempre blanco.
  btnCounterTextPlus: {
    color: "#FFFFFF",
  },
  counterValue: {
    color: p.texto,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 12,
  },
  contactDivider: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: p.bordeCampo,
  },
  btnNext: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  btnNextText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  filaPrecio: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 4,
  },
  textoPrecio: { color: p.textoTenue2, fontSize: 13, flex: 1 },
  valorPrecio: { color: p.textoSuave, fontSize: 13, fontWeight: "700" },
  filaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: p.linea(0.12),
  },
  textoTotal: { color: p.texto, fontSize: 13, fontWeight: "800", flex: 1 },
  valorTotal: { color: p.textoExito3, fontSize: 20, fontWeight: "900" },
  textoPrecioPendiente: { color: p.textoTenue2, fontSize: 13 },
  btnSubmit: {
    backgroundColor: p.rellenoExito,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  btnSubmitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
