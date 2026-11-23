// src/app/+html.tsx
//
// Página HTML base de la versión web (no afecta Android ni iOS).
// Se declara en español y sin traducción automática: por defecto Expo la
// marca en inglés, Chrome la "traduce" cambiando los textos por su cuenta y
// React falla con "Failed to execute 'removeChild' on 'Node'".
//
// SDK 58: este componente DEBE renderizar lo que entrega
// useServerDocumentContext(): headNodes dentro de <head> y bodyNodes después
// de {children} dentro de <body>. bodyNodes trae los bundles de JavaScript;
// sin él la página web carga pero nunca se vuelve interactiva.
import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } =
    useServerDocumentContext();

  return (
    <html lang="es" translate="no" {...htmlAttributes}>
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

        {/* Fondo del tema desde el primer instante (evita un destello blanco).
            El oscuro es el principal; si la persona eligió el claro, este
            script lo detecta antes de que cargue la app. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('@mueveloya_tema')==='claro'){document.documentElement.setAttribute('data-tema','claro');document.documentElement.style.colorScheme='light';}}catch(e){}",
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "body{background-color:#111318;}html[data-tema=claro] body{background-color:#EEF2F8;}",
          }}
        />

        {/* Estilos y metadatos generados por Expo Router. */}
        {headNodes}
      </head>
      <body className="notranslate" {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
