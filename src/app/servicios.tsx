// src/app/servicios.tsx
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { aviso, TipoAlerta } from "../components/ui/AlertaPantalla";
import BarraNavegacion from "../components/ui/BarraNavegacion";
import VistaPreviaRuta from "../components/ui/VistaPreviaRuta";
import { obtenerDireccion } from "../services/geocodificacion";
import { obtenerMiPerfil } from "../services/perfilService";
import { registrarServicio } from "../services/servicioService";
import {
  obtenerUbicaciones,
  useUbicaciones,
  type PuntoMapa,
} from "../services/ubicacionStore";

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
          <Text style={styles.textoExacto}>
            ✓ Punto exacto del mapa guardado
          </Text>
          <TouchableOpacity onPress={onQuitar} hitSlop={10}>
            <Text style={styles.textoQuitar}>Quitar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ServiciosScreen() {
  const router = useRouter();
  const ubic = useUbicaciones();

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

  const handleSiguiente = () => {
    if (paso === 2 && (!origenDireccion.trim() || !destinoDireccion.trim())) {
      mostrarAlertaPantalla(
        "Atención",
        "Por favor ingresa la dirección de recogida y entrega.",
        "advertencia",
      );
      return;
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
      };

      await registrarServicio(payload);

      mostrarAlertaPantalla(
        "¡Servicio Solicitado! 🎉",
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
              <Text style={styles.btnBackText}>← Volver</Text>
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
                <Text style={styles.btnNextText}>Siguiente →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= PASO 2: ORIGEN Y DESTINO ================= */}
          {paso === 2 && (
            <View>
              <Text style={styles.sectionTitle}>2. RUTA DEL SERVICIO</Text>

              <View style={styles.cardSection}>
                <Text style={styles.labelPointBlue}>● Punto de Recogida</Text>

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
                  placeholderTextColor="#6b7280"
                  value={origenDireccion}
                  onChangeText={setOrigenDireccion}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Barrio o Municipio (Ej: Laureles)"
                  placeholderTextColor="#6b7280"
                  value={origenBarrio}
                  onChangeText={setOrigenBarrio}
                />
              </View>

              <View style={styles.cardSection}>
                <Text style={styles.labelPointGreen}>● Punto de Entrega</Text>

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
                  placeholderTextColor="#6b7280"
                  value={destinoDireccion}
                  onChangeText={setDestinoDireccion}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Barrio o Municipio (Ej: Poblado)"
                  placeholderTextColor="#6b7280"
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
              >
                <Text style={styles.btnNextText}>Siguiente →</Text>
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
                  <Text
                    style={[
                      styles.cardTitle,
                      tipoProgramacion === "inmediato" && styles.textHighlight,
                    ]}
                  >
                    ⚡ Inmediato
                  </Text>
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
                  <Text
                    style={[
                      styles.cardTitle,
                      tipoProgramacion === "programado" && styles.textHighlight,
                    ]}
                  >
                    📅 Programado
                  </Text>
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
                        backgroundColor: "#0b0e14",
                        color: "#ffffff",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "1px solid #1f2937",
                        marginBottom: "12px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box",
                        colorScheme: "dark",
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.pickerSelectorButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.pickerSelectorText}>
                        {fechaEstablecida
                          ? `📅 ${formatearFecha(fechaSeleccionada)}`
                          : "📅 Seleccionar fecha en calendario"}
                      </Text>
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
                        backgroundColor: "#0b0e14",
                        color: "#ffffff",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "1px solid #1f2937",
                        marginBottom: "12px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box",
                        colorScheme: "dark",
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.pickerSelectorButton}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text style={styles.pickerSelectorText}>
                        {horaEstablecida
                          ? `🕒 ${formatearHora(horaSeleccionada)}`
                          : "🕒 Seleccionar hora en reloj"}
                      </Text>
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
                <Text style={styles.btnNextText}>Siguiente →</Text>
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
                  placeholderTextColor="#6b7280"
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
                      <Text style={styles.btnCounterText}>+</Text>
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
                      <Text style={styles.btnCounterText}>+</Text>
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
                    placeholderTextColor="#6b7280"
                    value={nombreContacto}
                    onChangeText={setNombreContacto}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Teléfono (Ej: 300 000 0000)"
                    placeholderTextColor="#6b7280"
                    keyboardType="phone-pad"
                    value={telefonoContacto}
                    onChangeText={setTelefonoContacto}
                  />
                </View>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b0e14",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#0b0e14",
  },
  container: {
    flex: 1,
    backgroundColor: "#0b0e14",
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
    backgroundColor: "#161b22",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  btnBackText: {
    color: "#9ca3af",
    fontWeight: "600",
    fontSize: 12,
  },
  stepIndicator: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "700",
  },
  headerContainer: {
    marginBottom: 20,
  },
  subtitleHeader: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  titleHeader: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  titleHighlight: {
    color: "#3b82f6",
  },
  sectionTitle: {
    color: "#9ca3af",
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
    backgroundColor: "#161b22",
    borderColor: "#1f2937",
  },
  cardServicioSelected: {
    backgroundColor: "#1e293b",
    borderColor: "#3b82f6",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  textHighlight: {
    color: "#60a5fa",
  },
  cardDesc: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 4,
  },
  cardSection: {
    backgroundColor: "#161b22",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 20,
  },
  labelPointBlue: {
    color: "#60a5fa",
    fontWeight: "700",
    marginBottom: 12,
  },
  labelPointGreen: {
    color: "#34d399",
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
    borderColor: "#374151",
    backgroundColor: "#0b0e14",
  },
  chipAzul: {
    borderColor: "#3b82f6",
    backgroundColor: "#1e293b",
  },
  chipTexto: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextoAzul: {
    color: "#60a5fa",
  },
  chipPista: {
    color: "#6b7280",
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
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
  textoQuitar: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },

  inputLabel: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0b0e14",
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 12,
    fontSize: 14,
  },
  pickerSelectorButton: {
    backgroundColor: "#0b0e14",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 16,
    justifyContent: "center",
  },
  pickerSelectorText: {
    color: "#60a5fa",
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
    borderTopColor: "#1f2937",
  },
  counterTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  counterSub: {
    color: "#6b7280",
    fontSize: 11,
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnCounterMinus: {
    backgroundColor: "#0b0e14",
    borderWidth: 1,
    borderColor: "#374151",
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
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  counterValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 12,
  },
  contactDivider: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
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
  btnSubmit: {
    backgroundColor: "#10b981",
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
