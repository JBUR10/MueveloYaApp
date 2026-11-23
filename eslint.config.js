// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // eslint-config-expo 58 trae reglas nuevas de react-hooks (React Compiler) que
    // marcan patrones válidos que ya usaba la app (setState dentro de efectos,
    // refs actualizadas al renderizar). No son fallos: se dejan como advertencia
    // para ir corrigiéndolas con calma en vez de reescribir pantallas de golpe.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Falso positivo: AndroidImportance sí existe en expo-notifications (también
    // en el SDK 58); la regla no lo ve porque el módulo tiene archivos por plataforma.
    files: ["src/services/notificacionesPush.ts"],
    rules: {
      "import/namespace": "off",
    },
  },
]);
