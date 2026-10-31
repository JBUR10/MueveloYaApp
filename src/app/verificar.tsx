// src/app/verificar.tsx
// Confirma el correo con el código que Supabase envía al registrarse.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  BotonPrincipal,
  Campo,
  Enlace,
  PantallaAuth,
} from "../components/auth/FormularioAuth";
import { aviso } from "../components/ui/AlertaPantalla";
import { mensajeErrorAuth, supabase } from "../lib/supabase";

/** Segundos de espera antes de permitir reenviar el código. */
const ESPERA_REENVIO = 60;

export default function VerificarScreen() {
  const router = useRouter();
  const { correo = "" } = useLocalSearchParams<{ correo?: string }>();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const verificar = async () => {
    const limpio = codigo.replace(/\D/g, "");
    // Supabase usa 6 dígitos por defecto; algunos proyectos usan hasta 8.
    if (limpio.length < 6) {
      setError("Escribe el código que llegó a tu correo.");
      return;
    }
    setError("");
    setCargando(true);
    const { error: e } = await supabase.auth.verifyOtp({
      email: correo,
      token: limpio,
      type: "email",
    });
    setCargando(false);

    // Si es correcto, se abre la sesión y el _layout entra a la app.
    if (e) setError(mensajeErrorAuth(e));
  };

  const reenviar = async () => {
    const { error: e } = await supabase.auth.resend({
      type: "signup",
      email: correo,
    });
    if (e) {
      await aviso("No se pudo reenviar", mensajeErrorAuth(e), "error");
      return;
    }
    setEspera(ESPERA_REENVIO);
    await aviso("Código enviado", `Revisa la bandeja de ${correo}.`, "exito");
  };

  return (
    <PantallaAuth
      etiqueta="VERIFICACIÓN"
      titulo="Confirma tu"
      resaltado="correo"
      descripcion={`Enviamos un código a ${correo || "tu correo"}. Si no lo ves, revisa la carpeta de spam.`}
    >
      <Campo
        etiqueta="Código de verificación"
        value={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, ""))}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={8}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={verificar}
        error={error}
      />

      <BotonPrincipal
        texto="Verificar"
        onPress={verificar}
        cargando={cargando}
      />

      <Enlace
        texto="¿No te llegó?"
        accion={espera > 0 ? `Reenviar en ${espera} s` : "Reenviar código"}
        onPress={() => espera <= 0 && reenviar()}
      />
      <Enlace
        accion="Volver al inicio de sesión"
        onPress={() => router.replace("/login")}
      />
    </PantallaAuth>
  );
}
