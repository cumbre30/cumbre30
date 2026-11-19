// ============================================================
// Motor de alertas: beeps WebAudio, voz (TTS es), vibración
// y Wake Lock (pantalla siempre encendida).
// Diseñado para operar sin mirar la pantalla.
// En el APK nativo (Capacitor): TTS del sistema Android,
// VibratorManager nativo y KeepAwake nativo; en el navegador:
// speechSynthesis / navigator.vibrate / Wake Lock API.
//
// Hápticos progresivos (estrategia del documento técnico):
//   25 km/h → pulso corto · 28 km/h → doble pulso ·
//   30 km/h o más → vibración continua hasta reducir.
// ============================================================

import { Capacitor } from "@capacitor/core";
import { LIMIT_KMH } from "./park";
import { ttsLocale } from "./i18n";
import { RideNative, isNativeApp } from "./rideNative";

// Plugins nativos con import dinámico: sus implementaciones web tocan
// window/document en el constructor y romperían el prerender SSR.
type TtsModule = typeof import("@capacitor-community/text-to-speech");
type KeepAwakeModule = typeof import("@capacitor-community/keep-awake");

type VoicePrefs = { enabled: boolean; soundEnabled: boolean; vibrationEnabled: boolean; voiceName: string | null; rate: number };

/** true cuando la app corre dentro del WebView nativo (APK). */
function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

let ttsPromise: Promise<TtsModule | null> | null = null;
function loadTts(): Promise<TtsModule | null> {
  if (!ttsPromise) {
    ttsPromise = isNative()
      ? import("@capacitor-community/text-to-speech").catch(() => null)
      : Promise.resolve(null);
  }
  return ttsPromise;
}

let keepAwakePromise: Promise<KeepAwakeModule | null> | null = null;
function loadKeepAwake(): Promise<KeepAwakeModule | null> {
  if (!keepAwakePromise) {
    keepAwakePromise = isNative()
      ? import("@capacitor-community/keep-awake").catch(() => null)
      : Promise.resolve(null);
  }
  return keepAwakePromise;
}

class AlertEngine {
  private ctx: AudioContext | null = null;
  private alarmOsc: OscillatorNode | null = null;
  private alarmLfo: OscillatorNode | null = null;
  private beepTimer: ReturnType<typeof setInterval> | null = null;
  private hapticTimer: ReturnType<typeof setInterval> | null = null;
  private hapticTier = 0;
  private lastSpeakAt: Record<string, number> = {};
  private wakeLock: WakeLockSentinel | null = null;
  private nativeKeepAwake = false;
  // v1.13.13: voiceName = voz elegida en Personalización (nombre del motor;
  // null = automática por idioma) · rate = velocidad del habla.
  prefs: VoicePrefs = { enabled: true, soundEnabled: true, vibrationEnabled: true, voiceName: null, rate: 1.05 };

  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Desbloquear audio con el primer gesto del usuario. */
  unlock(): void {
    this.ensureCtx();
  }

