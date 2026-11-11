"use client";

// ============================================================
// Configuración - el Brief (§2) manda las herramientas de prueba
// fuera de la pantalla Ride: fuente Demo/GPS, pitidos y avisos de
// voz viven aquí; el header del ride queda compacto.
// Se agrega la tarjeta "Temas y pantalla ride" (Pro): color de la
// app, estilo y tamaño del velocímetro y altura del minimapa.
// Las opciones Pro muestran una nota y el acceso a Planes; solo
// se aplican con licencia activa.
// ============================================================

import { useState } from "react";
import { Volume2, VolumeX, Mic, MicOff, FlaskConical, Info, Mail, Moon, Palette, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Speedometer } from "@/components/Speedometer";
import { ThemeIconButton } from "@/components/ThemeToggle";
import { APP_VERSION, APP_VERSION_CODE } from "@/lib/appVersion";
import {
  MINIMAP_SIZES,
  SPEEDO_SIZES,
  SPEEDO_STYLES,
  THEME_COLORS,
  saveRideTheme,
  useRideTheme,
  type MinimapSize,
  type SpeedoSize,
  type SpeedoStyle,
  type ThemeColorId,
} from "@/lib/rideTheme";
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

/** Fila de opciones tipo segmento (con candado en las Pro). */
function Seg<T extends string>({
  options,
  value,
  pro,
  onPick,
  onLocked,
}: {
  options: { id: T; label: string; proOnly: boolean }[];
  value: T;
  pro: boolean;
  onPick: (id: T) => void;
  onLocked: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const locked = o.proOnly && !pro;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => (locked ? onLocked(o.label) : onPick(o.id))}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
              active
                ? "border-transparent bg-emerald-600 text-(--c30-on-accent)"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
            {locked && <Lock className="h-3 w-3 opacity-70" />}
          </button>
        );
      })}
    </div>
  );
}

export function ConfigTab({
  source,
  onSource,
  soundOn,
  onToggleSound,
  voiceOn,
  onToggleVoice,
  pro,
  onGoPro,
}: {
  source: Source;
  onSource: (s: Source) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  pro: boolean;
  onGoPro: () => void;
}) {
  const theme = useRideTheme();
  const [proNote, setProNote] = useState<string | null>(null);

  const locked = (what: string) => setProNote(`${what} es parte de Cumbre30 Pro.`);
  const pick = <T extends string>(old: T, id: T, fn: (v: T) => void) => {
    if (id !== old) fn(id);
    setProNote(null);
  };

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
                  source === s ? "bg-emerald-600 text-(--c30-on-accent)" : "text-muted-foreground hover:text-foreground"
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

      {/* ---- Temas y pantalla ride (Pro): color, velocímetro, minimapa ---- */}
      <Card className="p-0">
        <Row
          icon={<Palette className="h-5 w-5" />}
          title="Temas y pantalla ride"
          sub="Color de la app, velocímetro y minimapa. La personalización es de Cumbre30 Pro."
        >
          <span />
        </Row>

        <div className="border-b border-border/60 px-4 py-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Color de la app</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {THEME_COLORS.map((c) => {
              const isLocked = c.proOnly && !pro;
              const active = theme.color === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => (isLocked ? locked(`El tema ${c.label}`) : pick(theme.color, c.id, (v: ThemeColorId) => saveRideTheme({ color: v })))}
                  aria-pressed={active}
                  aria-label={`Tema ${c.label}${isLocked ? " (Pro)" : ""}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                    active ? "border-emerald-500/70 bg-emerald-600/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: c.swatch }} aria-hidden />
                  {c.label}
                  {isLocked && <Lock className="h-3 w-3 opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-b border-border/60 px-4 py-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Velocímetro</p>
          <div className="mt-2.5 flex flex-col gap-2.5">
            <Seg
              options={SPEEDO_STYLES}
              value={theme.speedoStyle}
              pro={pro}
              onPick={(v: SpeedoStyle) => pick(theme.speedoStyle, v, (x) => saveRideTheme({ speedoStyle: x }))}
              onLocked={(label) => locked(`El velocímetro ${label.toLowerCase()}`)}
            />
            <Seg
              options={SPEEDO_SIZES}
              value={theme.speedoSize}
              pro={pro}
              onPick={(v: SpeedoSize) => pick(theme.speedoSize, v, (x) => saveRideTheme({ speedoSize: x }))}
              onLocked={(label) => locked(`El tamaño ${label.toLowerCase()} del velocímetro`)}
            />
          </div>
          {/* Vista previa con 27 km/h (cerca del límite del parque) */}
          <div className="mt-3 rounded-xl border border-border/70 bg-background/50 px-3 py-3">
            <Speedometer speedKmh={27} idle={false} over={false} caution={true} inPark={true} style={theme.speedoStyle} size={theme.speedoSize} />
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Vista previa · 27 km/h en el parque</p>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Minimapa</p>
          <div className="mt-2.5">
            <Seg
              options={MINIMAP_SIZES}
              value={theme.minimapSize}
              pro={pro}
              onPick={(v: MinimapSize) => pick(theme.minimapSize, v, (x) => saveRideTheme({ minimapSize: x }))}
              onLocked={(label) => locked(`El minimapa ${label.toLowerCase()}`)}
            />
          </div>
        </div>

        {proNote && (
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{proNote}</span>
            <button onClick={onGoPro} className="shrink-0 font-extrabold underline underline-offset-2">
              Ver planes
            </button>
          </div>
        )}
        {!pro && !proNote && (
          <p className="mx-4 mb-4 text-[11px] leading-relaxed text-muted-foreground">
            Con Pro eliges el color de la app, el estilo (arco o dial) y el tamaño del velocímetro, y el minimapa grande.
          </p>
        )}
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
