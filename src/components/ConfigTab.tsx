"use client";

// ============================================================
// Configuración - el Brief (§2) manda las herramientas de prueba
// fuera de la pantalla Ride: pitidos y avisos de voz viven aquí;
// el header del ride queda compacto. La fuente Demo/GPS ya no se
// elige aquí (v1.11.0): la decide la plataforma (web = demo,
// APK = GPS).
// Se agrega la tarjeta "Temas y pantalla ride" (Pro): color de la
// app, estilo y tamaño del velocímetro y altura del minimapa.
// Las opciones Pro muestran una nota y el acceso a Planes; solo
// se aplican con licencia activa.
// ============================================================

import { useState } from "react";
import { Volume2, VolumeX, Mic, MicOff, Info, Mail, Moon, Palette, Lock, Languages, Siren, UserPlus, UserRound, BellRing, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Speedometer } from "@/components/Speedometer";
import { ThemeIconButton } from "@/components/ThemeToggle";
import { APP_VERSION, APP_VERSION_CODE } from "@/lib/appVersion";
import { fallConfigOn, setFallConfigOn } from "@/lib/fallDetect";
import {
  ICE_MAX,
  getIceConfig,
  iceValidationError,
  removeIceContact,
  setIceAuto,
  upsertIceContact,
  type IceConfig,
} from "@/lib/iceContacts";
import { getFcConfig, saveFcConfig, type FcConfig } from "@/lib/zonasFc";
import { t, useLang, setLang, type Lang } from "@/lib/i18n";
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
  soundOn,
  onToggleSound,
  voiceOn,
  onToggleVoice,
  pro,
  onGoPro,
}: {
  soundOn: boolean;
  onToggleSound: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  pro: boolean;
  onGoPro: () => void;
}) {
  const theme = useRideTheme();
  const lang = useLang(); // re-render al cambiar el idioma
  const [proNote, setProNote] = useState<string | null>(null);
  // Detección de caída: persistida en fallDetect (on por defecto).
  const [fallOn, setFallOn] = useState(fallConfigOn());
  const toggleFall = () => {
    const v = !fallOn;
    setFallOn(v);
    setFallConfigOn(v);
  };
  // Contactos ICE (Ola 1): persistidos en iceContacts (auto on por defecto).
  const [ice, setIce] = useState<IceConfig>(() => getIceConfig());
  const [iceName, setIceName] = useState("");
  const [icePhone, setIcePhone] = useState("");
  const [iceErr, setIceErr] = useState<string | null>(null);
  const addIce = () => {
    const err = iceValidationError(iceName, icePhone);
    if (err) {
      setIceErr(err);
      return;
    }
    setIceErr(null);
    setIce(upsertIceContact(iceName, icePhone));
    setIceName("");
    setIcePhone("");
  };
  const toggleIceAuto = () => {
    const v = !ice.auto;
    setIceAuto(v);
    setIce({ ...ice, auto: v });
  };
  // Zonas de esfuerzo (Ola 1): FC máxima y reposo para Karvonen.
  const [fcCfg, setFcCfg] = useState<FcConfig>(() => getFcConfig());
  const [fcMax, setFcMax] = useState(String(fcCfg.maxBpm));
  const [fcReposo, setFcReposo] = useState(String(fcCfg.reposoBpm));
  const [fcErr, setFcErr] = useState<string | null>(null);
  const [fcOk, setFcOk] = useState(false);
  const guardarFc = () => {
    const maxBpm = Number(fcMax);
    const reposoBpm = Number(fcReposo);
    if (!(maxBpm >= 120 && maxBpm <= 230) || !(reposoBpm >= 30 && reposoBpm <= 120) || reposoBpm >= maxBpm - 20) {
      setFcErr(t("cfg.fcErr"));
      return;
    }
    setFcErr(null);
    const saved = saveFcConfig({ maxBpm, reposoBpm });
    setFcCfg(saved);
    setFcMax(String(saved.maxBpm));
    setFcReposo(String(saved.reposoBpm));
    setFcOk(true);
    setTimeout(() => setFcOk(false), 2500);
  };

  const locked = (what: string) => setProNote(t("cfg.proNota", what));
  const pick = <T extends string>(old: T, id: T, fn: (v: T) => void) => {
    if (id !== old) fn(id);
    setProNote(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <Row icon={soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} title={t("cfg.pitidos")} sub={t("cfg.pitidosSub")}>
          <Toggle on={soundOn} onChange={onToggleSound} label={t("cfg.pitidos")} />
        </Row>
        <Row icon={voiceOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} title={t("cfg.avisosVoz")} sub={t("cfg.avisosVozSub")}>
          <Toggle on={voiceOn} onChange={onToggleVoice} label={t("cfg.avisosVoz")} />
        </Row>
        <Row icon={<Siren className="h-5 w-5" />} title={t("cfg.caida")} sub={t("cfg.caidaSub")}>
          <Toggle on={fallOn} onChange={toggleFall} label={t("cfg.caida")} />
        </Row>
      </Card>

      {/* ---- Contactos ICE (Ola 1): aviso a gente de confianza por caída ---- */}
      <Card className="p-0">
        <Row icon={<UserPlus className="h-5 w-5" />} title={t("cfg.ice")} sub={t("cfg.iceSub")}>
          <span />
        </Row>
        <div className="border-b border-border/60 px-4 py-3.5">
          <div className="flex flex-col gap-1.5">
            {ice.contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{c.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{c.phone}</p>
                </div>
                <button
                  onClick={() => setIce(removeIceContact(c.id))}
                  aria-label={`${t("cfg.iceQuitar")} ${c.name}`}
                  className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-red-500"
                >
                  {t("cfg.iceQuitar")}
                </button>
              </div>
            ))}
            {ice.contacts.length === 0 && (
              <p className="text-[11.5px] leading-snug text-muted-foreground">{t("cfg.iceEmpty", ICE_MAX)}</p>
            )}
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5">
            <input
              value={iceName}
              onChange={(e) => setIceName(e.target.value)}
              placeholder={t("cfg.iceNombre")}
              maxLength={40}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500"
            />
            <input
              value={icePhone}
              onChange={(e) => setIcePhone(e.target.value)}
              placeholder={t("cfg.iceTelefono")}
              maxLength={24}
              inputMode="tel"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500"
            />
            <button
              onClick={addIce}
              disabled={!iceName.trim() || !icePhone.trim()}
              className="h-9 rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {t("cfg.iceAgregar")}
            </button>
            {iceErr && (
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">{iceErr}</p>
            )}
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">{t("cfg.iceNota")}</p>
        </div>
        <Row icon={<BellRing className="h-5 w-5" />} title={t("cfg.iceAuto")} sub={t("cfg.iceAutoSub")}>
          <Toggle on={ice.auto} onChange={toggleIceAuto} label={t("cfg.iceAuto")} />
        </Row>
      </Card>

      {/* ---- Zonas de esfuerzo (Ola 1): FC máxima y reposo del sensor BT ---- */}
      <Card className="p-0">
        <Row icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.fc")} sub={t("cfg.fcSub")}>
          <span />
        </Row>
        <div className="px-4 py-3.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">{t("cfg.fcMax")}</span>
              <input
                value={fcMax}
                onChange={(e) => setFcMax(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="190"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">{t("cfg.fcReposo")}</span>
              <input
                value={fcReposo}
                onChange={(e) => setFcReposo(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="60"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          <button
            onClick={guardarFc}
            disabled={fcErr !== null}
            className="mt-2.5 h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {fcOk ? t("cfg.fcOk") : t("cfg.fcGuardar")}
          </button>
          {fcErr && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">{fcErr}</p>
          )}
        </div>
      </Card>

      {/* ---- Selector de idioma (turistas, 2026-11-14): textos y voces ---- */}
      <Card className="p-0">
        <div className="px-4 py-3.5">
          <p className="text-[13.5px] font-semibold text-foreground">{t("cfg.idioma")}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t("cfg.idiomaSub")}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(["es", "en", "pt"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  lang === l
                    ? "border-transparent bg-emerald-600 text-(--c30-on-accent)"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {l === "es" ? t("cfg.esp") : l === "en" ? t("cfg.eng") : t("cfg.port")}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <Row icon={<Moon className="h-5 w-5" />} title={t("cfg.tema")} sub={t("cfg.temaSub")}>
          <ThemeIconButton />
        </Row>
      </Card>

      {/* ---- Temas y pantalla ride (Pro): color, velocímetro, minimapa ---- */}
      <Card className="p-0">
        <Row
          icon={<Palette className="h-5 w-5" />}
          title={t("cfg.temas")}
          sub={t("cfg.temasSub")}
        >
          <span />
        </Row>

        <div className="border-b border-border/60 px-4 py-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.colorApp")}</p>
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
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.velocimetro")}</p>
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
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">{t("cfg.vistaPrevia")}</p>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.minimapa")}</p>
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
              {t("cfg.verPlanes")}
            </button>
          </div>
        )}
        {!pro && !proNote && (
          <p className="mx-4 mb-4 text-[11px] leading-relaxed text-muted-foreground">
            {t("cfg.proFoot")}
          </p>
        )}
      </Card>

      {/* ---- Acerca de: versión y marca (movido desde Perfil) ---- */}
      <Card className="p-0">
        <Row
          icon={<Info className="h-5 w-5" />}
          title="Cumbre30"
          sub={t("cfg.acercaSub", APP_VERSION, APP_VERSION_CODE)}
        >
          <span className="shrink-0 rounded bg-emerald-600/15 px-2 py-1 text-[10px] font-extrabold tracking-widest text-emerald-700 dark:text-emerald-300">
            v{APP_VERSION}
          </span>
        </Row>
        <Row icon={<Mail className="h-5 w-5" />} title={t("cfg.contacto")} sub={t("cfg.contactoSub")}>
          <span />
        </Row>
        <Row
          icon={<span className="text-base font-black tracking-tight text-foreground">CG</span>}
          title={t("cfg.cgeo")}
          sub={t("cfg.cgeoSub")}
        >
          <span />
        </Row>
      </Card>
    </div>
  );
}
