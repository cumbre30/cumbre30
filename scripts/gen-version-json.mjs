#!/usr/bin/env node
// Genera public/version.json desde appVersion.ts (fuente única).
// Lo llaman el build web (Vercel) y el export estático (APK) para
// que ambos sirvan siempre la versión actual. El APK compara este
// archivo contra su versión instalada (lib/actualizacion.ts): es el
// corazon del «revisar actualizaciones».
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("src/lib/appVersion.ts", "utf8");
const take = (k) => (src.match(new RegExp(`export const ${k} = "([^"]+)"`)) || [])[1];
const takeN = (k) => Number((src.match(new RegExp(`export const ${k} = (\\d+)`)) || [])[1]);
const version = take("APP_VERSION");
const code = takeN("APP_VERSION_CODE");
const apk = take("APK_FILE_NAME");
if (!version || !code || !apk) throw new Error("No se pudo leer appVersion.ts");
mkdirSync("public", { recursive: true });
writeFileSync(
  "public/version.json",
  JSON.stringify(
    {
      version,
      code,
      apk,
      url: "https://github.com/cumbre30/cumbre30/releases/latest/download/cumbre30-latest.apk",
    },
    null,
    2,
  ) + "\n",
);
console.log(`version.json → v${version} (code ${code})`);
