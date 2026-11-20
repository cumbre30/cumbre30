#!/usr/bin/env node
/**
 * Build del APK (v1.14.1): export estático de Next SIN las rutas /api.
 *
 * Con Next 16 el export estático (`output: "export"`) ya no admite
 * route handlers dinámicos — ni siquiera con `export const dynamic =
 * "force-dynamic"` — y todas las rutas de /api lo son (la API vive
 * en el despliegue web; el APK habla con el servidor por URL
 * absoluta, nunca con stubs locales). Con el upgrade a Next 16 el
 * build del APK quedó roto para TODAS las rutas API.
 *
 * Solución: mover src/app/api fuera del árbol durante el build y
 * restituirlo después (con garantía de restore aunque el build
 * falle). El export queda sin /api, que es exactamente lo que el
 * APK necesita.
 *
 * Uso: node scripts/build-apk.mjs [--full]
 *   --full: además corre cap sync android y gradle assembleDebug
 *           (genera el APK de prueba en android/app/build/outputs/).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "src", "app", "api");
// Fuera de src/app: una carpeta oculta dentro de app/ seguiría
// compilándose como rutas (visto en el build real). Un dir oculto
// de la raíz del proyecto no es parte del árbol de Next.
const API_HOLD = join(ROOT, ".apk-hold", "api");
const FULL = process.argv.includes("--full");

const run = (cmd, cwd = ROOT) => {
  const r = spawnSync(cmd, [], { stdio: "inherit", cwd, shell: true });
  if (r.error) {
    throw new Error(`no se pudo ejecutar: ${cmd} — ${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(`falló: ${cmd} (exit ${r.status}${r.signal ? ", señal " + r.signal : ""})`);
  }
};

let apiFuera = false;
const devolverApi = () => {
  if (!apiFuera) return;
  apiFuera = false;
  try {
    renameSync(API_HOLD, API_DIR);
    console.log("✓ src/app/api restituido");
  } catch (e) {
    // Última línea de defensa: jamás dejar el árbol sin la API.
    console.error("✗ ERROR RESTITUYENDO src/app/api:", e.message);
    console.error(`  devolverlo a mano: mv ${API_HOLD} ${API_DIR}`);
    process.exit(2);
  }
};

try {
  // 1. Aislar las rutas API durante el export (siempre con restore).
  if (existsSync(API_HOLD)) {
    rmSync(API_HOLD, { recursive: true, force: true });
  }
  mkdirSync(dirname(API_HOLD), { recursive: true });
  renameSync(API_DIR, API_HOLD);
  apiFuera = true;
  console.log("✓ src/app/api aislado para el export");

  // 2. Export estático del APK (sin /api).
  run("STATIC_EXPORT=1 npx next build");
  const index = join(ROOT, "build-static", "index.html");
  if (!existsSync(index) || statSync(index).size === 0) {
    throw new Error("build-static/index.html no existe o está vacío");
  }
  if (existsSync(join(ROOT, "build-static", "api"))) {
    throw new Error("build-static/api no debería existir en el export");
  }
  console.log("✓ export estático sin /api listo (build-static/)");
  devolverApi();

  if (FULL) {
    // 3. Sync de Capacitor (assets web + configuración de plugins).
    run("npx cap sync android");
    // 4. APK de prueba. Maven Central puede devolver 429 (rate limit
    //    por IP): con reintento cada intento descarga un poco más a
    //    la caché de gradle hasta resolver todo.
    const intentos = [1, 2, 3, 4];
    for (const i of intentos) {
      const ok = spawnSync("./gradlew assembleDebug --console=plain", [], {
        stdio: "inherit", cwd: join(ROOT, "android"), shell: true,
      });
      if (ok.status === 0) break;
      if (i === intentos[intentos.length - 1]) {
        throw new Error(`gradle assembleDebug falló (exit ${ok.status})`);
      }
      console.log(`  gradle falló (intento ${i}), reintentando en 100 s...`);
      spawnSync("sleep", ["100"]);
    }
    console.log("✓ APK: android/app/build/outputs/apk/debug/app-debug.apk");
  }
} catch (e) {
  devolverApi();
  console.error("✗ BUILD APK FALLÓ:", e.message);
  process.exit(1);
}
