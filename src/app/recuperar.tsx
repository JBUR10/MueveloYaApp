// src/app/recuperar.tsx
// Recuperar contraseña: 1) se pide el correo, 2) se escribe el código que
// llega por correo junto con la nueva contraseña.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import {
  BotonPrincipal,
  Campo,
  Enlace,
  esCorreoValido,
  PantallaAuth,
} from "../components/auth/FormularioAuth";
import { aviso } from "../components/ui/AlertaPantalla";
import { mensajeErrorAuth, supabase } from "../lib/supabase";
import { marcarRecuperandoClave } from "../services/sesionStore";

export default function RecuperarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ correo?: string }>();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [correo, setCorreo] = useState(params.correo ?? "");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<
    Partial<Record<"correo" | "codigo" | "clave", string>>
  >({});
  const [cargando, setCargando] = useState(false);

  const email = correo.trim().toLowerCase();

  const enviarCodigo = async () => {
    if (!esCorreoValido(correo)) {
      setErrores({ correo: "Escribe un correo válido." });
      return;
    }
    setErrores({});
    setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);

    if (error) {
      await aviso("No se pudo enviar", mensajeErrorAuth(error), "error");
      return;
    }
    setPaso(2);
  };

  const cambiarClave = async () => {
    const nuevos: typeof errores = {};
    if (codigo.length < 6) nuevos.codigo = "Escribe el código del correo.";
    if (clave.length < 6)
      nuevos.clave = "La contraseña debe tener al menos 6 caracteres.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setCargando(true);
    // Verificar el código abre sesión: se avisa al _layout para que no salte
    // a la app antes de guardar la nueva contraseña.
    marcarRecuperandoClave(true);
    try {
      const { error: errorCodigo } = await supabase.auth.verifyOtp({
        email,
        token: codigo,
        type: "recovery",
      });
      if (errorCodigo) {
        setErrores({ codigo: mensajeErrorAuth(errorCodigo) });
        return;
      }

      const { error: errorClave } = await supabase.auth.updateUser({
        password: clave,
      });
      if (errorClave) {
        await supabase.auth.signOut();
        await aviso("No se pudo cambiar", mensajeErrorAuth(errorClave), "error");
        return;
      }

      await aviso(
        "Contraseña actualizada",
        "Ya puedes usar tu nueva contraseña.",
        "exito",
      );
    } finally {
      setCargando(false);
      marcarRecuperandoClave(false);
    }
  };

  return (
    <PantallaAuth
      etiqueta="RECUPERAR ACCESO"
      titulo="Nueva"
      resaltado="contraseña"
      descripcion={
        paso === 1
          ? "Escribe tu correo y te enviaremos un código."
          : `Escribe el código que enviamos a ${email} y tu nueva contraseña.`
      }
    >
      {paso === 1 ? (
        <>
          <Campo
            etiqueta="Correo electrónico"
            value={correo}
            onChangeText={setCorreo}
            placeholder="tucorreo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={enviarCodigo}
            error={errores.correo}
          />
          <BotonPrincipal
            texto="Enviar código"
            onPress={enviarCodigo}
            cargando={cargando}
          />
        </>
      ) : (
        <>
          <Campo
            etiqueta="Código"
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, ""))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={8}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            error={errores.codigo}
          />
          <Campo
            etiqueta="Nueva contraseña"
            value={clave}
            onChangeText={setClave}
            placeholder="Mínimo 6 caracteres"
            clave
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={cambiarClave}
            error={errores.clave}
          />
          <BotonPrincipal
            texto="Cambiar contraseña"
            onPress={cambiarClave}
            cargando={cargando}
          />
          <Enlace accion="Usar otro correo" onPress={() => setPaso(1)} />
        </>
      )}

      <Enlace
        accion="Volver al inicio de sesión"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/login")
        }
      />
    </PantallaAuth>
  );
}
