"use client";

// ============================================================
// Modo ahorro de batería (Ola 1).
// ------------------------------------------------------------
// Las salidas de cumbre son las más largas del parque y el GPS a
// 1 Hz con pantalla encendida es el principal consumo. Este módulo
// concentra la decisión de ahorro:
//
//   · GPS: se procesa 1 fix de cada 2 (≈0,5 Hz efectivo). El chip
//     sigue a 1 Hz para no perder precisión, pero el pipeline
//     (cálculo, React, bitácora) corre a la mitad.
//   · Pantalla: NO se solicita wake lock al iniciar el ride (y se
//     libera si el modo se activa en marcha): la guía sigue por
//     voz aunque el teléfono se bloquee.
//   · Auto: con la Battery API (Chrome/WebView Android), activa el
//     modo solo cuando la batería baja de AHORRO_AUTO_PCT y no
//     está cargando. El usuario siempre puede apagarlo.
//
// La config vive en localStorage con una caché de módulo (leer
// localStorage en cada fix GPS a 1 Hz es un costo evitable).
// ============================================================

import { alerts } from "./alertEngine";
import { t } from "./i18n";

const LS_KEY = "cumbre30-bateria-v1";
const AHORRO_AUTO_PCT = 20;

type BateriaConfig = {
  saverOn: boolean; // modo manual/auto actual
  auto: boolean; // activación automática por nivel de batería
};

let cache: BateriaConfig = { saverOn: false, auto: true };
let cacheCargado = false;

function load(): BateriaConfig {
  if (cacheCargado) return cache;
  cacheCargado = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<BateriaConfig>;
      cache = { saverOn: !!d.saverOn, auto: d.auto !== false };
    }
  } catch {
    // sin almacenamiento disponible
  }
  return cache;
}

function save(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // sin almacenamiento disponible
  }
}

/** ¿El pipeline debe saltarse este fix? (1 de cada 2 en ahorro). */
export function saltarFix(fixT: number): boolean {
  if (!load().saverOn) return false;
  const c = cache as BateriaConfig & { ultimoAceptado?: number };
  if (c.ultimoAceptado !== undefined && fixT - c.ultimoAceptado < 2000) return true;
  c.ultimoAceptado = fixT;
  return false;
}

/** ¿Dejar la pantalla apagable en este ride? */
export function wakeLockSuspendido(): boolean {
  return load().saverOn;
}

/** Activa/desactiva el modo y devuelve el estado resultante. */
export function setAhorroBateria(on: boolean): boolean {
  load();
  cache.saverOn = on;
  const c = cache as BateriaConfig & { ultimoAceptado?: number };
  if (!on) delete c.ultimoAceptado; // al apagar, aceptar el próximo fix
  save();
  // Wake lock: liberarlo al activar el ahorro (la pantalla puede dormirse).
  if (on) void alerts.releaseWakeLock();
  return on;
}

export function ahorroAuto(): boolean {
  return load().auto;
}

export function setAhorroAuto(auto: boolean): void {
  load();
  cache.auto = auto;
  save();
}

// ---------- Battery API (opcional, Chrome/WebView) ----------

type BateriaManager = {
  level: number; // 0..1
  charging: boolean;
  addEventListener(type: "levelchange" | "chargingchange", cb: () => void): void;
};
type NavConBateria = Navigator & { getBattery?: () => Promise<BateriaManager> };

let bateriaInit = false;

/** Suscribe el activo automático por nivel bajo. Best-effort: si la
 *  Battery API no existe (Safari/Firefox), simplemente no hace nada. */
export function initAhorroAutomatico(): void {
  if (bateriaInit) return;
  bateriaInit = true;
  const nav = navigator as NavConBateria;
  if (!nav.getBattery) return;
  nav
    .getBattery()
    .then((b) => {
      const evaluar = () => {
        if (!load().auto) return;
        const baja = !b.charging && b.level * 100 <= AHORRO_AUTO_PCT;
        if (baja && !cache.saverOn) {
          setAhorroBateria(true);
          alerts.speak("ahorro-auto", t("voz.ahorroOn"), 8);
        }
      };
      evaluar();
      b.addEventListener("levelchange", evaluar);
      b.addEventListener("chargingchange", evaluar);
    })
    .catch(() => {
      // Battery API no disponible: solo modo manual
    });
}
