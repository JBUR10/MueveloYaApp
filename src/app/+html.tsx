// src/app/+html.tsx
//
// Página HTML base de la versión web (no afecta Android ni iOS).
// Se declara en español y sin traducción automática: por defecto Expo la
// marca en inglés, Chrome la "traduce" cambiando los textos por su cuenta y
// React falla con "Failed to execute 'removeChild' on 'Node'".
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Google Chrome: no ofrecer ni aplicar traducción automática. */}
        <meta name="google" content="notranslate" />

        {/* Hace que el ScrollView ocupe toda la página, como en el celular. */}
        <ScrollViewStyleReset />

        {/* Fondo oscuro desde el primer instante (evita un destello blanco). */}
        <style dangerouslySetInnerHTML={{ __html: "body{background-color:#111318;}" }} />
      </head>
      <body className="notranslate">{children}</body>
    </html>
  );
}
