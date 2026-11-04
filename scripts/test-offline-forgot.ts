// Prueba de lógica — flujo "olvidé mi contraseña" en el APK (cuentas
// locales de localStorage): código de recuperación XXXX-XXXX generado
// al registrar, mostrado en offlineMe y aceptado por offlineForgotReset.
// Correr: npx tsx scripts/test-offline-forgot.ts
// Requiere mock de localStorage/window (offlineAuth es browser-only).

type LS = Record<string, string>;
const backing: LS = {};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (k in backing ? backing[k] : null),
  setItem: (k: string, v: string) => { backing[k] = String(v); },
  removeItem: (k: string) => { delete backing[k]; },
  clear: () => { for (const k of Object.keys(backing)) delete backing[k]; },
};
(globalThis as unknown as { window: unknown }).window = globalThis;

import {
  offlineForgotReset,
  offlineLogin,
  offlineLogout,
  offlineMe,
  offlineRegister,
} from "../src/lib/offlineAuth";

let fails = 0;
function chk(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${ok ? "" : ` → ${extra}`}`);
  if (!ok) fails++;
}

const RECOVERY_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

async function main() {
  // 1. Registro crea cuenta con código de recuperación visible en MeData
  const regErr = await offlineRegister({ email: "qa.off@test.cl", username: "qaoff", password: "vieja123" });
  chk("registro offline sin error", regErr === null, regErr ?? "");
  const me = offlineMe();
  chk("offlineMe expone recoveryCode", !!me?.user.recoveryCode, JSON.stringify(me?.user.recoveryCode));
  chk("formato XXXX-XXXX", RECOVERY_RE.test(me?.user.recoveryCode ?? ""), me?.user.recoveryCode ?? "—");
  const code = me?.user.recoveryCode ?? "";

  // 2. Logout y restablecimiento con código
  offlineLogout();
  const badErr = await offlineForgotReset({ email: "qa.off@test.cl", recoveryCode: "ZZZZ-9999", newPassword: "nueva456" });
  chk("código incorrecto rechazado", badErr === "Código de recuperación incorrecto.", badErr ?? "—");
  const fmtErr = await offlineForgotReset({ email: "qa.off@test.cl", recoveryCode: "abc", newPassword: "nueva456" });
  chk("formato inválido rechazado", fmtErr !== null, fmtErr ?? "—");
  const ghostErr = await offlineForgotReset({ email: "fantasma@test.cl", recoveryCode: code, newPassword: "nueva456" });
  chk("correo inexistente rechazado", ghostErr !== null, ghostErr ?? "—");
  const shortErr = await offlineForgotReset({ email: "qa.off@test.cl", recoveryCode: code, newPassword: "123" });
  chk("contraseña corta rechazada", shortErr !== null, shortErr ?? "—");

  const oldLogin = await offlineLogin({ email: "qa.off@test.cl", password: "vieja123" });
  chk("contraseña vieja aún funciona antes del reset", oldLogin === null, oldLogin ?? "—");
  offlineLogout();

  const okErr = await offlineForgotReset({ email: "qa.off@test.cl", recoveryCode: code.toLowerCase(), newPassword: "nueva456" });
  chk("restablecimiento con código (minúsculas ok)", okErr === null, okErr ?? "—");

  // 3. La contraseña nueva entra; la vieja no
  const oldAfter = await offlineLogin({ email: "qa.off@test.cl", password: "vieja123" });
  chk("contraseña vieja rechazada tras reset", oldAfter === "Correo o contraseña incorrectos.", oldAfter ?? "—");
  const newLogin = await offlineLogin({ email: "qa.off@test.cl", password: "nueva456" });
  chk("contraseña nueva funciona", newLogin === null, newLogin ?? "—");
  chk("sesión activa tras login", offlineMe() !== null);

  // 4. Cuenta antigua sin recoveryCode: se genera al hacer login
  const raw = JSON.parse(backing["cumbre30-offline-users-v1"] ?? "{}") as Record<string, { recoveryCode?: string }>;
  if (raw["qa.off@test.cl"]) raw["qa.off@test.cl"].recoveryCode = undefined;
  backing["cumbre30-offline-users-v1"] = JSON.stringify(raw);
  offlineLogout();
  const legacyLogin = await offlineLogin({ email: "qa.off@test.cl", password: "nueva456" });
  chk("cuenta antigua puede entrar", legacyLogin === null, legacyLogin ?? "—");
  const me2 = offlineMe();
  chk("código generado para cuenta antigua", RECOVERY_RE.test(me2?.user.recoveryCode ?? ""), me2?.user.recoveryCode ?? "—");

  console.log(fails === 0 ? "\nTODO OK" : `\n${fails} FALLAS`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test error:", e);
  process.exit(1);
});
