// src/app/vehiculo.tsx
// Registro (o actualización) del vehículo y documentos del transportista.
// Es obligatorio para activar el modo transportista.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BotonPrincipal, Campo } from "../components/auth/FormularioAuth";
import { aviso } from "../components/ui/AlertaPantalla";
import CampoFecha from "../components/ui/CampoFecha";
import { cambiarModo } from "../services/modoStore";
import {
  DIAS_AVISO_VENCIMIENTO,
  fechaMaximaUnAnio,
  guardarMiVehiculo,
  obtenerMiVehiculo,
  revisarDocumentos,
  superaUnAnio,
  TIPOS_VEHICULO,
  Vehiculo,
} from "../services/vehiculoService";

const AZUL = "#2969e9";
const FONDO = "#111318";

const VACIO: Vehiculo = {
  tipo: "Camioneta",
  placa: "",
  marcaModelo: "",
  licenciaTransitoNumero: "",
  soatVence: "",
  tecnomecanicaExento: false,
  tecnomecanicaVence: null,
  licenciaConduccionVence: "",
  seguroRcVence: null,
};

type Errores = Partial<Record<keyof Vehiculo, string>>;

const AYUDA_UN_ANIO = "Vigencia máxima: 1 año desde hoy.";
const ERROR_UN_ANIO =
  "No puede vencer en más de 1 año: revisa la fecha del documento.";

