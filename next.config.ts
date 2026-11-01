import type { NextConfig } from "next";

// Empaquetado nativo (Capacitor/APK):  STATIC_EXPORT=1 npx next build
// El build web normal (standalone / dev) no cambia en nada.
const isStaticExport = process.env.STATIC_EXPORT === "1";

const baseConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

const nextConfig: NextConfig = isStaticExport
  ? {
      ...baseConfig,
      output: "export",
      distDir: "build-static",
      images: { unoptimized: true },
    }
  : {
      ...baseConfig,
      output: "standalone",
    };

export default nextConfig;
