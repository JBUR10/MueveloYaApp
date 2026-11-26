// src/components/admin/PanelQuejas.tsx
//
// Pestaña «Quejas» del administrador. Muestra cada queja con las fotos del
// cliente y las que tomó el transportista al recoger, para comparar si el
// daño ya existía. El admin la descarta o la confirma con una gravedad; la
// sanción (advertencia, suspensión o definitiva) la aplica la base de datos.
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { enlacesDeFotos } from "../../services/evidenciasService";
import {
  anularSancion,
  type Gravedad,
  GRAVEDADES,
  obtenerQuejas,
  type QuejaAdmin,
  resolverQueja,
  sancionPrevista,
} from "../../services/quejasAdminService";
import { TIPO_QUEJA_DANO } from "../../services/calificacionService";
import { formatearFechaHora } from "../../services/transportistaService";
import { useEstilos, usePaleta, type Paleta } from "../../services/temaStore";
import { aviso, confirmar } from "../ui/AlertaPantalla";
import Icono from "../ui/Icono";
import { Text, TextInput } from "../ui/Texto";

const AZUL = "#2969e9";
type Filtro = "abiertas" | "revisadas";

const TEXTO_ACCION = {
  advertencia: "Advertencia",
  suspension: "Suspensión",
  definitiva: "Suspensión definitiva",
} as const;

