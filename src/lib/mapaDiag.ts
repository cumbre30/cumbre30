// ============================================================
// Diagnóstico de mapas (v1.13.5): el render nativo quedó dormido
// tras dos intentos fallidos en dispositivo (v1.13.2–v1.13.4: mapa
// negro con backend Vulkan y también con OpenGL ES del artefacto
// -opengl). En v1.3.1 ya se había documentado que el WebView de ese
// teléfono no renderiza NI el mapa nativo NI el GL JS web.
// Para el próximo intento necesitamos datos reales: GPU que reporta
// el WebView, soporte WebGL1/2, versión de Android/Chrome. Se
// recolecta al abrir Configuración → Acerca de y se muestra en la
// misma pantalla: una captura vale como reporte completo.
// ============================================================

export type MapaDiag = {
  cuando: string;
  android: string;
  webview: string;
  webgl1: boolean;
  webgl2: boolean;
  gpu: string;
  motorMapas: string;
};

/** Sonda WebGL: ¿hay contexto y qué GPU reporta? Sin pintar nada. */
export function recolectarDiagMapa(): MapaDiag {
  let webgl1 = false;
  let webgl2 = false;
  let gpu = "(sin WebGL)";
  try {
    const c = document.createElement("canvas");
    const g2 = c.getContext("webgl2") as WebGL2RenderingContext | null;
    if (g2) {
      webgl2 = true;
      gpu = leerGpu(g2);
      g2.getExtension("WEBGL_lose_context")?.loseContext();
    } else {
      const g1 = c.getContext("webgl") as WebGLRenderingContext | null;
      if (g1) {
        webgl1 = true;
        gpu = leerGpu(g1);
        g1.getExtension("WEBGL_lose_context")?.loseContext();
      }
    }
  } catch {
    // GL bloqueado: queda "(sin WebGL)"
  }
  const ua = navigator.userAgent;
  const mAnd = ua.match(/Android\s+([\d.]+)/i);
  const mChrome = ua.match(/Chrome\/([\d.]+)/i);
  return {
    cuando: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    android: mAnd ? `Android ${mAnd[1]}` : "no-Android",
    webview: mChrome ? `Chrome/${mChrome[1].split(".").slice(0, 2).join(".")}` : "n/d",
    webgl1,
    webgl2,
    gpu,
    motorMapas: "Leaflet ráster (compatibilidad)",
  };
}

function leerGpu(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL?: number } | null;
    const real = ext?.UNMASKED_RENDERER_WEBGL != null ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : null;
    return real || (gl.getParameter(gl.RENDERER) as string) || "n/d";
  } catch {
    return "n/d";
  }
}
