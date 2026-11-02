// ============================================================
// Conversión de clases Tailwind "zinc-*" fijas a tokens semánticos
// (bg-background / bg-card / text-foreground / text-muted-foreground
//  / border-border) para que la app soporte modo oscuro Y claro.
//
// Dark tokens ≈ la paleta zinc actual (paridad visual garantizada:
//  background=0.145≈zinc-950, card=0.205≈zinc-900, border≈zinc-800,
//  muted-foreground=0.708≈zinc-400).
//
// PROTECCIONES (no convertir): elementos con fondo de color fijo y
// texto claro (banners de exceso, chips de límite, overlays), el
// popup siempre-blanco de Leaflet, el botón blanco de Google y el
// hint sobre el overlay blanco del QR.
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/components/Wallet.tsx",
  "src/components/ProfileTab.tsx",
  "src/components/HistoryTab.tsx",
  "src/components/RideView.tsx",
  "src/components/MapView.tsx",
  "src/components/MiniMap.tsx",
  "src/components/ChallengesTab.tsx",
];

const PROTECTED = [
  // Wallet: hint sobre el overlay blanco del QR a pantalla completa
  "text-center text-sm text-zinc-500",
  // ProfileTab: botón blanco de Google (identidad de marca, fijo)
  "border-zinc-600 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900",
  // MapView: popup de Leaflet (siempre blanco, texto gris ok)
  'className="text-zinc-600"',
  // RideView: banner de exceso / precaución / parque (fondo rojo/ámbar/verde fijo)
  "bg-red-950/90 border-red-600 text-red-200 animate-pulse",
  "bg-amber-950/90 border-amber-500 text-amber-200",
  "bg-emerald-950/70 border-emerald-700 text-emerald-200",
  // RideView: chip "LÍMITE 30" y tarjeta de exceso (fondos fijos)
  "border-red-500 bg-red-950 text-red-300",
  "border-emerald-700 bg-emerald-950 text-emerald-300",
  "text-red-300 text-sm font-medium",
  "text-lg font-bold text-red-300 tabular-nums",
];

// Orden fijo; (?<!:) evita reescribir variantes prefijadas (hover:, dark:)
// y las variantes dark: que las propias reglas insertan.
const RULES = [
  // ---- neutros (con opacidad opcional) ----
  [/\bbg-zinc-950\b(\/\d+)?/g, "bg-background$1"],
  [/\bbg-zinc-900\b(\/\d+)?/g, "bg-card$1"],
  [/\bbg-zinc-800\b(\/\d+)?/g, "bg-muted$1"],
  [/\bdivide-zinc-800\b(\/\d+)?/g, "divide-border$1"],
  [/\bborder-zinc-800\b(\/\d+)?/g, "border-border$1"],
  [/\bborder-zinc-700\b(\/\d+)?/g, "border-border$1"],
  [/\bborder-zinc-600\b(\/\d+)?/g, "border-border$1"],
  [/\btext-zinc-100\b/g, "text-foreground"],
  [/\btext-zinc-200\b/g, "text-foreground"],
  [/\btext-zinc-300\b(\/\d+)?/g, "text-foreground/90"],
  [/\btext-zinc-400\b/g, "text-muted-foreground"],
  [/\btext-zinc-500\b(\/\d+)?/g, "text-muted-foreground$1"],
  [/\btext-zinc-600\b(\/\d+)?/g, "text-muted-foreground/80"],
  [/\btext-zinc-50\b/g, "text-foreground"],
  // ---- acentos: legibles sobre blanco en modo claro ----
  [/hover:text-red-400\b/g, "hover:text-red-600 dark:hover:text-red-400"],
  [/(?<!:)text-emerald-400\b(\/\d+)?/g, "text-emerald-600$1 dark:text-emerald-400$1"],
  [/(?<!:)text-emerald-300\b(\/\d+)?/g, "text-emerald-700$1 dark:text-emerald-300$1"],
  [/(?<!:)text-emerald-200\b(\/\d+)?/g, "text-emerald-800$1 dark:text-emerald-200$1"],
  [/(?<!:)text-amber-300\b(\/\d+)?/g, "text-amber-700$1 dark:text-amber-300$1"],
  [/(?<!:)text-amber-200\b(\/\d+)?/g, "text-amber-800$1 dark:text-amber-200$1"],
  [/(?<!:)text-amber-400\b(\/\d+)?/g, "text-amber-600$1 dark:text-amber-400$1"],
  [/(?<!:)text-red-300\b(\/\d+)?/g, "text-red-700$1 dark:text-red-300$1"],
  [/(?<!:)text-red-400\b(\/\d+)?/g, "text-red-600$1 dark:text-red-400$1"],
  [/(?<!:)text-red-500\b(\/\d+)?/g, "text-red-600$1 dark:text-red-500$1"],
  [/(?<!:)text-sky-300\b(\/\d+)?/g, "text-sky-700$1 dark:text-sky-300$1"],
  [/(?<!:)text-sky-400\b(\/\d+)?/g, "text-sky-600$1 dark:text-sky-400$1"],
  [/(?<!:)text-pink-400\b(\/\d+)?/g, "text-pink-600$1 dark:text-pink-400$1"],
];

let total = 0;
for (const f of files) {
  let src = readFileSync(f, "utf8");
  // 1) proteger
  const stash = [];
  for (const p of PROTECTED) {
    while (src.includes(p)) {
      stash.push([`\u0000${stash.length}\u0000`, p]);
      src = src.replace(p, `\u0000${stash.length - 1}\u0000`);
    }
  }
  // 2) convertir
  let count = 0;
  for (const [re, to] of RULES) {
    src = src.replace(re, (m, op) => {
      count++;
      return to.replace(/\$1/g, op ?? "");
    });
  }
  // 3) restaurar
  for (const [mark, p] of stash) src = src.split(mark).join(p);
  writeFileSync(f, src);
  console.log(`${f}: ${count} reemplazos, ${stash.length} protegidos`);
  total += count;
}
console.log(`TOTAL: ${total}`);
