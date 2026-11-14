"use client";

// ============================================================
// Amigos - menú lateral. Listado con km, logros y último viaje +
// botón para agregar por nombre de usuario (conexión mutua e
// inmediata). Funciona en la web (cookies de sesión) y en el APK
// (token Bearer del servidor de cuenta vía apiUrl()).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { Award, LogIn, Trash2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/useMe";
import { isOfflineMode } from "@/lib/offlineAuth";
import { apiUrl } from "@/lib/backend";
import { serverToken } from "@/lib/cloudSync";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";

type FriendRow = {
  username: string;
  selectedPin: string | null;
  totalKm: number;
  rideCount: number;
  maxKmh: number;
  achievementCount: number;
  lastRideDate: string | null;
};

export function AmigosTab({ onGoPerfil }: { onGoPerfil?: () => void }) {
  const { me, ready } = useMe();
  const [friends, setFriends] = useState<FriendRow[] | null>(null); // null = cargando
  const [listError, setListError] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const offline = isOfflineMode();
  const url = apiUrl("/api/friends");
  // APK sin origen de servidor (sin override ni origen horneado): sin amigos
  const noBackend = url === null;
  // Sesión utilizable: web por cookie (me), APK por token Bearer vigente
  const hasSession = offline ? !!serverToken() : !!me;
  const canUse = url !== null && hasSession;

  const load = useCallback(async () => {
    if (url === null || !hasSession) return;
    try {
      const headers: Record<string, string> = {};
      const tok = offline ? serverToken() : null;
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        setListError(true);
        setFriends((f) => f ?? []);
        return;
      }
      const d = (await r.json()) as { friends?: FriendRow[] };
      setFriends(d.friends ?? []);
      setListError(false);
    } catch {
      setListError(true);
      setFriends((f) => f ?? []);
    }
  }, [url, hasSession, offline]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFriend = async () => {
    setFriendError(null);
    if (!canUse || url === null) {
      setFriendError("Inicia sesión para agregar amigos.");
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const tok = offline ? serverToken() : null;
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ username: friendName }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setFriendError(d.error ?? "No pudimos agregarlo.");
        return;
      }
      setFriendName("");
      await load();
    } catch {
      setFriendError("Sin conexión con el servidor.");
    } finally {
      setBusy(false);
    }
  };

  const removeFriend = async (username: string) => {
    if (url === null) return;
    try {
      const headers: Record<string, string> = {};
      const tok = offline ? serverToken() : null;
      if (tok) headers.Authorization = `Bearer ${tok}`;
      await fetch(`${url}?username=${encodeURIComponent(username)}`, { method: "DELETE", headers });
      await load();
    } catch {
      // sin conexión: la lista queda como está
    }
  };

  // APK sin servidor de cuenta configurado: no hay a quién conectar
  if (noBackend) {
    return (
      <Card className="bg-card/80 border-border p-6 text-center">
        <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Amigos</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Los amigos necesitan el servidor de cuenta. Configúralo en Perfil → Cuenta →
          Servidor de cuenta y vuelve a esta pantalla.
        </p>
      </Card>
    );
  }

  // Sin sesión utilizable (web sin cookie o APK sin token): invitación a
  // entrar. En la web esperamos a que useMe resuelva (evita destello).
  const showLoginCta = url !== null && !hasSession && (offline || ready);
  if (showLoginCta) {
    return (
      <Card className="bg-card/80 border-border p-6 text-center">
        <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Amigos</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Inicia sesión para agregar amigos por su nombre de usuario y ver sus km y logros.
        </p>
        {onGoPerfil && (
          <Button
            onClick={onGoPerfil}
            className="mt-4 h-10 bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
          >
            <LogIn className="mr-2 h-4 w-4" /> Ir a iniciar sesión
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-card/80 border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-foreground">
            Tus amigos {friends ? `(${friends.length})` : ""}
          </p>
        </div>
        <div className="mb-3 flex gap-2">
          <Input
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="usuario de tu amigo, ej: pedro_ruta"
            className="border-border bg-card"
            aria-label="Usuario de tu amigo"
            onKeyDown={(e) => {
              if (e.key === "Enter" && friendName.trim()) void addFriend();
            }}
          />
          <Button
            onClick={() => void addFriend()}
            disabled={busy || !friendName.trim()}
            className="shrink-0 bg-emerald-600 font-semibold text-(--c30-on-accent) hover:bg-emerald-500"
          >
            <UserPlus className="mr-1 h-4 w-4" /> Agregar
          </Button>
        </div>
        {friendError && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{friendError}</p>}
        {listError && (
          <p className="mb-2 text-xs text-red-600 dark:text-red-400">
            No pudimos cargar la lista. Revisa tu conexión y vuelve a intentar.
          </p>
        )}
        {friends === null ? (
          <p className="text-xs text-muted-foreground">Cargando amigos…</p>
        ) : friends.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no tienes amigos. Agrega a alguien por su nombre de usuario para ver sus km y logros.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {friends.map((f) => {
              const fp = PINS[(f.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
              return (
                <li key={f.username} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{fp.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">@{f.username}</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                      <Award className="h-3.5 w-3.5" /> {f.achievementCount ?? 0}
                    </span>
                    <button
                      onClick={() => void removeFriend(f.username)}
                      aria-label={`Eliminar a ${f.username}`}
                      className="text-muted-foreground/80 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">{f.totalKm.toFixed(1)} km</span>
                    <span>{f.rideCount} rides</span>
                    <span>máx {f.maxKmh.toFixed(1)} km/h</span>
                    {f.lastRideDate && <span>último: {new Date(f.lastRideDate).toLocaleDateString("es-CL")}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Al agregar a alguien la conexión es mutua e inmediata: verás sus km y logros, y aparecerás
        en su lista. El nombre de usuario se cambia en Perfil (1 vez cada 30 días).
      </p>
    </div>
  );
}
