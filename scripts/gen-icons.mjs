// Genera los íconos PWA de Cumbre30 con sharp
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("/home/z/my-project/public/icons", { recursive: true });

// Diseño: fondo oscuro redondeado, arco de velocímetro lima y "30"
const svg = (pad = 0) => `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${pad > 0 ? 114 : 96}" fill="#09090b"/>
  <circle cx="256" cy="256" r="${200 - pad}" fill="none" stroke="#27272a" stroke-width="26"/>
  <path d="M ${256 - (200 - pad)} 256 A ${200 - pad} ${200 - pad} 0 0 1 ${256 + (200 - pad) * 0.94} ${256 - (200 - pad) * 0.34}"
        fill="none" stroke="#a3e635" stroke-width="26" stroke-linecap="round"/>
  <text x="256" y="330" font-family="DejaVu Sans, sans-serif" font-size="${200 - pad * 0.6}"
        font-weight="bold" fill="#fafafa" text-anchor="middle">30</text>
  <text x="256" y="${396 - pad * 0.4}" font-family="DejaVu Sans, sans-serif" font-size="44"
        fill="#34d399" text-anchor="middle" letter-spacing="8">KM/H</text>
</svg>`;

await sharp(Buffer.from(svg(0))).resize(512, 512).png().toFile("/home/z/my-project/public/icons/icon-512.png");
await sharp(Buffer.from(svg(0))).resize(192, 192).png().toFile("/home/z/my-project/public/icons/icon-192.png");
await sharp(Buffer.from(svg(64))).resize(512, 512).png().toFile("/home/z/my-project/public/icons/maskable-512.png");
await sharp(Buffer.from(svg(24))).resize(180, 180).png().toFile("/home/z/my-project/public/icons/apple-touch-icon.png");
console.log("íconos generados");
