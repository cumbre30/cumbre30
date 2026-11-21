// ============================================================
// CT-M3 (v2.1 §9.1): durante las fases aditivas del módulo Rutas
// y Comunidad, las migraciones NO pueden contener DROP TABLE ni
// DROP COLUMN (la limpieza de deprecados se hace en un release
// posterior). Falla con exit 1 si encuentra alguno.
//   Uso: node scripts/check-migrations-additive.js
// ============================================================
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "prisma", "migrations");
if (!fs.existsSync(DIR)) {
  console.log("[check-migrations] sin carpeta de migraciones: nada que verificar.");
  process.exit(0);
}

const offenders = [];
for (const dir of fs.readdirSync(DIR).sort()) {
  const sqlPath = path.join(DIR, dir, "migration.sql");
  if (!fs.existsSync(sqlPath)) continue;
  const sql = fs.readFileSync(sqlPath, "utf8");
  // Ignora comentarios de línea (--...) y de bloque (/* ... */).
  const sinComentarios = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  const drops = [...sinComentarios.matchAll(/DROP\s+(TABLE|COLUMN)[^;]*;/gi)].map(
    (m) => `${dir}: ${m[0].trim().slice(0, 80)}`
  );
  offenders.push(...drops);
}

if (offenders.length > 0) {
  console.error("[check-migrations] FALLO: migraciones con DROP (fases aditivas):");
  for (const o of offenders) console.error("  " + o);
  process.exit(1);
}
console.log("[check-migrations] OK: ninguna migración contiene DROP TABLE/COLUMN.");
