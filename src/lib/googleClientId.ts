// ID de cliente OAuth "Web application" de Google Cloud Console.
// ÚNICA fuente de verdad: lo usa el plugin nativo del APK
// (src/lib/googleAuth.ts) para pedir el idToken y el servidor
// (/api/auth/google) para validar su audiencia. Mismo proyecto.
export const GOOGLE_WEB_CLIENT_ID =
  "1083733199182-gbe3bnj00bivr7la3d4s80r5av7r964e.apps.googleusercontent.com";
