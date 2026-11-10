"use client";

// ============================================================
// Configuración - el Brief (§2) manda las herramientas de prueba
// fuera de la pantalla Ride: fuente Demo/GPS, pitidos y avisos de
// voz viven aquí; el header del ride queda compacto.
// ============================================================

import { Volume2, VolumeX, Mic, MicOff, FlaskConical, Info, Mail, Moon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeIconButton } from "@/components/ThemeToggle";
import { APP_VERSION, APP_VERSION_CODE } from "@/lib/appVersion";
import type { Source } from "@/hooks/useRideEngine";

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
        {sub && <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        on ? "border-emerald-500/60 bg-emerald-600/40" : "border-border bg-muted"
      }`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
          on ? "left-6 bg-emerald-500" : "left-1 bg-muted-foreground/70"
        }`}
      />
    </button>
  );
}

export function ConfigTab({
  source,
  onSource,
  soundOn,
  onToggleSound,
  voiceOn,
  onToggleVoice,
}: {
  source: Source;
  onSource: (s: Source) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <Row
          icon={<FlaskConical className="h-5 w-5" />}
          title="Fuente de datos"
          sub="Demo simula la subida Pío Nono → Plaza México. GPS real usa tu ubicación. Herramienta de prueba: ya no compite con el botón Iniciar."
        >
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
            {(["sim", "gps"] as Source[]).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={source === s}
                onClick={() => onSource(s)}
                className={`px-3 py-2 text-[11.5px] font-bold transition-colors ${
                  source === s ? "bg-emerald-600 text-zinc-950" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "sim" ? "Demo" : "GPS real"}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} title="Pitidos de velocidad" sub="Suena al acercarte al límite de 30 km/h">
          <Toggle on={soundOn} onChange={onToggleSound} label="Pitidos de velocidad" />
        </Row>
        <Row icon={voiceOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} title="Avisos de voz" sub="Zonas de riesgo, geocercas y excesos">
          <Toggle on={voiceOn} onChange={onToggleVoice} label="Avisos de voz" />
        </Row>
      </Card>

      <Card className="p-0">
        <Row icon={<Moon className="h-5 w-5" />} title="Tema" sub="Recomendado: oscuro, legible bajo el sol del cerro">
          <ThemeIconButton />
        </Row>
      </Card>

      {/* ---- Acerca de: versión y marca (movido desde Perfil) ---- */}
      <Card className="p-0">
        <Row
          icon={<Info className="h-5 w-5" />}
          title="Cumbre30"
          sub={`Versión ${APP_VERSION} · build ${APP_VERSION_CODE}`}
        >
          <span className="shrink-0 rounded bg-emerald-600/15 px-2 py-1 text-[10px] font-extrabold tracking-widest text-emerald-700 dark:text-emerald-300">
            v{APP_VERSION}
          </span>
        </Row>
        <Row icon={<Mail className="h-5 w-5" />} title="Contacto" sub="contacto.cumbre30@gmail.com · WhatsApp +56 9 4296 1619">
          <span />
        </Row>
        <Row
          icon={<span className="text-base font-black tracking-tight text-foreground">CG</span>}
          title="Cumbre GEO"
          sub="Tecnología para descubrir. App independiente de apoyo al ciclista; no es oficial del Parque Metropolitano de Santiago."
        >
          <span />
        </Row>
      </Card>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
        La fuente Demo existe para probar la app sin salir de casa. Los viajes demo se marcan como simulación en tu
        historial y no emiten constancia PDF.
      </p>
    </div>
  );
}
