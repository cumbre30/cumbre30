// ============================================================
// Entrega de archivos generados por la app (PNG, PDF…).
// - APK (WebView): el navegador embebido NO soporta <a download>
//   ni navigator.share, así que el archivo se escribe en el
//   caché con @capacitor/filesystem y se entrega por el panel
//   nativo de Android con @capacitor/share (correo, WhatsApp,
//   Drive, Archivos…).
// - Web normal: descarga directa con <a download>.
// ============================================================

import { Capacitor } from "@capacitor/core";

export type ShareOrDownloadResult = "shared" | "downloaded";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Blob → base64 puro (sin el prefijo data:). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
    fr.readAsDataURL(blob);
  });
}

/**
 * Entrega un archivo al usuario: panel nativo de Android en el APK,
 * descarga directa en la web. Devuelve cómo se entregó.
 */
export async function shareOrDownloadFile(opts: {
  blob: Blob;
  fileName: string;
  title: string;
  text?: string;
}): Promise<ShareOrDownloadResult> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const b64 = await blobToBase64(opts.blob);
    await Filesystem.writeFile({
      path: opts.fileName,
      directory: Directory.Cache,
      data: b64,
      recursive: true,
    });
    const uri = await Filesystem.getUri({ directory: Directory.Cache, path: opts.fileName });
    await Share.share({
      title: opts.title,
      text: opts.text,
      files: [uri.uri],
      dialogTitle: opts.title,
    });
    return "shared";
  }
  // Web: descarga por <a download> (sí funciona fuera del WebView).
  const url = URL.createObjectURL(opts.blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return "downloaded";
}
