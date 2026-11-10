// Capturas de verificación: Explorar (senderos), Ride (SOS/horario), Desafíos (pin nuevo)
import { chromium } from "playwright";

const browser = await chromium.launch();

// 1. Explorar: panel FREE con bloque de senderos
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p1.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60000 });
await p1.getByRole("button", { name: /explorar/i }).first().click();
await p1.waitForTimeout(2500);
await p1.screenshot({ path: "/home/z/my-project/download/verify-explorar.png" });

// 2. Ride: banner horario + botón SOS
await p1.getByRole("button", { name: /ride/i }).first().click();
await p1.waitForTimeout(2000);
await p1.screenshot({ path: "/home/z/my-project/download/verify-ride.png" });

// 3. SOS abierto
await p1.getByRole("button", { name: /abrir tarjeta de emergencia/i }).click();
await p1.waitForTimeout(600);
await p1.screenshot({ path: "/home/z/my-project/download/verify-sos.png" });
await p1.getByRole("button", { name: /cerrar tarjeta de emergencia/i }).click();

// 4. Desafíos: reto Pedalea Seguro (está en perfil → desafíos)
await p1.getByRole("button", { name: /credencial/i }).first().click();
await p1.waitForTimeout(1000);
await p1.getByRole("button", { name: /ride/i }).first().click();
await p1.waitForTimeout(500);

await browser.close();
console.log("OK capturas");