export default function VehiculoScreen() {
  const router = useRouter();
  // ?activar=1 cuando se llega desde el interruptor del modo transportista.
  const { activar } = useLocalSearchParams<{ activar?: string }>();

  const [v, setV] = useState<Vehiculo>(VACIO);
  const [existe, setExiste] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Errores>({});

  useEffect(() => {
    obtenerMiVehiculo()
      .then((guardado) => {
        if (guardado) {
          setV(guardado);
          setExiste(true);
        }
      })
      .catch((e) => console.error("Error cargando vehículo:", e))
      .finally(() => setCargando(false));
  }, []);

  const cambiar = <K extends keyof Vehiculo>(campo: K, valor: Vehiculo[K]) => {
    setV((actual) => ({ ...actual, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const volver = () =>
    router.canGoBack() ? router.back() : router.replace("/perfil");

  const guardar = async () => {
    const nuevos: Errores = {};
    const placa = v.placa.trim().toUpperCase().replace(/\s|-/g, "");
    // Carros: ABC123. Motos y motocarros: ABC12D.
    if (!/^[A-Z]{3}\d{2}[A-Z0-9]$/.test(placa))
      nuevos.placa = "Formato de placa no válido (ej. ABC123).";
    if (!v.licenciaTransitoNumero.trim())
      nuevos.licenciaTransitoNumero = "Escribe el número de la licencia de tránsito.";
    if (!v.soatVence) nuevos.soatVence = "Selecciona la fecha de vencimiento.";
    else if (superaUnAnio(v.soatVence)) nuevos.soatVence = ERROR_UN_ANIO;
    if (!v.licenciaConduccionVence)
      nuevos.licenciaConduccionVence = "Selecciona la fecha de vencimiento.";
    if (!v.tecnomecanicaExento && !v.tecnomecanicaVence)
      nuevos.tecnomecanicaVence = "Selecciona la fecha o marca el vehículo como exento.";
    else if (!v.tecnomecanicaExento && superaUnAnio(v.tecnomecanicaVence))
      nuevos.tecnomecanicaVence = ERROR_UN_ANIO;
    setErrores(nuevos);
    if (Object.keys(nuevos).length) {
      await aviso(
        "Faltan datos",
        "Revisa los campos marcados en rojo.",
        "advertencia",
      );
      return;
    }

    const datos = { ...v, placa };
    const revision = revisarDocumentos(datos);
    if (!revision.vigentes) {
      await aviso(
        "Documentos vencidos",
        `No puedes trabajar como transportista con documentos vencidos: ${revision.vencidos.join(", ")}. Renuévalos y actualiza la fecha.`,
        "error",
      );
      return;
    }

    setGuardando(true);
    try {
      await guardarMiVehiculo(datos);
    } catch (e: any) {
      setGuardando(false);
      await aviso("Error", e?.message || "No se pudo guardar.", "error");
      return;
    }
    setGuardando(false);

    if (revision.porVencer.length) {
      await aviso(
        "Documentos por vencer",
        `${revision.porVencer.join(", ")} vence(n) en ${DIAS_AVISO_VENCIMIENTO} días o menos. Recuerda renovarlos para no quedar bloqueado.`,
        "advertencia",
      );
    }

    if (activar) {
      await cambiarModo("transportista");
      await aviso(
        "¡Listo!",
        "Tu vehículo quedó registrado. Ya puedes recibir solicitudes.",
        "exito",
      );
      router.replace("/transportista");
    } else {
      await aviso("Vehículo actualizado", "Tus datos quedaron guardados.", "exito");
      volver();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={volver} style={styles.btnBack}>
            <Text style={styles.btnBackText}>← Volver</Text>
          </Pressable>
        </View>

        <Text style={styles.subtitulo}>MODO TRANSPORTISTA</Text>
        <Text style={styles.titulo}>
          {existe ? "Mi" : "Registra tu"}{" "}
          <Text style={styles.azul}>vehículo</Text>
        </Text>
        <Text style={styles.descripcion}>
          Los documentos obligatorios deben estar vigentes. Si alguno se vence,
          el modo transportista se bloquea hasta que actualices la fecha.
        </Text>

        {cargando ? (
          <ActivityIndicator color={AZUL} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Vehículo */}
            <View style={styles.tarjeta}>
              <Text style={styles.tituloTarjeta}>Vehículo</Text>

              <Text style={styles.etiqueta}>Tipo de vehículo</Text>
              <View style={styles.chips}>
                {TIPOS_VEHICULO.map((tipo) => {
                  const activo = v.tipo === tipo;
                  return (
                    <Pressable
                      key={tipo}
                      onPress={() => cambiar("tipo", tipo)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: activo }}
                      style={[styles.chip, activo && styles.chipActivo]}
                    >
                      <Text
                        style={[styles.chipTexto, activo && styles.chipTextoActivo]}
                      >
                        {tipo}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Campo
                etiqueta="Placa"
                value={v.placa}
                onChangeText={(t) => cambiar("placa", t.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                maxLength={7}
                error={errores.placa}
              />
              <Campo
                etiqueta="Marca y modelo (opcional)"
                value={v.marcaModelo}
                onChangeText={(t) => cambiar("marcaModelo", t)}
                placeholder="Ej. Chevrolet NHR 2020"
              />
              <Campo
                etiqueta="N.º licencia de tránsito (tarjeta de propiedad)"
                value={v.licenciaTransitoNumero}
                onChangeText={(t) => cambiar("licenciaTransitoNumero", t)}
                placeholder="Ej. 10012345678"
                autoCapitalize="characters"
                error={errores.licenciaTransitoNumero}
              />
            </View>

            {/* Documentos */}
            <View style={styles.tarjeta}>
              <Text style={styles.tituloTarjeta}>Vencimiento de documentos</Text>

              <CampoFecha
                etiqueta="SOAT"
                valor={v.soatVence || null}
                onCambiar={(f) => cambiar("soatVence", f ?? "")}
                error={errores.soatVence}
                maximo={fechaMaximaUnAnio()}
                ayuda={AYUDA_UN_ANIO}
              />

              <CampoFecha
                etiqueta="Licencia de conducción"
                valor={v.licenciaConduccionVence || null}
                onCambiar={(f) => cambiar("licenciaConduccionVence", f ?? "")}
                error={errores.licenciaConduccionVence}
              />

              <Pressable
                onPress={() =>
                  cambiar("tecnomecanicaExento", !v.tecnomecanicaExento)
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: v.tecnomecanicaExento }}
                style={styles.filaCheck}
              >
                <View
                  style={[
                    styles.check,
                    v.tecnomecanicaExento && styles.checkActivo,
                  ]}
                >
                  {v.tecnomecanicaExento && <Text style={styles.checkMarca}>✓</Text>}
                </View>
                <Text style={styles.textoCheck}>
                  Vehículo nuevo, exento de revisión técnico-mecánica
                </Text>
              </Pressable>

              {!v.tecnomecanicaExento && (
                <CampoFecha
                  etiqueta="Revisión técnico-mecánica"
                  valor={v.tecnomecanicaVence}
                  onCambiar={(f) => cambiar("tecnomecanicaVence", f)}
                  error={errores.tecnomecanicaVence}
                  maximo={fechaMaximaUnAnio()}
                  ayuda={AYUDA_UN_ANIO}
                />
              )}

              <CampoFecha
                etiqueta="Póliza de responsabilidad civil"
                valor={v.seguroRcVence}
                onCambiar={(f) => cambiar("seguroRcVence", f)}
                opcional
              />
            </View>

            <BotonPrincipal
              texto={existe ? "Guardar cambios" : "Registrar vehículo"}
              onPress={guardar}
              cargando={guardando}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FONDO },
  contenido: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },
  topBar: { flexDirection: "row" },
  btnBack: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  btnBackText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  subtitulo: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: -12,
  },
  titulo: { color: "#eeecec", fontSize: 28, fontWeight: "900" },
  azul: { color: AZUL },
  descripcion: { color: "#9BA7BA", fontSize: 13, lineHeight: 19, marginTop: -8 },
  tarjeta: {
    padding: 16,
    gap: 14,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  tituloTarjeta: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  etiqueta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: -6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActivo: { backgroundColor: AZUL, borderColor: AZUL },
  chipTexto: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "700" },
  chipTextoActivo: { color: "#FFFFFF" },
  filaCheck: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkActivo: { backgroundColor: AZUL, borderColor: AZUL },
  checkMarca: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  textoCheck: { flex: 1, color: "#E7F0F4", fontSize: 13, lineHeight: 18 },
});
