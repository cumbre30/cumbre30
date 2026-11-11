// Debug: por qué el banner de clima no aparece
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log(`[console:${m.type()}]`, m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

// ¿Llegó la llamada a Open-Meteo?
const reqs = [];
page.on("request", (r) => reqs.push(r.url()));
const listo = reqs.filter((u) => u.includes("open-meteo"));
console.log("Requests a open-meteo:", listo.length);

// Probar fetch directo en el contexto de la página
const resultado = await page.evaluate(async () => {
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-33.408&longitude=-70.636&current=temperature_2m,weather_code");
    const j = await r.json();
    return { ok: r.ok, temp: j.current?.temperature_2m, code: j.current?.weather_code, online: navigator.onLine };
  } catch (e) {
    return { error: String(e), online: navigator.onLine };
  }
});
console.log("Fetch en página:", JSON.stringify(resultado));

// ¿Qué hay en el localStorage del caché?
const cache = await page.evaluate(() => localStorage.getItem("cumbre30-clima-v1"));
console.log("Caché clima:", cache);

await browser.close();
console.log("DEBUG_LISTO");
