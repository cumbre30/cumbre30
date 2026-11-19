"use client";

/**
 * PerfilTab — Perfil Ciclista (fase 1, v1.13.16): 4ª pestaña de la
 * barra inferior. Muestra el arquetipo con su "por qué", el radar de
 * los 5 ejes, las medidas de los últimos 90 días y los rides que
 * alimentan el perfil con su peso por frescura. El botón "Compartir
 * perfil" se trasladó aquí desde Cuenta: genera la tarjeta del perfil
 * (arquetipo + ejes) en vez del resumen de totales.
 *
 * El cálculo vive en el servidor (lib/profileServer): esta pantalla
 * solo consume GET /api/profile. Sin sesión muestra la invitación a
 * Cuenta — el perfil no se inventa datos.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useLang, t } from "@/lib/i18n";
import { useMe } from "@/hooks/useMe";
import { apiUrl } from "@/lib/backend";
import { isOfflineMode } from "@/lib/offlineAuth";
import { serverToken, syncStore } from "@/lib/cloudSync";
import { sharePngBlob, buildShareImage } from "@/lib/shareImage";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";
import type { PerfilSummary } from "@/lib/profileServer";

type Data = {
  perfil: PerfilSummary;
  minRides: number;
  ventanaDias: number;
};

const EMOJI: Record<string, string> = {
  CALIBRATING: "🧭",
  CLIMBER: "⛰️",
  ENDURANCE: "🚴",
  TIME_TRIALIST: "⏱️",
  SPRINTER: "⚡",
  ALL_ROUNDER: "🎯",
  URBAN: "🏙️",
};

const COLOR_EJE: Record<string, string> = {
  climbing: "var(--c30-eje-esc, #10b981)",
  endurance: "var(--c30-eje-end, #38bdf8)",
  speed: "var(--c30-eje-vel, #f59e0b)",
  power: "var(--c30-eje-pot, #a78bfa)",
  consistency: "var(--c30-eje-con, #fb7185)",
};

const NOMBRE_EJE: Record<string, string> = {
  climbing: "pc.eClimbing",
  endurance: "pc.eEndurance",
  speed: "pc.eSpeed",
  power: "pc.ePower",
  consistency: "pc.eConsistency",
};

function fecha(dISO: string): string {
  const d = new Date(dISO);
  return `${d.getDate()} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][d.getMonth()]}`;
}

/** Radar pentagonal de los 5 ejes (SVG, sin dependencias). */
function Radar({ scores }: { scores: PerfilSummary["scores"] }) {
  const claves = ["climbing", "endurance", "speed", "power", "consistency"] as const;
  const vals = claves.map((k) => scores[k] ?? 0);
  const cx = 75;
  const cy = 78;
  const R = 54;
  const N = 5;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i: number, r: number): [number, number] => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const rings = [1, 2, 3, 4]
    .map((k) => {
      const r = (R * k) / 4;
      const p = claves.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");
      return `<polygon points="${p}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
    })
    .join("");
  const spokes = claves
    .map((_, i) => {
      const [x, y] = pt(i, R);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
    })
    .join("");
  const poly = claves.map((_, i) => pt(i, (R * vals[i]) / 100).map((v) => v.toFixed(1)).join(",")).join(" ");
  const dots = claves
    .map((k, i) => {
      const [x, y] = pt(i, (R * vals[i]) / 100);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${COLOR_EJE[k]}"/>`;
    })
    .join("");
  return (
    <svg
      width={150}
      height={150}
      viewBox="0 0 150 150"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `${rings}${spokes}<polygon points="${poly}" fill="rgba(16,185,129,.14)" stroke="var(--c30-eje-esc, #10b981)" stroke-width="1.6"/>${dots}`,
      }}
    />
  );
}

