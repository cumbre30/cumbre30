"use client";

// ============================================================
// Amigos - menú lateral (movido desde Perfil). Listado con km,
// logros y último viaje + botón para agregar por nombre de usuario.
// Requiere servidor de cuenta: en el APK offline se explica.
// ============================================================

import { useState } from "react";
import { Award, LogIn, Trash2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/useMe";
import { isOfflineMode } from "@/lib/offlineAuth";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";

export function AmigosTab({ onGoPerfil }: { onGoPerfil?: () => void }) {
  const { me, ready, refresh } = useMe();
  const [friendName, setFriendName] = useState("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFriend = async () => {
    setFriendError(null);
    if (isOfflineMode()) {
      setFriendError("Los amigos no están disponibles en la app sin servidor.");
      return;
    }
    if (!me) {
      setFriendError("Inicia sesión para agregar amigos.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: friendName }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) {
        setFriendError(d.error ?? "No pudimos agregarlo.");
        return;
      }
      setFriendName("");
      await refresh();
    } catch {
      setFriendError("Sin conexión con el servidor.");
    } finally {
      setBusy(false);
    }
  };

  const removeFriend = async (username: string) => {
    try {
      await fetch(`/api/friends?username=${encodeURIComponent(username)}`, { method: "DELETE" });
      await refresh();
    } catch {
      // sin conexión
    }
  };

  // APK offline: sin servidor no hay amigos
  if (isOfflineMode()) {
    return (
      <Card className="bg-card/80 border-border p-6 text-center">
        <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Amigos</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Los amigos no están disponibles en la app sin servidor. Tus km y logros se guardan igual
          en este teléfono.
        </p>
      </Card>
    );
  }

  if (ready && !me) {
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
            className="mt-4 h-10 bg-emerald-600 font-semibold text-zinc-950 hover:bg-emerald-500"
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
          <p className="text-sm font-medium text-foreground">Tus amigos {me ? `(${me.friends.length})` : ""}</p>
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
            className="shrink-0 bg-emerald-600 font-semibold text-zinc-950 hover:bg-emerald-500"
          >
            <UserPlus className="mr-1 h-4 w-4" /> Agregar
          </Button>
        </div>
        {friendError && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{friendError}</p>}
        {!me ? (
          <p className="text-xs text-muted-foreground">Cargando amigos…</p>
        ) : me.friends.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no tienes amigos. Agrega a alguien por su nombre de usuario para ver sus km y logros.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {me.friends.map((f) => {
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
        Alguien tiene que agregarte también para que se vean mutuamente. El nombre de usuario se
        cambia en Perfil (1 vez cada 30 días).
      </p>
    </div>
  );
}
