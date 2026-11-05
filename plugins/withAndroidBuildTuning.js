// Config plugin: sube la memoria que usa Gradle al compilar Android.
// Soluciona "java.lang.OutOfMemoryError: Metaspace" en los builds locales (GitHub Actions).
const { withGradleProperties } = require("expo/config-plugins");

module.exports = function withAndroidBuildTuning(config) {
  return withGradleProperties(config, (cfg) => {
    const setProp = (key, value) => {
      const existing = cfg.modResults.find(
        (item) => item.type === "property" && item.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: "property", key, value });
      }
    };

    setProp(
      "org.gradle.jvmargs",
      "-Xmx3g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
    );

    return cfg;
  });
};
