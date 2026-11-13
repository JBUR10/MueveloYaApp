// src/app/admin.tsx
// Panel del administrador: revisa los perfiles de los transportistas y los
// aprueba o rechaza, y muestra las estadísticas de pedidos (por tipo y por
// zona). Solo entran cuentas de la tabla "administradores".
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PanelEstadisticas from "../components/admin/PanelEstadisticas";
import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import {
  obtenerTransportistas,
  revisarTransportista,
  soyAdmin,
  SolicitudTransportista,
} from "../services/adminService";
import {
  EstadoVerificacion,
  estadoDocumento,
  formatearFechaCorta,
} from "../services/vehiculoService";

const AZUL = "#2969e9";
const FONDO = "#111318";

const FILTROS: { id: EstadoVerificacion; titulo: string }[] = [
  { id: "pendiente", titulo: "Pendientes" },
  { id: "aprobado", titulo: "Aprobados" },
  { id: "rechazado", titulo: "Rechazados" },
];

type Seccion = "transportistas" | "estadisticas";

const SECCIONES: { id: Seccion; titulo: string }[] = [
  { id: "transportistas", titulo: "Transportistas" },
  { id: "estadisticas", titulo: "Estadísticas" },
];

const VACIO: Record<EstadoVerificacion, string> = {
  pendiente: "No hay transportistas pendientes de revisión.",
  aprobado: "Aún no hay transportistas aprobados.",
  rechazado: "No hay transportistas rechazados.",
};

