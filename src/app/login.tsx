// src/app/login.tsx
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  BotonPrincipal,
  Campo,
  Enlace,
  esCorreoValido,
  PantallaAuth,
} from "../components/auth/FormularioAuth";
import { aviso, confirmar } from "../components/ui/AlertaPantalla";
import { mensajeErrorAuth, supabase } from "../lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<{ correo?: string; clave?: string }>(
    {},
  );
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    const nuevos: typeof errores = {};
    if (!esCorreoValido(correo)) nuevos.correo = "Escribe un correo válido.";
    if (!clave) nuevos.clave = "Escribe tu contraseña.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    });
    setCargando(false);

    // Si entra bien, el _layout cambia solo a la app.
    if (!error) return;

    if (error.message.toLowerCase().includes("email not confirmed")) {
      const ok = await confirmar({
        titulo: "Confirma tu correo",
        mensaje:
          "Tu cuenta aún no está verificada. ¿Quieres que te enviemos un nuevo código?",
        textoAceptar: "Enviar código",
      });
      if (!ok) return;

      const { error: errorReenvio } = await supabase.auth.resend({
        type: "signup",
        email: correo.trim().toLowerCase(),
      });
      if (errorReenvio) {
        await aviso("No se pudo enviar", mensajeErrorAuth(errorReenvio), "error");
        return;
      }
      router.push({
        pathname: "/verificar",
        params: { correo: correo.trim().toLowerCase() },
      });
      return;
    }

    await aviso("No pudimos iniciar sesión", mensajeErrorAuth(error), "error");
  };

  return (
    <PantallaAuth
      etiqueta="BIENVENIDO"
      titulo="Inicia"
      resaltado="sesión"
      descripcion="Solicita servicios de transporte o trabaja como transportista."
    >
      <Campo
        etiqueta="Correo electrónico"
        value={correo}
        onChangeText={setCorreo}
        placeholder="tucorreo@ejemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={errores.correo}
      />
      <Campo
        etiqueta="Contraseña"
        value={clave}
        onChangeText={setClave}
        placeholder="Tu contraseña"
        clave
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={entrar}
        error={errores.clave}
      />

      <Enlace
        accion="¿Olvidaste tu contraseña?"
        onPress={() =>
          router.push({
            pathname: "/recuperar",
            params: { correo: correo.trim().toLowerCase() },
          })
        }
      />

      <BotonPrincipal texto="Entrar" onPress={entrar} cargando={cargando} />

      <Enlace
        texto="¿No tienes cuenta?"
        accion="Regístrate"
        onPress={() => router.push("/registro")}
      />
    </PantallaAuth>
  );
}
