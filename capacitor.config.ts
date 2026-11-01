import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.cumbre30.app",
  appName: "Cumbre30",
  webDir: "build-static",
  android: {
    allowMixedContent: false,
  },
};

export default config;
