import type { CapacitorConfig } from "@capacitor/cli";
import { APP_VERSION } from "./src/lib/appVersion";

const config: CapacitorConfig = {
  appId: "cl.cumbre30.app",
  appName: "Cumbre30",
  webDir: "build-static",
  // v1.13.2: la política de tiles de OSM France exige que las peticiones
  // de una app móvil viajen con un user-agent que identifique la app
  // (openstreetmap.fr/usage/). Apendamos al UA del WebView, sin override.
  appendUserAgent: `Cumbre30/${APP_VERSION} (Android)`,
  android: {
    allowMixedContent: false,
  },
};

export default config;
