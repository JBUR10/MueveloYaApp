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
        <title>Muevelo Ya</title>
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
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function normalizarTitulo(){var titulos=document.head.querySelectorAll('title');var titulo=titulos[0];if(!titulo){titulo=document.createElement('title');document.head.appendChild(titulo);}if(titulo.textContent!=='Muevelo Ya'){titulo.textContent='Muevelo Ya';}for(var i=1;i<titulos.length;i++){titulos[i].remove();}if(document.title!=='Muevelo Ya'){document.title='Muevelo Ya';}}normalizarTitulo();if(document.head&&typeof MutationObserver==='function'){var observador=new MutationObserver(normalizarTitulo);observador.observe(document.head,{childList:true,subtree:true,characterData:true});}})();",
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "body{background-color:#111318;}html[data-tema=claro] body{background-color:#EEF2F8;}",
          }}
        />
      </head>
      <body className="notranslate">
        <main
          id="contenido-principal"
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            height: "100%",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
