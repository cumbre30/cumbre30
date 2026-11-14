"use client";

// ============================================================
// Cliente de /verificar: lee el enlace del QR (#d=...), reconstruye
// el código de integridad en el dispositivo y consulta el registro
// en línea. Idioma según el selector de la app (es/en/pt).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleAlert, Search, ShieldQuestion } from "lucide-react";
import {
  decodeConstancia,
  extraerData,
  queryConstancia,
  type ConstanciaPayload,
  type RegistroRes,
} from "@/lib/constancia";
import { t, useLang } from "@/lib/i18n";

type Estado =
  | { s: "idle" }
  | { s: "checking" }
  | { s: "valida"; p: ConstanciaPayload; code: string; reg: RegistroRes | null }
  | { s: "tampered"; code: string | null }
  | { s: "invalida" };

function fmtFecha(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang === "en" ? "en-GB" : "es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Santiago",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtDur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export default function VerificarClient() {
  const lang = useLang();
  const [raw, setRaw] = useState("");
  const [estado, setEstado] = useState<Estado>({ s: "idle" });

  const verificar = useCallback(async (data: string) => {
    setEstado({ s: "checking" });
    const d = extraerData(data);
    if (!d) {
      setEstado({ s: "invalida" });
      return;
    }
    const res = await decodeConstancia(d);
    if (!res.ok) {
      setEstado(res.reason === "integridad" ? { s: "tampered", code: null } : { s: "invalida" });
      return;
    }
    // Consulta del registro en línea (best-effort: sin conexión queda
    // "sin registro", el documento sigue siendo íntegro).
    const reg = await queryConstancia(res.hash);
    setEstado({ s: "valida", p: res.payload, code: res.code, reg });
  }, []);

  // Leer el enlace del QR al abrir la página (#d=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (h && h.includes("d=")) {
      setRaw(h);
      void verificar(h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void verificar(raw);
  };

  const L = (k: string, ...a: (string | number)[]) => t(k, ...a);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <img
        src="/icons/icon-512.png"
        alt="Logo de Cumbre30"
        width={56}
        height={56}
        className="mb-4 rounded-2xl"
      />
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cumbre30</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{L("ver.titulo")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{L("ver.sub")}</p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
        <label htmlFor="verificar-input" className="text-[13px] font-semibold text-foreground">
          {L("ver.inputLabel")}
        </label>
        <input
          id="verificar-input"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="https://cumbregeo.cl/verificar#d=…"
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[12.5px] text-foreground outline-none focus:border-emerald-500"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={estado.s === "checking" || !raw.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {estado.s === "checking" ? L("ver.checking") : L("ver.verificar")}
        </button>
      </form>

      {/* ---------- resultado ---------- */}
      {estado.s === "valida" && (
        <section className="mt-6 rounded-xl border border-emerald-600/60 bg-emerald-950/30 p-4" aria-live="polite">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{L("ver.valida")}</p>
            {estado.code && (
              <span className="ml-auto rounded-md border border-emerald-700/60 px-2 py-1 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {estado.code}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{L("ver.integridadOk")}</p>
          <div
            className={`mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${
              estado.reg?.registered
                ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "border-amber-600/60 bg-amber-950/30 text-amber-700 dark:text-amber-300"
            }`}
          >
            {estado.reg?.registered ? (
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              {estado.reg?.registered
                ? L(
                    "ver.registradoEl",
                    fmtFecha(estado.reg.createdAt ?? "", lang)
                  )
                : L("ver.onlineNo")}
            </span>
          </div>

          <h2 className="mt-4 text-[13px] font-bold uppercase tracking-widest text-muted-foreground">
            {L("ver.datos")}
          </h2>
          <dl className="mt-2 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card/60 text-[13.5px]">
            <Row k={L("ver.fecha")} v={fmtFecha(estado.p.d, lang)} />
            <Row k={L("ver.distancia")} v={`${estado.p.k.toFixed(2)} km`} />
            <Row k={L("ver.duracion")} v={fmtDur(estado.p.s)} />
            <Row k={L("ver.velMax")} v={`${estado.p.mx.toFixed(1)} km/h`} />
            <Row
              k={L("ver.velMaxParque")}
              v={estado.p.mp !== null && isFinite(estado.p.mp) ? `${estado.p.mp.toFixed(1)} km/h` : "-"}
            />
            <Row
              k={L("ver.sobreLimite")}
              v={estado.p.o > 0 ? fmtDur(estado.p.o) : "0 s"}
            />
            <Row k={L("ver.ciclista")} v={estado.p.u || estado.p.n || "-"} />
            <Row k={L("ver.version")} v={estado.p.v} />
            <Row k={L("ver.registroId")} v={estado.p.id.slice(0, 12)} mono />
          </dl>
        </section>
      )}

      {estado.s === "tampered" && (
        <section className="mt-6 rounded-xl border border-red-700/70 bg-red-950/30 p-4" aria-live="assertive">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-base font-bold text-red-600 dark:text-red-400">{L("ver.tampered")}</p>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{L("ver.tamperedSub")}</p>
        </section>
      )}

      {estado.s === "invalida" && (
        <section className="mt-6 rounded-xl border border-amber-600/70 bg-amber-950/30 p-4" aria-live="assertive">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-base font-bold text-amber-600 dark:text-amber-400">{L("ver.invalida")}</p>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{L("ver.invalidaSub")}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-base font-bold text-foreground">{L("ver.comoFunciona")}</h2>
        <p className="mt-2 text-justify text-[13.5px] leading-relaxed text-muted-foreground">
          {L("ver.explicacion")}
        </p>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        <Link
          href="/geo"
          className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          cumbregeo.cl
        </Link>{" "}
        · contacto.cumbre30@gmail.com · WhatsApp +56 9 4296 1619
      </p>
    </main>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <dt className="w-44 shrink-0 text-muted-foreground">{k}</dt>
      <dd className={`min-w-0 flex-1 font-medium text-foreground ${mono ? "font-mono text-[12.5px]" : ""}`}>{v}</dd>
    </div>
  );
}