function Fotos({
  titulo,
  rutas,
  enlaces,
  vacio,
  onAbrir,
}: {
  titulo: string;
  rutas: string[];
  enlaces: Record<string, string>;
  vacio: string;
  onAbrir: (url: string) => void;
}) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.etiqueta}>
        {titulo} ({rutas.length})
      </Text>
      {rutas.length === 0 ? (
        <Text style={styles.tenue}>{vacio}</Text>
      ) : (
        <View style={styles.fotos}>
          {rutas.map((r) =>
            enlaces[r] ? (
              <Pressable key={r} onPress={() => onAbrir(enlaces[r])}>
                <Image source={{ uri: enlaces[r] }} style={styles.foto} />
              </Pressable>
            ) : (
              <View key={r} style={[styles.foto, styles.fotoVacia]}>
                <Icono nombre="image-outline" tamano={20} />
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

export default function PanelQuejas() {
  const p = usePaleta();
  const styles = useEstilos(crearEstilos);
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [quejas, setQuejas] = useState<QuejaAdmin[]>([]);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // Queja abierta para decidir y lo elegido.
  const [abiertaId, setAbiertaId] = useState<number | null>(null);
  const [gravedad, setGravedad] = useState<Gravedad | null>(null);
  const [nota, setNota] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);

  const cargar = useCallback(async (f: Filtro) => {
    try {
      const lista = await obtenerQuejas(f);
      setQuejas(lista);
      setEnlaces(
        await enlacesDeFotos(
          lista.flatMap((q) => [...q.fotosCliente, ...q.fotosRecogida]),
        ),
      );
      setError("");
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las quejas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(filtro);
  }, [filtro, cargar]);

  const cambiarFiltro = (f: Filtro) => {
    if (f === filtro) return;
    setCargando(true);
    setAbiertaId(null);
    setFiltro(f);
  };

  const abrir = (id: number) => {
    setAbiertaId((a) => (a === id ? null : id));
    setGravedad(null);
    setNota("");
  };

  const resolver = async (q: QuejaAdmin, g: Gravedad | null) => {
    const mensaje =
      g === null
        ? "La queja se cerrará sin sanción para el transportista y se le avisará al cliente."
        : `Gravedad: ${GRAVEDADES.find((x) => x.id === g)?.titulo}.\nSe aplicará: ${sancionPrevista(g, q.transportista!)}`;
    const ok = await confirmar({
      titulo: g === null ? "¿Descartar la queja?" : "¿Confirmar el daño?",
      mensaje,
      textoAceptar: g === null ? "Descartar" : "Confirmar y sancionar",
      destructivo: g !== null,
      tipo: g === null ? "info" : "advertencia",
    });
    if (!ok) return;
    setProcesando(true);
    try {
      await resolverQueja(q.id, g, nota);
      setAbiertaId(null);
      await cargar(filtro);
      await aviso(
        g === null ? "Queja descartada" : "Sanción aplicada",
        g === null
          ? "Se le avisó al cliente."
          : "Se les avisó al transportista y al cliente.",
        "exito",
      );
    } catch (e: any) {
      await aviso("Error", e?.message || "No se pudo resolver la queja.", "error");
    } finally {
      setProcesando(false);
    }
  };

  const anular = async (q: QuejaAdmin) => {
    if (!q.sancion) return;
    const ok = await confirmar({
      titulo: "¿Anular la sanción?",
      mensaje:
        "El transportista vuelve al estado que tenía antes de esta sanción. Los servicios que se le liberaron no se le devuelven.",
      textoAceptar: "Anular",
      destructivo: true,
    });
    if (!ok) return;
    setProcesando(true);
    try {
      await anularSancion(q.sancion.id, nota);
      setAbiertaId(null);
      await cargar(filtro);
      await aviso("Sanción anulada", "Se le avisó al transportista.", "exito");
    } catch (e: any) {
      await aviso("Error", e?.message || "No se pudo anular.", "error");
    } finally {
      setProcesando(false);
    }
  };

  const renderEstadoConductor = (t: NonNullable<QuejaAdmin["transportista"]>) => {
    const insignias: { texto: string; color: string }[] = [];
    if (t.definitiva) insignias.push({ texto: "Suspensión definitiva", color: "#ef4444" });
    else if (t.suspendido && t.suspendidoHasta)
      insignias.push({
        texto: `Suspendido hasta ${formatearFechaHora(t.suspendidoHasta)}`,
        color: "#ef4444",
      });
    if (t.condicionado && !t.definitiva)
      insignias.push({ texto: "Condicionado", color: "#f59e0b" });
    if (t.advertencias > 0)
      insignias.push({ texto: `${t.advertencias}/3 advertencias`, color: "#f59e0b" });
    if (!insignias.length) insignias.push({ texto: "Sin sanciones", color: "#10b981" });
    return (
      <View style={styles.insignias}>
        {insignias.map((i) => (
          <View key={i.texto} style={[styles.insignia, { borderColor: i.color }]}>
            <Text style={[styles.insigniaTexto, { color: i.color }]}>{i.texto}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderResultado = (q: QuejaAdmin) => {
    const s = q.sancion;
    let texto =
      q.estado === "descartada" ? "Descartada, sin sanción." : "Daño confirmado.";
    if (q.gravedad) {
      texto += ` Gravedad: ${GRAVEDADES.find((g) => g.id === q.gravedad)?.titulo}.`;
    }
    if (s) {
      texto += ` ${TEXTO_ACCION[s.accion]}`;
      if (s.dias) texto += ` de ${s.dias} días`;
      if (s.terminaEl) texto += `, hasta ${formatearFechaHora(s.terminaEl)}`;
      texto += s.estabaCondicionado ? " (cuenta condicionada)." : ".";
      if (s.anuladaEl) texto += " Sanción ANULADA.";
    }
    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.resultado}>{texto}</Text>
        {!!q.notaAdmin && <Text style={styles.tenue}>Nota: {q.notaAdmin}</Text>}
        {s && !s.anuladaEl && s.esLaUltima && (
          <>
            <TextInput
              value={nota}
              onChangeText={setNota}
              placeholder="Motivo para anular (opcional)…"
              placeholderTextColor={p.textoAlfa(0.35)}
              maxLength={300}
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
            />
            <Pressable
              onPress={() => anular(q)}
              disabled={procesando}
              style={[styles.boton, styles.botonSecundario]}
            >
              <Text style={styles.textoBoton}>Anular sanción</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  const renderDecision = (q: QuejaAdmin) => {
    const sancionable =
      q.tipo === TIPO_QUEJA_DANO && !!q.transportista && q.autorEsCliente;
    return (
      <View style={{ gap: 10 }}>
        {sancionable ? (
          <>
            <Text style={styles.etiqueta}>Gravedad del daño</Text>
            {GRAVEDADES.map((g) => {
              const activo = gravedad === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setGravedad(g.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  style={[styles.opcion, activo && styles.opcionActiva]}
                >
                  <Text style={styles.opcionTitulo}>{g.titulo}</Text>
                  <Text style={styles.tenue}>{g.descripcion}</Text>
                </Pressable>
              );
            })}
            {gravedad && (
              <Text style={styles.prevista}>
                Se aplicará: {sancionPrevista(gravedad, q.transportista!)}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.tenue}>
            {q.tipo !== TIPO_QUEJA_DANO
              ? "Las sanciones aplican a quejas de «Daño o pérdida». Contacta a las partes y ciérrala."
              : "Esta queja no tiene un transportista asignado para sancionar."}
          </Text>
        )}

        <TextInput
          value={nota}
          onChangeText={setNota}
          placeholder="Nota para el cliente y el transportista (opcional)…"
          placeholderTextColor={p.textoAlfa(0.35)}
          multiline
          maxLength={300}
          style={[
            styles.input,
            { minHeight: 60 },
            Platform.OS === "web" && ({ outlineStyle: "none" } as any),
          ]}
        />

        <View style={styles.botones}>
          <Pressable
            onPress={() => resolver(q, null)}
            disabled={procesando}
            style={[styles.boton, styles.botonSecundario]}
          >
            <Text style={styles.textoBoton}>
              {sancionable ? "Descartar" : "Cerrar queja"}
            </Text>
          </Pressable>
          {sancionable && (
            <Pressable
              onPress={() => gravedad && resolver(q, gravedad)}
              disabled={!gravedad || procesando}
              style={[styles.boton, styles.botonPeligro, !gravedad && styles.inactivo]}
            >
              {procesando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.textoBoton, { color: "#FFFFFF" }]}>
                  Confirmar daño
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.subtitulo}>PANEL DE ADMINISTRACIÓN</Text>
      <Text style={styles.titulo}>
        Revisión de <Text style={{ color: AZUL }}>quejas</Text>
      </Text>
      <Text style={styles.descripcion}>
        Compara las fotos del cliente con las que tomó el transportista al
        recoger. Si el daño ya existía, descarta la queja.
      </Text>

      <View style={styles.chips}>
        {(["abiertas", "revisadas"] as Filtro[]).map((f) => {
          const activo = filtro === f;
          return (
            <Pressable
              key={f}
              onPress={() => cambiarFiltro(f)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              style={[styles.chip, activo && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                {f === "abiertas" ? "Por revisar" : "Revisadas"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {cargando ? (
        <ActivityIndicator color={AZUL} size="large" style={{ marginTop: 30 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : quejas.length === 0 ? (
        <Text style={styles.tenue}>
          {filtro === "abiertas"
            ? "No hay quejas por revisar."
            : "Aún no hay quejas revisadas."}
        </Text>
      ) : (
        quejas.map((q) => {
          const abierta = abiertaId === q.id;
          return (
            <View key={q.id} style={styles.tarjeta}>
              <Pressable onPress={() => abrir(q.id)} style={{ gap: 4 }}>
                <View style={styles.filaTitulo}>
                  <Text style={styles.tipo}>{q.tipo}</Text>
                  <Icono
                    nombre={abierta ? "chevron-up" : "chevron-down"}
                    tamano={18}
                  />
                </View>
                <Text style={styles.tenue}>
                  {formatearFechaHora(q.creadaEl)}
                  {q.servicio ? ` · ${q.servicio.tipoServicio}` : ""}
                  {` · ${q.fotosCliente.length} foto(s) del cliente`}
                </Text>
              </Pressable>

              {abierta && (
                <View style={{ gap: 12 }}>
                  <Text style={styles.texto}>{q.descripcion}</Text>

                  {q.servicio && (
                    <Text style={styles.tenue}>
                      {q.servicio.origen} → {q.servicio.destino}
                    </Text>
                  )}
                  <Text style={styles.dato}>
                    Cliente: {q.cliente.nombre || "Sin nombre"}
                    {q.cliente.telefono ? ` · ${q.cliente.telefono}` : ""}
                  </Text>
                  {q.transportista && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.dato}>
                        Transportista: {q.transportista.nombre || "Sin nombre"}
                        {q.transportista.telefono ? ` · ${q.transportista.telefono}` : ""}
                      </Text>
                      {renderEstadoConductor(q.transportista)}
                    </View>
                  )}

                  <Fotos
                    titulo="Fotos del cliente"
                    rutas={q.fotosCliente}
                    enlaces={enlaces}
                    vacio="El cliente no adjuntó fotos."
                    onAbrir={setFotoGrande}
                  />
                  <Fotos
                    titulo="Fotos de la recogida (transportista)"
                    rutas={q.fotosRecogida}
                    enlaces={enlaces}
                    vacio="No hay fotos de la recogida."
                    onAbrir={setFotoGrande}
                  />

                  {q.estado === "abierta" ? renderDecision(q) : renderResultado(q)}
                </View>
              )}
            </View>
          );
        })
      )}

      <Modal
        visible={!!fotoGrande}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFotoGrande(null)}
      >
        <Pressable style={styles.visor} onPress={() => setFotoGrande(null)}>
          {!!fotoGrande && (
            <Image
              source={{ uri: fotoGrande }}
              style={styles.visorImagen}
              resizeMode="contain"
            />
          )}
          <Text style={styles.visorCerrar}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const crearEstilos = (p: Paleta) =>
  StyleSheet.create({
    subtitulo: {
      color: p.textoAlfa(0.6),
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      marginBottom: -10,
    },
    titulo: { color: p.textoTitulo, fontSize: 26, fontWeight: "900" },
    descripcion: { color: p.textoTenue, fontSize: 13, lineHeight: 19 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.linea(0.15),
      backgroundColor: p.velo(0.04),
    },
    chipActivo: { backgroundColor: AZUL, borderColor: AZUL },
    chipTexto: { color: p.textoAlfa(0.75), fontSize: 13, fontWeight: "700" },
    chipTextoActivo: { color: "#FFFFFF" },
    tarjeta: {
      padding: 16,
      gap: 12,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: p.linea(0.15),
      backgroundColor: p.panel(0.94),
    },
    filaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    tipo: { color: p.texto, fontSize: 16, fontWeight: "800" },
    texto: { color: p.textoSuave, fontSize: 14, lineHeight: 20 },
    dato: { color: p.textoDato, fontSize: 13 },
    tenue: { color: p.textoTenue, fontSize: 12, lineHeight: 17 },
    etiqueta: { color: p.textoAlfa(0.7), fontSize: 12, fontWeight: "700" },
    error: { color: p.textoError, fontSize: 13 },
    fotos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    foto: { width: 84, height: 84, borderRadius: 10, backgroundColor: p.velo(0.1) },
    fotoVacia: { alignItems: "center", justifyContent: "center" },
    insignias: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    insignia: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
    },
    insigniaTexto: { fontSize: 11, fontWeight: "700" },
    opcion: {
      gap: 2,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.linea(0.12),
      backgroundColor: p.velo(0.03),
    },
    opcionActiva: {
      borderColor: "rgba(239,68,68,0.6)",
      backgroundColor: "rgba(239,68,68,0.10)",
    },
    opcionTitulo: { color: p.texto, fontSize: 14, fontWeight: "700" },
    prevista: { color: p.textoAviso, fontSize: 13, fontWeight: "700" },
    resultado: { color: p.texto, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    input: {
      color: p.texto,
      fontSize: 14,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.bordeCampo,
      backgroundColor: p.fondoProfundo,
      textAlignVertical: "top",
    },
    botones: { flexDirection: "row", gap: 10 },
    boton: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
    botonSecundario: { backgroundColor: p.velo(0.1) },
    botonPeligro: { backgroundColor: p.rellenoError },
    inactivo: { opacity: 0.5 },
    textoBoton: { color: p.texto, fontWeight: "800", fontSize: 14 },
    visor: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      gap: 12,
    },
    visorImagen: { width: "100%", height: "85%" },
    visorCerrar: { color: "#FFFFFF", fontSize: 13 },
  });
