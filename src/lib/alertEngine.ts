// ============================================================
// Motor de alertas: beeps WebAudio, voz (TTS es), vibración
// y Wake Lock (pantalla siempre encendida).
// Diseñado para operar sin mirar la pantalla.
// ============================================================

type VoicePrefs = { enabled: boolean; soundEnabled: boolean; vibrationEnabled: boolean };

class AlertEngine {
  private ctx: AudioContext | null = null;
  private alarmOsc: OscillatorNode | null = null;
  private alarmLfo: OscillatorNode | null = null;
  private beepTimer: ReturnType<typeof setInterval> | null = null;
  private vibrateTimer: ReturnType<typeof setInterval> | null = null;
  private lastSpeakAt: Record<string, number> = {};
  private wakeLock: WakeLockSentinel | null = null;
  prefs: VoicePrefs = { enabled: true, soundEnabled: true, vibrationEnabled: true };

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

  // ---- Estados de alerta de velocidad ----

  /** Precaución: pitido intermitente + vibración corta (≥ 27 km/h en el parque). */
  startCaution(): void {
    this.stopCautionOnly();
    if (this.prefs.soundEnabled) {
      this.beep(880, 130);
      this.beepTimer = setInterval(() => this.beep(880, 130), 1300);
    }
    if (this.prefs.vibrationEnabled) {
      navigator.vibrate?.(90);
      this.vibrateTimer = setInterval(() => navigator.vibrate?.(90), 1300);
    }
  }

  stopCautionOnly(): void {
    if (this.beepTimer) clearInterval(this.beepTimer);
    if (this.vibrateTimer) clearInterval(this.vibrateTimer);
    this.beepTimer = null;
    this.vibrateTimer = null;
  }

  /** Exceso: alarma continua + vibración fuerte (> 30 km/h en el parque). */
  startOver(): void {
    this.stopAll();
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
    if (this.prefs.vibrationEnabled) {
      const pattern = () => navigator.vibrate?.([220, 110, 220, 110, 220]);
      pattern();
      this.vibrateTimer = setInterval(pattern, 1100);
    }
  }

  stopAll(): void {
    this.stopCautionOnly();
    if (this.alarmOsc) {
      try { this.alarmOsc.stop(); this.alarmLfo?.stop(); } catch { /* ya detenido */ }
      this.alarmOsc = null;
      this.alarmLfo = null;
    }
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
    if (!this.prefs.enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const now = Date.now();
    if (now - (this.lastSpeakAt[key] ?? 0) < minIntervalSec * 1000) return;
    this.lastSpeakAt[key] = now;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-CL";
      u.rate = 1.05;
      u.pitch = 1;
      u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const es = voices.find((v) => v.lang?.toLowerCase().startsWith("es"));
      if (es) u.voice = es;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // TTS no disponible
    }
  }

  // ---- Wake Lock (Always-on) ----

  async requestWakeLock(): Promise<void> {
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
    if (typeof document !== "undefined" && document.visibilityState === "visible" && !this.wakeLock) {
      await this.requestWakeLock();
    }
  }

  releaseWakeLock(): void {
    try { this.wakeLock?.release(); } catch { /* noop */ }
    this.wakeLock = null;
  }
}

export const alerts = new AlertEngine();
