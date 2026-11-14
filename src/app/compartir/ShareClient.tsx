"use client";

// ============================================================
// Página pública de ride compartido (Ola 3): cumbregeo.cl/compartir?c=CÓDIGO
// Muestra las estadísticas del viaje (sin GPS del trazado: la
// privacidad del ciclista manda). El enlace se crea desde
// Historial → "Link". Español, como el resto del sitio público.
// ============================================================

import { useEffect, useState } from "react";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";

type ShareData = {
  ride: {
    dateISO: string;
    distanceKm: number;
    maxKmh: number;
    maxInParkKmh: number | null;
    avgKmh: number;
    elapsedSec: number;
    gainM: number;
    inParkKm: number | null;
    motorized: boolean;
  };
  user: { username: string; selectedPin: string | null };
};

function fmtFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Santiago",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Emoji del pin de perfil del ciclista (mismo catálogo que la app). */
function emojiPin(pinId: string | null): string {
  const p = PINS[(pinId as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
  return p?.emoji ?? "📍";
}

export default function ShareClient() {
  const [estado, setEstado] = useState<"cargando" | "ok" | "error" | "invalido">("cargando");
  const [data, setData] = useState<ShareData | null>(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c") ?? "";
    if (!/^[A-HJ-NP-Z2-9a-hj-np-z]{8}$/.test(c)) {
      setEstado("invalido");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/rides/share?code=${encodeURIComponent(c.toUpperCase())}`);
        if (r.status === 404) {
          setEstado("error");
          return;
        }
        if (!r.ok) throw new Error();
        setData((await r.json()) as ShareData);
        setEstado("ok");
      } catch {
        setEstado("error");
      }
    })();
  }, []);

  const pin = data ? emojiPin(data.user.selectedPin) : "📍";

  return (
    <main className="mx-auto min-h-screen max-w-md bg-zinc-950 px-4 py-10 text-zinc-100">
      <header className="mb-8 text-center">
        <p className="text-3xl font-black tracking-tight">
          Cumbre<span className="text-emerald-400">30</span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">Pedaleo en el cerro San Cristóbal</p>
      </header>

      {estado === "cargando" && <p className="text-center text-sm text-zinc-400">Cargando…</p>}

      {estado === "invalido" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm font-semibold text-amber-400">Enlace incompleto</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            Este enlace de ride compartido necesita el código de 8 caracteres que viene después de
            <span className="font-mono text-zinc-200"> ?c=</span>.
          </p>
        </div>
      )}

      {estado === "error" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm font-semibold text-red-400">Enlace no disponible</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            No encontramos este ride compartido: el enlace puede estar mal escrito o el ciclista
            borró su cuenta.
          </p>
        </div>
      )}

      {estado === "ok" && data && (
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-center text-lg font-bold">
            {pin} @{data.user.username}
          </p>
          <p className="mt-0.5 text-center text-xs capitalize text-zinc-400">{fmtFecha(data.ride.dateISO)}</p>

          <p className="mt-4 text-center">
            <span className="font-mono text-5xl font-black text-emerald-400">
              {data.ride.distanceKm.toFixed(1)}
            </span>
            <span className="ml-1 text-lg text-zinc-400">km</span>
          </p>
          {data.ride.inParkKm !== null && data.ride.inParkKm > 0 && (
            <p className="mt-1 text-center text-xs text-zinc-400">
              {data.ride.inParkKm.toFixed(1)} km dentro del Parque Metropolitano
            </p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Tiempo</dt>
              <dd className="font-mono text-sm text-zinc-100">{fmtDur(data.ride.elapsedSec)}</dd>
            </div>
            <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Vel. máx</dt>
              <dd className="font-mono text-sm text-zinc-100">{data.ride.maxKmh.toFixed(1)} km/h</dd>
            </div>
            <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Promedio</dt>
              <dd className="font-mono text-sm text-zinc-100">{data.ride.avgKmh.toFixed(1)} km/h</dd>
            </div>
            <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Desnivel</dt>
              <dd className="font-mono text-sm text-zinc-100">+{Math.round(data.ride.gainM)} m</dd>
            </div>
          </dl>

          {data.ride.motorized && (
            <p className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-center text-[11px] font-semibold text-amber-300">
              Registrado en vehículo motorizado: no cuenta para desafíos ni estadísticas.
            </p>
          )}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">
            Registrado con Cumbre30 en el Parque Metropolitano de Santiago. Este enlace solo muestra
            estadísticas: nunca la ubicación del ciclista.
          </p>
        </article>
      )}

      <footer className="mt-8 text-center">
        <a href="/geo" className="text-sm font-bold text-emerald-400 hover:underline">
          Prueba Cumbre30 — Sube tu límite
        </a>
        <p className="mt-2 text-[11px] text-zinc-600">
          ¿Tienes una constancia PDF? Verifícala en{" "}
          <a href="/verificar" className="underline hover:text-zinc-400">
            cumbregeo.cl/verificar
          </a>
        </p>
      </footer>
    </main>
  );
}
