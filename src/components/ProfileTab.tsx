"use client";

// ============================================================
// Pestaña Perfil: sesión (correo + usuario), resumen de cuenta,
// datos de la bici, amigos y compartir resumen para Instagram.
// ============================================================

import { useCallback, useRef, useState } from "react";
import {
  AtSign,
  Bike as BikeIcon,
  Download,
  Share2,
  LogOut,
  LogIn,
  UserPlus,
  Users,
  MapPin,
  Award,
  Trash2,
  KeyRound,
  Smartphone,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authAction, logout, useMe } from "@/hooks/useMe";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";

function StatBox({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2.5">
      <div className="font-mono text-lg font-bold text-emerald-300 leading-none tabular-nums">
        {value}
        {unit && <span className="text-[11px] text-zinc-500 font-sans ml-1">{unit}</span>}
      </div>
      <div className="text-[11px] text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

/** Genera la imagen 1080×1350 (4:5) con el resumen para compartir. */
async function buildShareImage(
  username: string,
  pinEmoji: string,
  stats: { totalKm: number; rideCount: number; maxKmh: number; totalGainM: number }
): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, "#09090b");
  g.addColorStop(0.6, "#052e1b");
  g.addColorStop(1, "#09090b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1350);

  // Perfil decorativo del cerro
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(60, 1050);
  ctx.lineTo(220, 900);
  ctx.lineTo(380, 960);
  ctx.lineTo(540, 760);
  ctx.lineTo(720, 840);
  ctx.lineTo(900, 640);
  ctx.lineTo(1020, 700);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fafafa";
  ctx.font = "bold 110px system-ui, sans-serif";
  ctx.fillText("Cumbre", 60, 190);
  ctx.fillStyle = "#34d399";
  ctx.fillText("30", 60 + ctx.measureText("Cumbre").width + 18, 190);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 40px system-ui, sans-serif";
  ctx.fillText("Ciclocomputador · Cerro San Cristóbal", 60, 260);

  // Pin + usuario
  ctx.fillStyle = "#fafafa";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.fillText(`${pinEmoji} @${username}`, 60, 420);

  const rows: [string, string][] = [
    ["Km recorridos", stats.totalKm.toFixed(1)],
    ["Rides completados", String(stats.rideCount)],
    ["Velocidad máxima", `${stats.maxKmh.toFixed(1)} km/h`],
    ["Desnivel acumulado", `+${Math.round(stats.totalGainM)} m`],
  ];
  let y = 540;
  for (const [label, value] of rows) {
    ctx.fillStyle = "#71717a";
    ctx.font = "500 36px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), 60, y);
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 76px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(value, 1020, y + 14);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, y + 44);
    ctx.lineTo(1020, y + 44);
    ctx.stroke();
    y += 120;
  }

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillText("Respeta el límite: 30 km/h en el parque 🚴", 60, 1220);
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.fillText("¡Súmate y pedalea con Cumbre30!", 60, 1285);

  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png", 0.92)
  );
}

