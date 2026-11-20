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
      // Las rutas /api NO van en el export del APK: con Next 16 una
      // route handler dinámica ya no se puede exportar (rompía el
      // build). Las excluye scripts/build-apk.mjs moviendo src/app/api
      // fuera del árbol durante el build — la API vive en el despliegue
      // web y el APK habla con el servidor por URL absoluta. (v1.14.1)
    }
  : {
      ...baseConfig,
      output: "standalone",
      // NOTA (v1.12.4): el CORS de /api/version va en el propio route
      // handler (Access-Control-Allow-Origin en la Response) — sin
      // headers() en el config. Un headers() mal formado tumba el
      // build de Vercel en validación (fallo del 2026-11-15); el
      // export estático del APK no pasa por aquí, así que cualquier
      // cambio en esta rama hay que probarlo con next build local.
    };

export default nextConfig;