export function PerfilTab({ onGoCuenta }: { onGoCuenta?: () => void }) {
  useLang();
  const { me } = useMe();
  const offline = isOfflineMode();
  const url = apiUrl("/api/profile");
  // APK sin origen de servidor (sin override ni origen horneado): sin perfil.
  const noBackend = url === null;
  // Sesión utilizable: web por cookie (me), APK por token Bearer vigente.
  // (Mismo patrón que AmigosTab: la suscripción a syncStore reacciona al
  // token que llega después de montar, p. ej. tras el login por Google.)
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.getServer);
  const hasSession = offline ? !!serverToken() || sync.phase === "ok" : !!me;
  const [data, setData] = useState<Data | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (url === null || !hasSession) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const tok = offline ? serverToken() : null;
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const r = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) throw new Error();
      setData((await r.json()) as Data);
    } catch {
      setError(t("pc.errCargar"));
    } finally {
      setCargando(false);
    }
  }, [url, hasSession, offline]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const share = useCallback(async () => {
    if (!me || !data) return;
    setShareMsg(null);
    try {
      const p = data.perfil;
      const ejeLabel = (k: string) => t(NOMBRE_EJE[k]);
      const valor = (v: number | null) => (v === null ? "—" : String(Math.round(v)));
      const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
      const blob = await buildShareImage({
        headline: `${EMOJI[p.archetype] ?? ""} ${t(`pc.arch${p.archetype}`)}`,
        sub: `${t("pc.shareSub")} · @${me.user.username}`,
        rows: [
          { label: ejeLabel("climbing"), value: valor(p.scores.climbing) },
          { label: ejeLabel("endurance"), value: valor(p.scores.endurance) },
          { label: ejeLabel("speed"), value: valor(p.scores.speed) },
          { label: ejeLabel("power"), value: valor(p.scores.power) },
          { label: ejeLabel("consistency"), value: valor(p.scores.consistency) },
        ],
        footer: `${pin.emoji} ${t("pc.shareTexto")}`,
      });
      const res = await sharePngBlob(blob, "cumbre30-perfil.png", t("pc.shareTexto"));
      setShareMsg(res === "shared" ? t("his.shareOk") : t("his.shareDescargada"));
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setShareMsg(t("his.errImagen"));
    }
    setTimeout(() => setShareMsg(null), 8000);
  }, [me, data]);

  // ---------- sin sesión utilizable: invitación a Cuenta ----------
  if (!hasSession) {
    return (
      <section aria-label={t("pc.titulo")} className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-foreground">{t("pc.titulo")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("pc.requiereSesion")}</p>
        {onGoCuenta && (
          <Button size="sm" className="mt-4" onClick={onGoCuenta}>
            {t("pc.irCuenta")}
          </Button>
        )}
      </section>
    );
  }

  // ---------- con sesión pero sin servidor de cuenta (APK) ----------
  if (noBackend) {
    return (
      <section aria-label={t("pc.titulo")} className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-foreground">{t("pc.titulo")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("pc.noBackend")}</p>
        {onGoCuenta && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onGoCuenta}>
            {t("pc.irCuenta")}
          </Button>
        )}
      </section>
    );
  }

  // ---------- cargando / error ----------
  if (cargando && !data) {
    return <div className="mt-6 text-center text-sm text-muted-foreground">{t("pg.cargandoCiclista")}</div>;
  }
  if (error && !data) {
    return (
      <div className="mt-6 text-center text-sm text-muted-foreground">
        {error}
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
          {t("cfg.reintentar")}
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const p = data.perfil;
  const emoji = EMOJI[p.archetype] ?? "";
  const axes: Array<["climbing" | "endurance" | "speed" | "power" | "consistency", number | null]> = [
    ["climbing", p.scores.climbing],
    ["endurance", p.scores.endurance],
    ["speed", p.scores.speed],
    ["power", p.scores.power],
    ["consistency", p.scores.consistency],
  ];

  // "Por qué" del arquetipo: eje dominante y su margen sobre el segundo.
  const noNull = axes.filter(([, v]) => v !== null) as Array<[string, number]>;
  noNull.sort((a, b) => b[1] - a[1]);
  const porque =
    noNull.length >= 2 && noNull[0][1] - noNull[1][1] >= 15
      ? t("pc.porque", t(NOMBRE_EJE[noNull[0][0]]), Math.round(noNull[0][1]), Math.round(noNull[0][1] - noNull[1][1]))
      : null;

  const ex = p.extras;
  const kpis: Array<{ ic: string; v: string; u?: string; l: string }> = [
    { ic: "⛰️", v: ex.vamAvg === null ? "—" : String(ex.vamAvg), u: "m/h", l: t("pc.kVam") },
    { ic: "📈", v: ex.mkmAvg === null ? "—" : ex.mkmAvg.toFixed(1), u: "m/km", l: t("pc.kMkm") },
    { ic: "⚡", v: ex.flatAvg === null ? "—" : ex.flatAvg.toFixed(1), u: "km/h", l: t("pc.kFlat") },
    { ic: "💥", v: ex.peak95 === null ? "—" : ex.peak95.toFixed(1), u: "km/h", l: t("pc.kPeak") },
    { ic: "🗓️", v: `${ex.activeWeeks}`, u: `/12`, l: t("pc.kWeeks") },
    { ic: "🛑", v: ex.stopsPerKm === null ? "—" : ex.stopsPerKm.toFixed(1), u: "/km", l: t("pc.kStops") },
  ];

  const progreso = Math.min(100, Math.round((p.validRides / data.minRides) * 100));

  return (
    <div className="flex flex-col gap-3">
      {/* Calibración */}
      <section aria-label={t("pc.calibracion")} className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span>
            {p.calibrating
              ? t("pc.rutasDe", p.validRides, data.minRides)
              : t("pc.calibrado", p.validRides)}
          </span>
          <span className={p.calibrating ? "font-bold text-amber-600 dark:text-amber-400" : "font-bold text-emerald-600 dark:text-emerald-400"}>
            {p.calibrating ? `${progreso}%` : "✓"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent">
          <div
            className={`h-full rounded-full ${p.calibrating ? "bg-gradient-to-r from-amber-500 to-emerald-500" : "bg-emerald-500"}`}
            style={{ width: `${p.calibrating ? progreso : 100}%` }}
          />
        </div>
        {p.calibrating && <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{t("pc.calibrando", data.minRides, data.minRides)}</p>}
      </section>

      {/* Arquetipo */}
      <section aria-label={t("pc.arquetipo")} className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("pc.arquetipo")}</h2>
        <div className="flex items-start gap-3">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-3xl ${
              p.calibrating ? "border-border bg-accent" : "border-emerald-600/40 bg-emerald-600/10"
            }`}
            aria-hidden
          >
            {emoji}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold tracking-tight text-foreground">{t(`pc.arch${p.archetype}`)}</div>
            <span className="mt-1 inline-block rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-300">
              {p.archetype}
            </span>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t(`pc.archDesc${p.archetype}`)}</p>
            {porque && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">{porque}</p>}
          </div>
        </div>
      </section>

      {/* Radar + barras de los 5 ejes */}
      <section aria-label={t("pc.ejes")} className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("pc.ejes")}</h2>
        <div className="flex items-center gap-2">
          <Radar scores={p.scores} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {axes.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[12px]">
                <span className="w-[72px] shrink-0 text-muted-foreground">{t(NOMBRE_EJE[k])}</span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full" style={{ width: `${v ?? 0}%`, background: COLOR_EJE[k] }} />
                </div>
                <span className="w-7 shrink-0 text-right font-bold tabular-nums text-foreground">
                  {v === null ? <span className="text-[9.5px] font-normal text-muted-foreground">{t("pc.sinDatos")}</span> : Math.round(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Medidas físicas */}
      <section aria-label={t("pc.medidas")} className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("pc.medidas")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-lg border border-border bg-accent/40 p-2.5">
              <div className="text-[15px]" aria-hidden>
                {k.ic}
              </div>
              <div className="mt-1 text-[17px] font-bold tabular-nums leading-none tracking-tight text-foreground">
                {k.v}
                {k.v !== "—" && <small className="ml-0.5 text-[10px] font-semibold text-muted-foreground">{k.u}</small>}
              </div>
              <div className="mt-1 text-[9.5px] leading-tight text-muted-foreground">{k.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Rides que alimentan el perfil */}
      <section aria-label={t("pc.feed")} className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("pc.feed")}</h2>
        {p.rides.length === 0 && <p className="py-2 text-[12.5px] text-muted-foreground">{t("pc.sinDatos")}</p>}
        <div>
          {p.rides.map((r, i) => (
            <div key={`${r.dateISO}-${i}`} className={`flex items-center gap-2.5 border-b border-border/60 py-2 text-[12.5px] last:border-none ${r.excl ? "opacity-45" : ""}`}>
              <span className="w-14 shrink-0 text-muted-foreground">{fecha(r.dateISO)}</span>
              <span className="w-16 shrink-0 whitespace-nowrap font-bold tabular-nums text-foreground">{r.distanceKm.toFixed(1)} km</span>
              <span className="tabular-nums text-muted-foreground">+{Math.round(r.gainM)} m</span>
              {r.excl ? (
                <span className="ml-auto shrink-0 rounded-full border border-red-600/40 px-2 py-0.5 text-[10px] text-red-600 dark:text-red-400">
                  {r.excl === "motorizado" ? t("pc.exclMotorizado") : t("pc.exclInvalida")}
                </span>
              ) : (
                <span className="ml-auto shrink-0 tabular-nums text-sky-600 dark:text-sky-400">w = {r.w?.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Compartir (trasladado desde Cuenta) + metodología */}
      <section aria-label={t("pf.compartirPerfil")} className="rounded-xl border border-border bg-card p-4">
        <Button variant="outline" size="sm" className="w-full" onClick={() => void share()} title={t("pf.compartirPerfilTitle")}>
          {t("pf.compartirPerfil")}
        </Button>
        {shareMsg && <p className="mt-2 text-center text-[11.5px] text-emerald-600 dark:text-emerald-400">{shareMsg}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("pc.nota")}</p>
      </section>
    </div>
  );
}