export default function ProfileTab() {
  const { me, ready, refresh } = useMe();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const shareUrl = useRef<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = await authAction(mode, mode === "register" ? { email, username, password } : { email, password });
    setBusy(false);
    if (err) setError(err);
  };

  const addFriend = async () => {
    setFriendError(null);
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

  const share = useCallback(async () => {
    if (!me) return;
    setShareMsg(null);
    try {
      const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
      const blob = await buildShareImage(me.user.username, pin.emoji, me.stats);
      const file = new File([blob], "cumbre30-resumen.png", { type: "image/png" });
      const nav2 = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav2.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Cumbre30", text: "Mi resumen de pedaleo con Cumbre30 🚴" });
        setShareMsg("¡Compartido! Elige Instagram Stories o Feed en el menú.");
      } else {
        if (shareUrl.current) URL.revokeObjectURL(shareUrl.current);
        shareUrl.current = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = shareUrl.current;
        a.download = "cumbre30-resumen.png";
        a.click();
        setShareMsg("Imagen descargada. Compártela en Instagram como historia o post.");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setShareMsg("No pudimos generar la imagen en este dispositivo.");
    }
    setTimeout(() => setShareMsg(null), 8000);
  }, [me]);

  // ---------- Sin sesión: login / registro ----------
  if (ready && !me) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="bg-zinc-900/80 border-zinc-800 p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-emerald-400 mt-0.5" />
            <div className="text-sm text-zinc-400">
              <p className="font-medium text-zinc-200">Tu cuenta Cumbre30</p>
              <p className="mt-1 leading-relaxed">
                Crea tu sesión con correo y nombre de usuario para acumular kilómetros, sumar amigos,
                desbloquear pines y reportar incidencias visibles para todos.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button
            variant={mode === "login" ? "default" : "outline"}
            onClick={() => setMode("login")}
            className={`flex-1 ${mode === "login" ? "bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold" : "border-zinc-800 text-zinc-400"}`}
          >
            <LogIn className="h-4 w-4 mr-2" /> Iniciar sesión
          </Button>
          <Button
            variant={mode === "register" ? "default" : "outline"}
            onClick={() => setMode("register")}
            className={`flex-1 ${mode === "register" ? "bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold" : "border-zinc-800 text-zinc-400"}`}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Crear cuenta
          </Button>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-email" className="text-zinc-300">Correo</Label>
            <Input id="pf-email" type="email" className="bg-zinc-900 border-zinc-800" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "register" && (
            <div className="grid gap-1.5">
              <Label htmlFor="pf-user" className="text-zinc-300">Nombre de usuario</Label>
              <Input id="pf-user" className="bg-zinc-900 border-zinc-800" placeholder="ej: ciclista_stgo" value={username} onChange={(e) => setUsername(e.target.value)} />
              <p className="text-[11px] text-zinc-500">3-20 caracteres: letras, números, punto, guion o guion bajo. Así te verán tus amigos.</p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pf-pass" className="text-zinc-300">Contraseña</Label>
            <Input id="pf-pass" type="password" className="bg-zinc-900 border-zinc-800" placeholder="mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button onClick={submit} disabled={busy || !email || !password || (mode === "register" && !username)} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold">
            {busy ? "Conectando…" : mode === "login" ? "Entrar" : "Crear mi cuenta"}
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Con sesión ----------
  if (!me) {
    return <div className="h-24 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-sm text-zinc-500">Cargando perfil…</div>;
  }

  const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de cuenta */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-2 flex items-center justify-center text-2xl shrink-0" style={{ borderColor: pin.color }}>
            {pin.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-zinc-100 truncate">@{me.user.username}</div>
            <div className="text-xs text-zinc-500 flex items-center gap-1 truncate">
              <AtSign className="h-3 w-3" /> {me.user.email}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void logout()} className="border-zinc-800 text-zinc-400 hover:text-red-400">
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatBox label="Km recorridos" value={me.stats.totalKm.toFixed(1)} unit="km" />
          <StatBox label="Rides" value={me.stats.rideCount} />
          <StatBox label="Velocidad máx." value={me.stats.maxKmh.toFixed(1)} unit="km/h" />
          <StatBox label="Desnivel acum." value={`+${me.stats.totalGainM}`} unit="m" />
        </div>
      </Card>

      {/* Compartir para Instagram */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3 mb-3">
          <Share2 className="h-5 w-5 text-pink-400 mt-0.5" />
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Comparte tu ruta en Instagram</p>
            <p className="mt-1 leading-relaxed">
              Genera una imagen resumen con tus estadísticas (formato 4:5 ideal para post o historia) y súbela
              directo a Instagram desde el menú compartir de tu teléfono.
            </p>
          </div>
        </div>
        <Button onClick={share} className="w-full h-11 bg-pink-600 hover:bg-pink-500 text-white font-semibold">
          <Share2 className="h-4 w-4 mr-2" /> Generar y compartir resumen
        </Button>
        {shareMsg && <p className="mt-2 text-xs text-emerald-300">{shareMsg}</p>}
      </Card>

      {/* Descarga app Android */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3 mb-3">
          <Smartphone className="h-5 w-5 text-emerald-400 mt-0.5" />
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">App Android (APK)</p>
            <p className="mt-1 leading-relaxed">
              Lleva Cumbre30 al teléfono con mapas nativos, GPS en segundo plano y avisos de voz
              aunque la pantalla esté apagada. Al instalar, acepta “fuentes desconocidas”.
            </p>
          </div>
        </div>
        <a href="/api/apk" download className="block">
          <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold">
            <Download className="h-4 w-4 mr-2" /> Descargar Cumbre30 v1.3.1 (55 MB)
          </Button>
        </a>
      </Card>

      {/* Bicicleta */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-start gap-3">
          <BikeIcon className="h-5 w-5 text-emerald-400 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium text-zinc-200">Mi bicicleta</p>
            {me.user.bikeBrand || me.user.bikeType ? (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                <span className="text-zinc-500">Marca</span><span className="text-zinc-200">{me.user.bikeBrand ?? "—"}</span>
                <span className="text-zinc-500">Tipo</span><span className="text-zinc-200">{me.user.bikeType ?? "—"}</span>
                <span className="text-zinc-500">Modelo</span><span className="text-zinc-200">{me.user.bikeModel ?? "—"}</span>
                <span className="text-zinc-500">Talla</span><span className="text-zinc-200">{me.user.bikeSize ?? "—"}</span>
                <span className="text-zinc-500">Color</span><span className="text-zinc-200">{me.user.bikeColor ?? "—"}</span>
              </div>
            ) : (
              <p className="mt-1 text-zinc-500">Edita los datos de tu bici en la pestaña QR (Billetera).</p>
            )}
          </div>
        </div>
      </Card>

      {/* Amigos */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-emerald-400" />
          <p className="font-medium text-zinc-200 text-sm">Amigos ({me.friends.length})</p>
        </div>
        <div className="flex gap-2 mb-3">
          <Input
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="usuario de tu amigo, ej: pedro_ruta"
            className="bg-zinc-900 border-zinc-800"
            aria-label="Usuario de tu amigo"
          />
          <Button onClick={addFriend} disabled={!friendName.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shrink-0">
            <UserPlus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        {friendError && <p className="text-xs text-red-400 mb-2">{friendError}</p>}
        {me.friends.length === 0 ? (
          <p className="text-xs text-zinc-500">Aún no tienes amigos. Agrega a alguien por su nombre de usuario para ver sus km y logros.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {me.friends.map((f) => {
              const fp = PINS[(f.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
              return (
                <li key={f.username} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{fp.emoji}</span>
                    <span className="font-semibold text-zinc-100 text-sm">@{f.username}</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-300">
                      <Award className="h-3.5 w-3.5" /> {f.achievementCount ?? 0}
                    </span>
                    <button onClick={() => removeFriend(f.username)} aria-label={`Eliminar a ${f.username}`} className="text-zinc-600 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                    <span className="font-mono text-emerald-300">{f.totalKm.toFixed(1)} km</span>
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

      {/* Logros y pin activo */}
      <Card className="bg-zinc-900/80 border-zinc-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-emerald-400" />
          <p className="font-medium text-zinc-200 text-sm">Pin activo en el mapa</p>
        </div>
        <p className="text-xs text-zinc-500">
          Tu pin <span className="text-zinc-200">{pin.emoji} {pin.name}</span> es el que ven tus amigos y queda en tus
          reportes. Desbloquea más en la pestaña <span className="text-zinc-300">Desafíos</span>.
        </p>
        <p className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
          <KeyRound className="h-3.5 w-3.5" /> Tus rides del dispositivo se sincronizan automáticamente al tener sesión.
        </p>
      </Card>

      {/* Descarga directa (fallback sin Web Share) */}
      <p className="text-[11px] text-zinc-600 flex items-center gap-1">
        <Download className="h-3 w-3" /> Si tu teléfono no muestra el menú compartir, la imagen se descarga y la subes manualmente.
      </p>
    </div>
  );
}
