import type { NextConfig } from "next";

// Empaquetado nativo (Capacitor/APK):  STATIC_EXPORT=1 npx next build
// El build web normal (standalone / dev) no cambia en nada.
const isStaticExport = process.env.STATIC_EXPORT === "1";

const baseConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Sin el botón flotante «N» de dev-tools en dev/preview: tapaba la
  // píldora «Capas del mapa» del mapa general en la esquina inferior
  // izquierda (captura del cliente 2026-11-11).
  devIndicators: false,
  // Evita el warning "Cross origin request detected" del dev server
  // cuando la vista previa accede desde el dominio del gateway.
  allowedDevOrigins: ["*.space-z.ai"],
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
