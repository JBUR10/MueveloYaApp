// src/app/registro.tsx
import { useRouter } from "expo-router";
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

type Errores = Partial<
  Record<"nombre" | "telefono" | "correo" | "clave" | "confirmacion", string>
>;

export default function RegistroScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [cargando, setCargando] = useState(false);

  const registrar = async () => {
    const nuevos: Errores = {};
    if (nombre.trim().length < 3) nuevos.nombre = "Escribe tu nombre completo.";
    if (!/^3\d{9}$/.test(telefono.replace(/\D/g, "")))
      nuevos.telefono = "Escribe un celular de 10 dígitos (ej. 3001234567).";
    if (!esCorreoValido(correo)) nuevos.correo = "Escribe un correo válido.";
    if (clave.length < 6)
      nuevos.clave = "La contraseña debe tener al menos 6 caracteres.";
    if (confirmacion !== clave)
      nuevos.confirmacion = "Las contraseñas no coinciden.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    const email = correo.trim().toLowerCase();
    setCargando(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: clave,
      // El trigger de la base de datos crea el perfil con estos datos.
      options: {
        data: { nombre: nombre.trim(), telefono: telefono.replace(/\D/g, "") },
      },
    });
    setCargando(false);

    if (error) {
      await aviso("No pudimos crear tu cuenta", mensajeErrorAuth(error), "error");
      return;
    }

    // Con la confirmación activa, Supabase no da error si el correo ya existe:
    // devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) {
      await aviso(
        "Correo ya registrado",
        "Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.",
        "advertencia",
      );
      return;
    }

    // Si la confirmación de correo está apagada en Supabase, ya hay sesión
    // y el _layout entra directo a la app.
    if (data.session) return;

    router.replace({ pathname: "/verificar", params: { correo: email } });
  };

  return (
    <PantallaAuth
      etiqueta="NUEVA CUENTA"
      titulo="Crea tu"
      resaltado="cuenta"
      descripcion="Te enviaremos un código a tu correo para confirmarla."
    >
      <Campo
        etiqueta="Nombre completo"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej. Ana María Gómez"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        error={errores.nombre}
      />
      <Campo
        etiqueta="Celular"
        value={telefono}
        onChangeText={setTelefono}
        placeholder="3001234567"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={13}
        error={errores.telefono}
      />
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
        placeholder="Mínimo 6 caracteres"
        clave
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={errores.clave}
      />
      <Campo
        etiqueta="Confirmar contraseña"
        value={confirmacion}
        onChangeText={setConfirmacion}
        placeholder="Repite la contraseña"
        clave
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={registrar}
        error={errores.confirmacion}
      />

      <BotonPrincipal
        texto="Crear cuenta"
        onPress={registrar}
        cargando={cargando}
      />

      <Enlace
        texto="¿Ya tienes cuenta?"
        accion="Inicia sesión"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/login")
        }
      />
    </PantallaAuth>
  );
}