  private beep(freq: number, durationMs: number, gain = 0.22): void {
    if (!this.prefs.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
    g.gain.setValueAtTime(gain, ctx.currentTime + durationMs / 1000 - 0.02);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  }

  // ---- Estados de alerta de velocidad (audio; la vibración es progresiva) ----

  /** Precaución: pitido intermitente (≥ 27 km/h en el parque). */
  startCaution(): void {
    this.stopCautionOnly();
    if (this.prefs.soundEnabled) {
      this.beep(880, 130);
      this.beepTimer = setInterval(() => this.beep(880, 130), 1300);
    }
  }

  stopCautionOnly(): void {
    if (this.beepTimer) clearInterval(this.beepTimer);
    this.beepTimer = null;
  }

  /** Exceso: alarma continua (> 30 km/h en el parque). */
  startOver(): void {
    this.stopCautionOnly();
    if (this.prefs.soundEnabled) {
      const ctx = this.ensureCtx();
      if (ctx) {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 740;
        lfo.type = "sine";
        lfo.frequency.value = 6; // sirena intermitente
        lfoGain.gain.value = 240;
        lfo.connect(lfoGain).connect(osc.frequency);
        g.gain.value = 0.18;
        osc.connect(g).connect(ctx.destination);
        osc.start();
        lfo.start();
        this.alarmOsc = osc;
        this.alarmLfo = lfo;
      }
    }
  }

  // ---- Hápticos progresivos (25 / 28 / 30 km/h) ----

  private cancelHaptics(): void {
    if (this.hapticTimer) {
      clearInterval(this.hapticTimer);
      this.hapticTimer = null;
    }
    if (isNativeApp()) {
      void RideNative.vibrateCancel().catch(() => { /* sin vibrador */ });
    } else {
      navigator.vibrate?.(0);
    }
  }

  private applyHapticTier(tier: number): void {
    this.cancelHaptics();
    if (tier === 0 || !this.prefs.vibrationEnabled) return;
    if (tier >= 3) {
      // 30 km/h o más: vibración continua en bucle hasta reducir.
      // Nativo: waveform con repeat=0 (loopea en el sistema, sin timers).
      if (isNativeApp()) {
        void RideNative.vibrate({ pattern: [0, 500, 300], repeat: 0 }).catch(() => navigator.vibrate?.([500, 300]));
      } else {
        navigator.vibrate?.([500, 300]);
        this.hapticTimer = setInterval(() => navigator.vibrate?.([500, 300]), 800);
      }
    } else if (tier === 2) {
      // 28 km/h: doble pulso
      if (isNativeApp()) {
        void RideNative.vibrate({ pattern: [0, 80, 110, 80, 600], repeat: 0 }).catch(() => navigator.vibrate?.([80, 110, 80]));
      } else {
        navigator.vibrate?.([80, 110, 80]);
        this.hapticTimer = setInterval(() => navigator.vibrate?.([80, 110, 80]), 1800);
      }
    } else {
      // 25 km/h: pulso corto
      if (isNativeApp()) {
        void RideNative.vibrate({ pattern: [0, 70, 900], repeat: 0 }).catch(() => navigator.vibrate?.(70));
      } else {
        navigator.vibrate?.(70);
        this.hapticTimer = setInterval(() => navigator.vibrate?.(70), 2200);
      }
    }
  }

  /**
   * Actualiza el tier háptico según la velocidad filtrada actual.
   * Llamar en cada fix con la velocidad (o null fuera del parque/parado).
   * Umbrales derivados del límite: LIMIT-5 (25), LIMIT-2 (28), LIMIT (30).
   */
  updateHaptics(kmh: number | null): void {
    const tier =
      kmh == null || !this.prefs.vibrationEnabled
        ? 0
        : kmh >= LIMIT_KMH
          ? 3
          : kmh >= LIMIT_KMH - 2
            ? 2
            : kmh >= LIMIT_KMH - 5
              ? 1
              : 0;
    if (tier === this.hapticTier) return;
    this.hapticTier = tier;
    this.applyHapticTier(tier);
  }

  stopAll(): void {
    this.stopCautionOnly();
    if (this.alarmOsc) {
      try { this.alarmOsc.stop(); this.alarmLfo?.stop(); } catch { /* ya detenido */ }
      this.alarmOsc = null;
      this.alarmLfo = null;
    }
    this.hapticTier = 0;
    this.cancelHaptics();
    navigator.vibrate?.(0);
  }

  /** Triple pitido: aviso de zona de riesgo. */
  beepTriple(): void {
    if (!this.prefs.soundEnabled) return;
    this.beep(660, 110, 0.2);
    setTimeout(() => this.beep(660, 110, 0.2), 160);
    setTimeout(() => this.beep(880, 160, 0.22), 320);
  }

  // ---- Voz ----

  speak(key: string, text: string, minIntervalSec = 8): void {
    if (!this.prefs.enabled || typeof window === "undefined") return;
    const now = Date.now();
    if (now - (this.lastSpeakAt[key] ?? 0) < minIntervalSec * 1000) return;
    this.lastSpeakAt[key] = now;
    // Idioma activo (selector de idioma para turistas): es-CL / en-US / pt-BR.
    const locale = ttsLocale();
    const rate = this.prefs.rate || 1.05;
    // APK nativo: motor TTS de Android (el WebView no implementa speechSynthesis).
    if (isNative()) {
      void loadTts().then(async (tts) => {
        if (!tts) return;
        // v1.13.13: voz elegida por el usuario (Personalización). El plugin
        // nativo pide el ÍNDICE en getSupportedVoices: resolver nombre → índice.
        let voiceIdx: number | undefined;
        let lang = locale;
        if (this.prefs.voiceName) {
          try {
            const { voices } = await tts.TextToSpeech.getSupportedVoices();
            const idx = voices.findIndex((v) => v.name === this.prefs.voiceName);
            if (idx >= 0) {
              voiceIdx = idx;
              lang = voices[idx].lang || locale;
            }
          } catch { /* sin listado: voz automática */ }
        }
        const opts = { text, lang, rate, pitch: 1 as const, volume: 1 as const, ...(voiceIdx !== undefined ? { voice: voiceIdx } : {}) };
        try {
          await tts.TextToSpeech.speak(opts);
        } catch {
          // Fallback por familia de idioma: es-CL→es-ES · en-US→en-GB · pt-BR→pt-PT.
          const alt = locale.startsWith("es") ? "es-ES" : locale.startsWith("en") ? "en-GB" : "pt-PT";
          try { await tts.TextToSpeech.speak({ text, lang: alt, rate, pitch: 1, volume: 1 }); } catch { /* sin TTS */ }
        }
      });
      return;
    }
    if (!("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = locale;
      u.rate = rate;
      u.pitch = 1;
      u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      // v1.13.13: la voz elegida manda; si no existe en este dispositivo,
      // misma preferencia automática por idioma de siempre.
      const pref = (this.prefs.voiceName && voices.find((v) => v.name === this.prefs.voiceName))
        ?? voices.find((v) => v.lang?.toLowerCase().startsWith(locale.slice(0, 2)))
        ?? voices.find((v) => v.lang?.toLowerCase().startsWith("es"));
      if (pref) {
        // Asignación tolerante: si el motor rechaza la voz (dictado raro del
        // motor), habla con el idioma en vez de perder el aviso completo.
        try { u.voice = pref; } catch { /* voz inválida: solo lang */ }
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // TTS no disponible
    }
  }

  // ---- Wake Lock (Always-on) ----

  async requestWakeLock(): Promise<void> {
    // APK nativo: KeepAwake bloquea el apagado de pantalla a nivel de sistema.
    if (isNative()) {
      try {
        const m = await loadKeepAwake();
        if (m) {
          await m.KeepAwake.keepAwake();
          this.nativeKeepAwake = true;
        }
      } catch {
        // KeepAwake no disponible
      }
      return;
    }
    try {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => { this.wakeLock = null; });
      }
    } catch {
      // Wake Lock no disponible
    }
  }

  async reacquireIfVisible(): Promise<void> {
    if (typeof document !== "undefined" && document.visibilityState === "visible" && !this.wakeLock && !this.nativeKeepAwake) {
      await this.requestWakeLock();
    }
  }

  releaseWakeLock(): void {
    if (isNative()) {
      if (this.nativeKeepAwake) {
        void loadKeepAwake().then((m) => m?.KeepAwake.allowSleep()).catch(() => { /* noop */ });
        this.nativeKeepAwake = false;
      }
      return;
    }
    try { this.wakeLock?.release(); } catch { /* noop */ }
    this.wakeLock = null;
  }
}

export const alerts = new AlertEngine();
