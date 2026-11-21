"use client";

// ============================================================
// Escalado client-side de fotos de experiencias (propuesta Pro,
// Grupo A). Sin pipeline de blob storage: la imagen se re-encoda
// en el dispositivo (canvas → JPEG data URL) para que quepa en
// ExperiencePhoto.url sin infraestructura nueva. Intenta 1280px
// y baja a 960px si aún supera el tope de la API (~300 KB).
// ============================================================

const TOPE_CHARS = 400_000;

/** Lee un File y lo re-encoda a data URL JPEG escalada. */
export async function escalarFoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("lectura"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decodificación"));
    im.src = dataUrl;
  });

  for (const [ladoMax, calidad] of [
    [1280, 0.72],
    [960, 0.6],
    [720, 0.55],
  ] as const) {
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const salida = canvas.toDataURL("image/jpeg", calidad);
    if (salida.length <= TOPE_CHARS) return salida;
  }
  throw new Error("tamaño");
}
