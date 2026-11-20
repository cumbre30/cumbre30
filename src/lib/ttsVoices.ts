// ============================================================
// v1.13.13 - Voces seleccionables del TTS (Personalización).
// Nativo (APK): voces del motor TextToSpeech de Android vía
// @capacitor-community/text-to-speech (el WebView NO implementa
// speechSynthesis). Web (demo/navegador): speechSynthesis del
// navegador - Chrome llena la lista de forma asíncrona, así que
// se reintenta corto si viene vacía.
// La selección y la velocidad se persisten en localStorage y se
// hidratan en alerts.prefs al arrancar (cliente).
// ============================================================

import { Capacitor } from "@capacitor/core";
import { alerts } from "./alertEngine";

export type VozInfo = { name: string; lang: string };

const LS_VOICE = "c30.ttsVoice";
const LS_RATE = "c30.ttsRate";

type TtsModule = typeof import("@capacitor-community/text-to-speech");

let ttsPromise: Promise<TtsModule | null> | null = null;
function loadTts(): Promise<TtsModule | null> {
  if (!ttsPromise) {
    ttsPromise = Capacitor.isNativePlatform()
      ? import("@capacitor-community/text-to-speech").catch(() => null)
      : Promise.resolve(null);
  }
  return ttsPromise;
}

/** Voces del motor nativo Android (APK). */
async function vocesNativas(): Promise<VozInfo[]> {
  const tts = await loadTts();
  if (!tts) return [];
  try {
    const { voices } = await tts.TextToSpeech.getSupportedVoices();
    return voices.map((v) => ({ name: v.name, lang: v.lang }));
  } catch {
    return [];
  }
}

/** Voces del navegador (demo web); Chrome puebla speechSynthesis en caliente. */
async function vocesWeb(): Promise<VozInfo[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const leer = (): VozInfo[] =>
    window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }));
  let out = leer();
  if (out.length === 0) {
    await new Promise<void>((res) => {
      const done = () => { out = leer(); res(); };
      window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
      setTimeout(() => { window.speechSynthesis.removeEventListener("voiceschanged", done); done(); }, 600);
    });
  }
  return out;
}

/** Lista de voces disponibles: nativo en el APK, navegador en la web. */
export async function listVoices(): Promise<VozInfo[]> {
  const voces = Capacitor.isNativePlatform() ? await vocesNativas() : await vocesWeb();
  // Español primero (es-CL si existe), luego en/pt, resto al final.
  const rank = (lang: string) => (lang.toLowerCase().startsWith("es-cl") ? 0 : lang.toLowerCase().startsWith("es") ? 1 : lang.toLowerCase().startsWith("en") ? 2 : lang.toLowerCase().startsWith("pt") ? 3 : 4);
  return [...voces].sort((a, b) => rank(a.lang) - rank(b.lang) || a.name.localeCompare(b.name));
}

/** Voz elegida (nombre estable del motor) o null = automática del idioma. */
export function vozActual(): string | null {
  return alerts.prefs.voiceName ?? null;
}

export function setVoz(name: string | null): void {
  alerts.prefs.voiceName = name;
  if (typeof window !== "undefined") {
    try { name ? localStorage.setItem(LS_VOICE, name) : localStorage.removeItem(LS_VOICE); } catch { /* sin storage */ }
  }
}

/** Velocidad del habla (0.9 lenta · 1.05 normal · 1.2 rápida). */
export function rateActual(): number {
  return alerts.prefs.rate || 1.05;
}

export function setRate(rate: number): void {
  alerts.prefs.rate = rate;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(LS_RATE, String(rate)); } catch { /* sin storage */ }
  }
}

/** Hidratación al arrancar (una vez, cliente). */
let hydrated = false;
export function hydrateTts(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const v = localStorage.getItem(LS_VOICE);
    if (v) alerts.prefs.voiceName = v;
    const r = parseFloat(localStorage.getItem(LS_RATE) ?? "");
    if (Number.isFinite(r) && r > 0) alerts.prefs.rate = r;
  } catch { /* sin storage */ }
}

if (typeof window !== "undefined") hydrateTts();
