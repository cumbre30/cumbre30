// Genera los assets fuente de @capacitor/assets para iOS desde logo.svg.
// Identidad: fondo #09090b (igual que el launcher Android) + logo trazo blanco.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const BG = "#09090b";
const LOGO = "public/logo.svg";
mkdirSync("assets", { recursive: true });

async function renderLogo(size) {
  // SVG 30x30 viewBox → rasteriza a `size` px con fondo transparente.
  return await sharp(LOGO, { density: 72 * (size / 30) * 1.5 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function solid(size) {
  return await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .png()
    .toBuffer();
}

async function compose(bgBuf, logoBuf, logoFraction, out) {
  const size = 1024;
  const inner = Math.round(size * logoFraction);
  const logoSmall = await sharp(logoBuf).resize(inner, inner).png().toBuffer();
  await sharp(bgBuf)
    .composite([{ input: logoSmall, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("OK", out);
}

const bg1024 = await solid(1024);
const logo1024 = await renderLogo(1024);

// Ícono: logo grande centrado sobre fondo de marca.
await compose(bg1024, logo1024, 0.78, "assets/icon-only.png");
await sharp(bg1024).png().toFile("assets/icon-background.png").then(() => console.log("OK assets/icon-background.png"));
await compose(bg1024, logo1024, 0.55, "assets/icon-foreground.png");
await compose(bg1024, logo1024, 0.78, "assets/icon.png");

// Splash: 2732×2732, fondo oscuro + logo centrado al 22%.
const splashBg = await solid(2732);
const logo600 = await sharp(await renderLogo(1024)).resize(600, 600).png().toBuffer();
await sharp(splashBg)
  .composite([{ input: logo600, gravity: "center" }])
  .png()
  .toFile("assets/splash.png");
console.log("OK assets/splash.png");
await sharp(splashBg)
  .composite([{ input: logo600, gravity: "center" }])
  .png()
  .toFile("assets/splash-dark.png");
console.log("OK assets/splash-dark.png");
