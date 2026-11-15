"use client";

// ============================================================
// Rides en la web (Ola 3): cumbregeo.cl/rides — la lista de viajes
// de la cuenta, consultable desde cualquier navegador (cookie de
// sesión web). Solo lectura: el registro vive en la app. Español,
// como el resto del sitio público.
//
// v1.12.5: la página trae su propio acceso — antes mostraba solo el
// mensaje «entra desde la app», un callejón sin salida: en la web no
// había forma de entrar (y menos con Google). Ahora: correo+
// contraseña y botón oficial de Google (GSI), igual que en la app.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { renderBotonGoogle } from "@/lib/googleWeb";

type RideRow = {
  id: string;
  clientId: string | null;
  dateISO: string;
  source: string;
  distanceKm: number;
  maxKmh: number;
  maxInParkKmh: number | null;
  inParkKm: number | null;
  motorized: boolean;
  avgKmh: number;
  elapsedSec: number;
  gainM: number;
};

function fmtFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Santiago",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RidesClient() {
  const [estado, setEstado] = useState<"cargando" | "ok" | "sinSesion" | "error">("cargando");
  const [rides, setRides] = useState<RideRow[]>([]);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/rides");
      if (r.status === 401) {
        setEstado("sinSesion");
        return;
      }
      if (!r.ok) throw new Error();
      const d = (await r.json()) as { rides?: RideRow[] };
      setRides(d.rides ?? []);
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totalKm = rides.reduce((s, r) => s + r.distanceKm, 0);

  return (
    <main className="mx-auto min-h-screen max-w-md bg-zinc-950 px-4 py-10 text-zinc-100">
      <header className="mb-6 text-center">
        <p className="text-3xl font-black tracking-tight">
          Cumbre<span className="text-emerald-400">30</span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">Tus rides desde cualquier navegador</p>
      </header>

      {estado === "cargando" && <p className="text-center text-sm text-zinc-400">Cargando…</p>}

      {estado === "sinSesion" && <AccesoRides alEntrar={() => void cargar()} />}

      {estado === "error" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm font-semibold text-red-400">No pudimos cargar tus rides</p>
          <p className="mt-2 text-[13px] text-zinc-400">Revisa tu conexión y recarga la página.</p>
        </div>
      )}

      {estado === "ok" && (
        <>
          <p className="mb-4 text-center text-sm text-zinc-400">
            {rides.length === 0
              ? "Aún no hay viajes sincronizados: pedalea con la app y espera el sync."
              : `${rides.length} rides · ${totalKm.toFixed(1)} km en total`}
          </p>
          <ul className="flex flex-col gap-2">
            {rides.map((r) => (
              <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-zinc-100">{fmtFecha(r.dateISO)}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
                      {r.source === "sim" ? "demo" : "gps"}
                    </span>
                    {r.motorized && (
                      <span className="rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                        vehículo
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-zinc-400">
                  <span className="font-mono font-bold text-emerald-400">{r.distanceKm.toFixed(1)} km</span>
                  <span>{fmtDur(r.elapsedSec)}</span>
                  <span>máx {r.maxKmh.toFixed(1)}</span>
                  <span>prom {r.avgKmh.toFixed(1)} km/h</span>
                  <span>+{Math.round(r.gainM)} m</span>
                  {r.inParkKm !== null && r.inParkKm > 0 && <span>{r.inParkKm.toFixed(1)} km en parque</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <footer className="mt-8 text-center">
        <a href="/geo" className="text-sm font-bold text-emerald-400 hover:underline">
          Abrir la app
        </a>
        <p className="mt-2 text-[11px] text-zinc-600">
          El registro GPS vive en tu teléfono; esta página solo consulta lo sincronizado con tu cuenta.
        </p>
      </footer>
    </main>
  );
}

/** Acceso desde la propia página (v1.12.5): correo+contraseña o el
 *  botón oficial de Google. Ambos dejan la cookie de sesión y la
 *  lista se recarga sin salir de aquí. Español, sitio público. */
function AccesoRides({ alEntrar }: { alEntrar: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gsiDiv = useRef<HTMLDivElement | null>(null);
  const [gsiOk, setGsiOk] = useState<boolean | null>(null);

  useEffect(() => {
    const el = gsiDiv.current;
    if (!el) return;
    let vivo = true;
    void renderBotonGoogle(el, (idToken) => {
      void (async () => {
        try {
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          if (!vivo) return;
          if (!r.ok) {
            setError("No pudimos iniciar sesión con Google. Intenta de nuevo.");
            return;
          }
          alEntrar();
        } catch {
          if (vivo) setError("No pudimos iniciar sesión con Google. Intenta de nuevo.");
        }
      })();
    }).then((ok) => {
      if (vivo) setGsiOk(ok);
    });
    return () => {
      vivo = false;
    };
  }, [alEntrar]);

  const entrar = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Correo o contraseña incorrectos.");
        return;
      }
      alEntrar();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-center text-sm font-semibold text-amber-400">Inicia sesión para ver tus rides</p>
      <p className="mt-1 text-center text-[13px] leading-relaxed text-zinc-400">
        Con la misma cuenta de la app: correo y contraseña o Google.
      </p>

      <form
        className="mt-4 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void entrar();
        }}
      >
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="tu@correo.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="h-10 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Conectando…" : "Entrar"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-[10px] uppercase tracking-wide text-zinc-600">o</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div ref={gsiDiv} className="flex min-h-11 justify-center" />
      {gsiOk === false && (
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          No pudimos cargar el acceso con Google: usa tu correo y contraseña.
        </p>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500">
        ¿Cuenta nueva? Descarga la app y créala ahí:{" "}
        <a href="/geo" className="underline hover:text-zinc-400">
          cumbregeo.cl/geo
        </a>
      </p>
    </div>
  );
}
