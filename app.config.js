// app.config.js
//
// Toma toda la configuración de app.json y solo agrega el archivo de Firebase
// (google-services.json) si existe en la raíz del proyecto. Lo necesitan las
// notificaciones push en Android; sin él la app compila igual, solo que no
// recibe push. Ver supabase/LEEME.md, sección "Notificaciones push".
const fs = require("fs");

// Ruta relativa a la raíz del proyecto (desde donde Expo lee la configuración).
const ARCHIVO_FIREBASE = "./google-services.json";

module.exports = ({ config }) => {
  if (fs.existsSync(ARCHIVO_FIREBASE)) {
    config.android = { ...config.android, googleServicesFile: ARCHIVO_FIREBASE };
  }
  return config;
};
