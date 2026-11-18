// ============================================================
// Generador CLI de códigos Cumbre30 Pro.
//   Uso:  node scripts/gen-license.mjs correo@ejemplo.cl
// Devuelve un código C30P-XXXX-XXXX-XXXX-XXXX ligado al correo.
// El secreto debe coincidir con src/lib/proLicenseServer.ts
// (secreto vigente, rotado 2026-11-18; solo servidor).
// ============================================================

import { webcrypto as crypto } from "node:crypto";

const SECRET = "f4578021d16b8302bb52aa0ce5ac41624b3019253b6533b567c1f65620ea15f1";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const normalizeEmail = (e) => e.trim().toLowerCase();

function toBase32(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

async function generateCode(email) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(normalizeEmail(email))));
  const raw = toBase32(sig.slice(0, 10));
  return `C30P-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

const email = process.argv[2];
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Uso: node scripts/gen-license.mjs correo@ejemplo.cl");
  process.exit(1);
}
const code = await generateCode(email);
console.log(`Correo: ${normalizeEmail(email)}`);
console.log(`Código: ${code}`);
