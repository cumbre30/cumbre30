// ============================================================
// Cumbre30 Pro - licencias del LADO DEL SERVIDOR (B-03/R-03).
// El secreto actual vive SOLO aquí: este módulo es importado
// únicamente por rutas de API (export-web.sh excluye src/app/api),
// así que nunca llega al APK. La app valida códigos nuevos contra
// /api/licencia/validar; los códigos antiguos siguen validando
// offline con el secreto legado de proLicenseCore.ts.
// Debe coincidir con scripts/gen-license.mjs.
// ============================================================

import { cleanCode, generateProLicenseCode, PRO_LICENSE_SECRET_LEGACY } from "./proLicenseCore";

// Secreto vigente (rotado 2026-11-18): vive SOLO en la variable de
// entorno PRO_LICENSE_SECRET de Vercel. El repo de GitHub es público,
// así que un secreto hardcodeado aquí sería forjable por cualquiera
// (lección del release v1.13.0). NO exportar a código cliente.
const PRO_LICENSE_SECRET_CURRENT = process.env.PRO_LICENSE_SECRET ?? "";

/** Código nuevo para un correo (ventas Mercado Pago, CLI, /api/licencia). */
export async function generateCurrentProLicenseCode(email: string): Promise<string> {
  if (!PRO_LICENSE_SECRET_CURRENT) {
    throw new Error("PRO_LICENSE_SECRET no configurada en el servidor");
  }
  return generateProLicenseCode(email, PRO_LICENSE_SECRET_CURRENT);
}

/** ¿El código corresponde a este correo? Acepta legado y vigente. */
export async function validateAnyProLicenseCode(email: string, code: string): Promise<boolean> {
  const secretos = [PRO_LICENSE_SECRET_CURRENT, PRO_LICENSE_SECRET_LEGACY].filter(Boolean);
  const candidates = await Promise.all(
    secretos.map((secreto) => generateProLicenseCode(email, secreto)),
  );
  const given = cleanCode(code);
  if (!given) return false;
  for (const candidate of candidates) {
    const expected = cleanCode(candidate);
    if (given.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff === 0) return true;
  }
  return false;
}
