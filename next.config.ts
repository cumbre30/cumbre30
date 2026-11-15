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
      // /version.json es la fuente de «última versión» que consulta el
      // APK (lib/actualizacion.ts, desde el WebView en origen distinto):
      // CORS abierto para que el fetch pueda leerlo. En el export
      // estático no aplica (el APK usa el de la web desplegada).
      // OJO: headers() devuelve un ARRAY de reglas (Next 16), no un
      // objeto — un objeto inválido tumba el build (fallo Vercel del
      // 2026-11-15).
      async headers() {
        return [
          {
            source: "/version.json",
            headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
          },
        ];
      },
    };

export default nextConfig;
