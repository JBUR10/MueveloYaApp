// src/app/servicios.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registrarServicio } from "../services/servicioService";

export default function ServiciosScreen() {
  const router = useRouter();

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

  // Nuevo: Tipo de Programación
  const [tipoProgramacion, setTipoProgramacion] = useState<
    "inmediato" | "programado"
  >("inmediato");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [horaProgramada, setHoraProgramada] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [ayudantes, setAyudantes] = useState(0);
  const [pisosEscaleras, setPisosEscaleras] = useState(0);
  const [nombreContacto, setNombreContacto] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSiguiente = () => {
    if (paso === 2 && (!origenDireccion.trim() || !destinoDireccion.trim())) {
      Alert.alert(
        "Atención",
        "Por favor ingresa la dirección de recogida y entrega.",
      );
      return;
    }
    if (
      paso === 3 &&
      tipoProgramacion === "programado" &&
      (!fechaProgramada.trim() || !horaProgramada.trim())
    ) {
      Alert.alert(
        "Atención",
        "Por favor ingresa la fecha y hora para programar el servicio.",
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
    setLoading(true);
    try {
      const token = (await AsyncStorage.getItem("token")) || "TOKEN_DEMO";

      const payload = {
        tipoServicio,
        origen: `${origenDireccion.trim()}, ${origenBarrio.trim()}`,
        destino: `${destinoDireccion.trim()}, ${destinoBarrio.trim()}`,
        tipoProgramacion,
        fechaProgramada:
          tipoProgramacion === "programado"
            ? `${fechaProgramada} ${horaProgramada}`
            : "Inmediato",
        descripcion,
        ayudantes,
        pisosEscaleras,
        nombreContacto,
        telefonoContacto,
        fecha: new Date().toISOString(),
      };

      await registrarServicio(payload, token);

      Alert.alert(
        "¡Solicitud Enviada!",
        "Tu servicio ha sido solicitado con éxito.",
        [{ text: "OK", onPress: () => router.push("/solicitudes") }],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo enviar la solicitud.");
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
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
                  ]}>
                  <Text
                    style={[
                      styles.cardTitle,
                      isSelected && styles.textHighlight,
                    ]}>
                    {item.label}
                  </Text>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.btnNext} onPress={handleSiguiente}>
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

          <TouchableOpacity style={styles.btnNext} onPress={handleSiguiente}>
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
              ]}>
              <Text
                style={[
                  styles.cardTitle,
                  tipoProgramacion === "inmediato" && styles.textHighlight,
                ]}>
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
              ]}>
              <Text
                style={[
                  styles.cardTitle,
                  tipoProgramacion === "programado" && styles.textHighlight,
                ]}>
                📅 Programado
              </Text>
              <Text style={styles.cardDesc}>Elegir fecha y hora</Text>
            </TouchableOpacity>
          </View>

          {tipoProgramacion === "programado" && (
            <View style={styles.cardSection}>
              <Text style={styles.inputLabel}>Fecha del servicio</Text>
              <TextInput
                style={styles.input}
                placeholder="AAAA-MM-DD (Ej: 2026-10-20)"
                placeholderTextColor="#6b7280"
                value={fechaProgramada}
                onChangeText={setFechaProgramada}
              />
              <Text style={styles.inputLabel}>Hora estimada</Text>
              <TextInput
                style={styles.input}
                placeholder="HH:MM (Ej: 14:30)"
                placeholderTextColor="#6b7280"
                value={horaProgramada}
                onChangeText={setHoraProgramada}
              />
            </View>
          )}

          <TouchableOpacity style={styles.btnNext} onPress={handleSiguiente}>
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
                <Text style={styles.counterTitle}>Ayudantes adicionales</Text>
                <Text style={styles.counterSub}>Carga y descarga</Text>
              </View>
              <View style={styles.counterControls}>
                <TouchableOpacity
                  onPress={() => setAyudantes(Math.max(0, ayudantes - 1))}
                  style={styles.btnCounterMinus}>
                  <Text style={styles.btnCounterText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{ayudantes}</Text>
                <TouchableOpacity
                  onPress={() => setAyudantes(ayudantes + 1)}
                  style={styles.btnCounterPlus}>
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
                  style={styles.btnCounterMinus}>
                  <Text style={styles.btnCounterText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{pisosEscaleras}</Text>
                <TouchableOpacity
                  onPress={() => setPisosEscaleras(pisosEscaleras + 1)}
                  style={styles.btnCounterPlus}>
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
            onPress={handleSolicitar}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnSubmitText}>CONFIRMAR Y SOLICITAR</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0e14",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 60,
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