function Documento({
  nombre,
  vence,
  opcional,
}: {
  nombre: string;
  vence: string | null;
  opcional?: boolean;
}) {
  const estado = estadoDocumento(vence);
  const color =
    estado === "vigente"
      ? "#34d399"
      : estado === "por_vencer"
        ? "#fbbf24"
        : opcional && estado === "falta"
          ? "#9BA7BA"
          : "#f87171";
  const texto =
    estado === "falta"
      ? opcional
        ? "No registrado"
        : "Falta"
      : `${estado === "vencido" ? "Vencido" : "Vence"} ${formatearFechaCorta(vence)}`;
  return (
    <View style={styles.filaDoc}>
      <Text style={styles.dato}>{nombre}</Text>
      <Text style={[styles.docEstado, { color }]}>{texto}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [seccion, setSeccion] = useState<Seccion>("transportistas");
  const [filtro, setFiltro] = useState<EstadoVerificacion>("pendiente");
  const [items, setItems] = useState<SolicitudTransportista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);

  const volver = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace("/perfil")),
    [router],
  );

  // Solo administradores: cualquier otra cuenta sale de aquí.
  useEffect(() => {
    soyAdmin().then(async (ok) => {
      setEsAdmin(ok);
      if (!ok) {
        await aviso(
          "Sin acceso",
          "Esta sección es solo para administradores.",
          "error",
        );
        volver();
      }
    });
  }, [volver]);

  const cargar = useCallback(async (estado: EstadoVerificacion) => {
    try {
      setItems(await obtenerTransportistas(estado));
    } catch (e: any) {
      await aviso("Error", e?.message || "No se pudo cargar la lista.", "error");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    if (!esAdmin) return;
    setCargando(true);
    setRechazandoId(null);
    setMotivo("");
    cargar(filtro);
  }, [esAdmin, filtro, cargar]);

  const aprobar = async (item: SolicitudTransportista) => {
    const ok = await confirmar({
      titulo: "Aprobar transportista",
      mensaje: `¿Aprobar a ${item.nombre || "este transportista"}? Podrá recibir solicitudes de inmediato.`,
      textoAceptar: "Aprobar",
      tipo: "info",
    });
    if (!ok) return;
    setProcesando(item.transportistaId);
    try {
      await revisarTransportista(item.transportistaId, true);
      await cargar(filtro);
    } catch (e: any) {
      await aviso("Error", e?.message || "No se pudo aprobar.", "error");
    } finally {
      setProcesando(null);
    }
  };

  const rechazar = async (item: SolicitudTransportista) => {
    if (!motivo.trim()) {
      await aviso(
        "Falta el motivo",
        "Escribe por qué se rechaza el perfil para que el transportista pueda corregirlo.",
        "advertencia",
      );
      return;
    }
    setProcesando(item.transportistaId);
    try {
      await revisarTransportista(item.transportistaId, false, motivo.trim());
      setRechazandoId(null);
      setMotivo("");
      await cargar(filtro);
    } catch (e: any) {
      await aviso("Error", e?.message || "No se pudo rechazar.", "error");
    } finally {
      setProcesando(null);
    }
  };

  if (esAdmin !== true) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={FONDO} />
        <ActivityIndicator color={AZUL} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={FONDO} />

      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          seccion === "transportistas" ? (
            <RefreshControl
              refreshing={refrescando}
              tintColor="#FFFFFF"
              onRefresh={() => {
                setRefrescando(true);
                cargar(filtro);
              }}
            />
          ) : undefined
        }>
        <View style={styles.topBar}>
          <Pressable onPress={volver} style={styles.btnBack}>
            <Text style={styles.btnBackText}>← Volver</Text>
          </Pressable>
        </View>

        <View style={styles.secciones}>
          {SECCIONES.map((s) => {
            const activa = seccion === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSeccion(s.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                style={[styles.seccion, activa && styles.seccionActiva]}>
                <Text
                  style={[styles.seccionTexto, activa && styles.seccionTextoActivo]}>
                  {s.titulo}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {seccion === "estadisticas" ? (
          <PanelEstadisticas />
        ) : (
          <>
        <Text style={styles.subtitulo}>PANEL DE ADMINISTRACIÓN</Text>
        <Text style={styles.titulo}>
          Revisión de <Text style={styles.azul}>transportistas</Text>
        </Text>
        <Text style={styles.descripcion}>
          Revisa los datos del vehículo y los documentos. Hasta que apruebes el
          perfil, el transportista no puede recibir pedidos.
        </Text>

        <View style={styles.chips}>
          {FILTROS.map((f) => {
            const activo = filtro === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFiltro(f.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activo }}
                style={[styles.chip, activo && styles.chipActivo]}>
                <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                  {f.titulo}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {cargando ? (
          <ActivityIndicator color={AZUL} size="large" style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <Text style={styles.vacio}>{VACIO[filtro]}</Text>
        ) : (
          items.map((item) => {
            const v = item.vehiculo;
            const ocupado = procesando === item.transportistaId;
            const rechazando = rechazandoId === item.transportistaId;
            return (
              <View key={item.transportistaId} style={styles.tarjeta}>
                <Text style={styles.nombre}>{item.nombre || "Sin nombre"}</Text>
                <Text style={styles.dato}>Teléfono: {item.telefono || "—"}</Text>

                <View style={styles.divisor} />

                <Text style={styles.dato}>
                  {v.tipo} · {v.placa}
                  {v.marcaModelo ? ` · ${v.marcaModelo}` : ""}
                </Text>
                <Text style={styles.dato}>
                  Licencia de tránsito: {v.licenciaTransitoNumero}
                </Text>

                <Documento nombre="SOAT" vence={v.soatVence} />
                <Documento
                  nombre="Licencia de conducción"
                  vence={v.licenciaConduccionVence}
                />
                {v.tecnomecanicaExento ? (
                  <View style={styles.filaDoc}>
                    <Text style={styles.dato}>Técnico-mecánica</Text>
                    <Text style={[styles.docEstado, { color: "#9BA7BA" }]}>
                      Exento
                    </Text>
                  </View>
                ) : (
                  <Documento
                    nombre="Técnico-mecánica"
                    vence={v.tecnomecanicaVence}
                  />
                )}
                <Documento nombre="Seguro RC" vence={v.seguroRcVence} opcional />

                {filtro === "rechazado" && !!v.motivoRechazo && (
                  <Text style={styles.motivo}>Motivo: {v.motivoRechazo}</Text>
                )}

                {rechazando ? (
                  <>
                    <TextInput
                      value={motivo}
                      onChangeText={setMotivo}
                      placeholder="Motivo del rechazo (obligatorio)"
                      placeholderTextColor="#657187"
                      multiline
                      maxLength={300}
                      style={styles.input}
                    />
                    <View style={styles.filaBotones}>
                      <Pressable
                        disabled={ocupado}
                        onPress={() => {
                          setRechazandoId(null);
                          setMotivo("");
                        }}
                        style={[styles.boton, styles.botonNeutro]}>
                        <Text style={styles.botonTexto}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        disabled={ocupado}
                        onPress={() => rechazar(item)}
                        style={[styles.boton, styles.botonRechazo]}>
                        <Text style={styles.botonTexto}>
                          {ocupado ? "Guardando…" : "Confirmar rechazo"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <View style={styles.filaBotones}>
                    {filtro !== "rechazado" && (
                      <Pressable
                        disabled={ocupado}
                        onPress={() => {
                          setRechazandoId(item.transportistaId);
                          setMotivo("");
                        }}
                        style={[styles.boton, styles.botonRechazo]}>
                        <Text style={styles.botonTexto}>Rechazar</Text>
                      </Pressable>
                    )}
                    {filtro !== "aprobado" && (
                      <Pressable
                        disabled={ocupado}
                        onPress={() => aprobar(item)}
                        style={[styles.boton, styles.botonAprobar]}>
                        <Text style={styles.botonTexto}>
                          {ocupado ? "Guardando…" : "Aprobar"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
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
  secciones: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  seccion: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center" },
  seccionActiva: { backgroundColor: AZUL },
  seccionTexto: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "800" },
  seccionTextoActivo: { color: "#FFFFFF" },
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
  vacio: { color: "#9BA7BA", fontSize: 14, textAlign: "center", marginTop: 30 },
  tarjeta: {
    padding: 16,
    gap: 8,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(17,19,24,0.94)",
  },
  nombre: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  dato: { color: "#D5DCE8", fontSize: 13, lineHeight: 18 },
  divisor: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 4,
  },
  filaDoc: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  docEstado: { fontSize: 12, fontWeight: "800" },
  motivo: { color: "#f87171", fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 70,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#FFFFFF",
    fontSize: 14,
    textAlignVertical: "top",
  },
  filaBotones: { flexDirection: "row", gap: 10, marginTop: 6 },
  boton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  botonAprobar: { backgroundColor: "#10b981" },
  botonRechazo: { backgroundColor: "#ef4444" },
  botonNeutro: { backgroundColor: "rgba(255,255,255,0.12)" },
  botonTexto: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
