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
  PenLine,
  Crown,
  HeartHandshake,
  Mountain,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authAction, googleAuthAction, changeUsername, logout, useMe } from "@/hooks/useMe";
import { isOfflineMode } from "@/lib/offlineAuth";
import { nativeGoogleSignIn, nativeGoogleSignOut } from "@/lib/googleAuth";
import { Capacitor } from "@capacitor/core";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { usernameLocked } from "@/lib/username";
import { PINS, DEFAULT_PIN, type PinId } from "@/lib/pins";
import { APP_VERSION, APP_VERSION_CODE, APK_SIZE_MB } from "@/lib/appVersion";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useProLicense } from "@/lib/proLicense";
import {
  PRO_BENEFITS,
  PRO_PAY_URL,
  PRO_PRICE_LABEL,
  DONATE_OPTIONS,
  CONTACT_WHATSAPP,
  CONTACT_EMAIL,
  openExternal,
} from "@/lib/proConfig";

function StatBox({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/70 px-3 py-2.5">
      <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none tabular-nums">
        {value}
        {unit && <span className="text-[11px] text-muted-foreground font-sans ml-1">{unit}</span>}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/** Logo “G” de Google (4 colores, inline para no depender de lucide). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
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
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendError, setFriendError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Cumbre30 Pro
  const { pro, activate, deactivate } = useProLicense();
  const [showActivate, setShowActivate] = useState(false);
  const [proEmail, setProEmail] = useState("");
  const [proCode, setProCode] = useState("");
  const [proBusy, setProBusy] = useState(false);
  const [proMsg, setProMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Contacto parques (prototipo white-label)
  const [showContact, setShowContact] = useState(false);
  const [cName, setCName] = useState("");
  const [cPark, setCPark] = useState("");
  const [cMail, setCMail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cText, setCText] = useState("");
  const [cMsg, setCMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = await authAction(mode, mode === "register" ? { email, username, password } : { email, password });
    setBusy(false);
    if (err) setError(err);
  };

  const signInGoogle = async () => {
    setBusyGoogle(true);
    setError(null);
    try {
      const acct = await nativeGoogleSignIn();
      const err = await googleAuthAction({ sub: acct.sub, email: acct.email, name: acct.name });
      if (err) setError(err);
    } catch (e) {
      setError((e as Error).message || "No pudimos iniciar sesión con Google.");
    } finally {
      setBusyGoogle(false);
    }
  };

  const addFriend = async () => {
    setFriendError(null);
    if (isOfflineMode()) {
      setFriendError("Los amigos no están disponibles en la app sin servidor.");
      return;
    }
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

  const submitUsername = async () => {
    setUserBusy(true);
    setUserMsg(null);
    const err = await changeUsername(newUsername);
    setUserBusy(false);
    if (err) {
      setUserMsg({ ok: false, text: err });
    } else {
      setUserMsg({ ok: true, text: `¡Listo! Ahora eres @${newUsername.trim().toLowerCase()}.` });
      setNewUsername("");
    }
    setTimeout(() => setUserMsg(null), 8000);
  };

  // ----- Cumbre30 Pro: activación por código (offline) -----
  const activatePro = async () => {
    setProBusy(true);
    setProMsg(null);
    const res = await activate(proEmail, proCode);
    setProBusy(false);
    setProMsg(
      res.ok
        ? { ok: true, text: "¡Cumbre30 Pro activado! Gracias por apoyar el proyecto." }
        : { ok: false, text: res.error ?? "No pudimos validar el código." }
    );
    if (res.ok) {
      setProCode("");
      setShowActivate(false);
    }
    setTimeout(() => setProMsg(null), 9000);
  };

  // ----- Contacto parques: arma el mensaje y lo entrega por WhatsApp/correo -----
  const contactOk = Boolean(cName.trim() && cPark.trim() && /.+@.+\..+/.test(cMail));
  const buildContactMsg = (): string => {
    const lines = [
      "Hola Cumbre30, me interesa un prototipo para otro parque.",
      "",
      `Nombre: ${cName.trim()}`,
      `Parque / institución: ${cPark.trim()}`,
      `Correo: ${cMail.trim()}`,
    ];
    if (cPhone.trim()) lines.push(`Teléfono: ${cPhone.trim()}`);
    if (cText.trim()) lines.push("", `Mensaje: ${cText.trim()}`);
    return lines.join("\n");
  };

  const sendWhatsApp = (): void => {
    if (!CONTACT_WHATSAPP) return;
    void openExternal(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(buildContactMsg())}`);
    setCMsg({ ok: true, text: "Abrimos WhatsApp con el mensaje listo — solo envíalo." });
    setTimeout(() => setCMsg(null), 9000);
  };

  const sendMail = (): void => {
    if (!CONTACT_EMAIL) return;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      "Prototipo Cumbre30 para otro parque",
    )}&body=${encodeURIComponent(buildContactMsg())}`;
    setCMsg({ ok: true, text: "Abrimos tu correo con el mensaje listo — solo envíalo." });
    setTimeout(() => setCMsg(null), 9000);
  };

  const share = useCallback(async () => {
    if (!me) return;
    setShareMsg(null);
    try {
      const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
      const blob = await buildShareImage(me.user.username, pin.emoji, me.stats);
      const file = new File([blob], "cumbre30-resumen.png", { type: "image/png" });
      let native = false;
      try { native = Capacitor.isNativePlatform(); } catch { native = false; }
      const nav2 = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (!native && nav2.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Cumbre30", text: "Mi resumen de pedaleo con Cumbre30 🚴" });
        setShareMsg("¡Compartido! Elige Instagram Stories o Feed en el menú.");
      } else {
        // APK: el WebView no soporta <a download> ni navigator.share →
        // el archivo se entrega por el panel nativo de Android.
        const res = await shareOrDownloadFile({
          blob,
          fileName: "cumbre30-resumen.png",
          title: "Cumbre30",
          text: "Mi resumen de pedaleo con Cumbre30 🚴",
        });
        setShareMsg(
          res === "shared"
            ? "¡Listo! Elige Instagram (Historia o Feed) en el panel de Android."
            : "Imagen descargada. Compártela en Instagram como historia o post."
        );
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
        <Card className="bg-card/80 border-border p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Tu cuenta Cumbre30</p>
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
            className={`flex-1 ${mode === "login" ? "bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold" : "border-border text-muted-foreground"}`}
          >
            <LogIn className="h-4 w-4 mr-2" /> Iniciar sesión
          </Button>
          <Button
            variant={mode === "register" ? "default" : "outline"}
            onClick={() => setMode("register")}
            className={`flex-1 ${mode === "register" ? "bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold" : "border-border text-muted-foreground"}`}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Crear cuenta
          </Button>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-email" className="text-foreground/90">Correo</Label>
            <Input id="pf-email" type="email" className="bg-card border-border" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "register" && (
            <div className="grid gap-1.5">
              <Label htmlFor="pf-user" className="text-foreground/90">Nombre de usuario</Label>
              <Input id="pf-user" className="bg-card border-border" placeholder="ej: ciclista_stgo" value={username} onChange={(e) => setUsername(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">3-20 caracteres: letras, números, punto, guion o guion bajo. Así te verán tus amigos.</p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pf-pass" className="text-foreground/90">Contraseña</Label>
            <Input id="pf-pass" type="password" className="bg-card border-border" placeholder="mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <Button onClick={submit} disabled={busy || !email || !password || (mode === "register" && !username)} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold">
            {busy ? "Conectando…" : mode === "login" ? "Entrar" : "Crear mi cuenta"}
          </Button>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-muted" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">o</span>
            <div className="h-px flex-1 bg-muted" />
          </div>
          <Button
            variant="outline"
            onClick={signInGoogle}
            disabled={busyGoogle}
            className="h-11 border-zinc-600! bg-zinc-100! text-zinc-900! hover:bg-zinc-200! hover:text-zinc-900! font-semibold"
          >
            {busyGoogle ? ("Conectando…") : (<><GoogleIcon /> <span className="ml-2">Continuar con Google</span></>)}
          </Button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            En la app Android puedes entrar con tu cuenta de Google. Si ya tienes una cuenta
            con el mismo correo, se enlaza y conservas tus km, logros y pines.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Con sesión ----------
  if (!me) {
    return <div className="h-24 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">Cargando perfil…</div>;
  }

  const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
  const uLock = usernameLocked(me.user.usernameChangedAt);

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de cuenta */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-2 flex items-center justify-center text-2xl shrink-0" style={{ borderColor: pin.color }}>
            {pin.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-foreground truncate">@{me.user.username}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <AtSign className="h-3 w-3" /> {me.user.email}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void nativeGoogleSignOut();
              void logout();
            }}
            className="border-border text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
          >
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

      {/* Cambiar nombre de usuario (1 vez cada 30 días) */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3 mb-3">
          <PenLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Cambiar nombre de usuario</p>
            <p className="mt-1 leading-relaxed">
              Hoy eres <span className="font-semibold text-foreground">@{me.user.username}</span>. Puedes cambiarlo
              una vez cada 30 días. Tus kilómetros, logros y pines están asociados a tu correo
              ({me.user.email}), así que no pierdes nada al cambiarlo.
            </p>
          </div>
        </div>
        {uLock.locked && uLock.nextAt ? (
          <p className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            Ya cambiaste tu usuario recientemente. Podrás cambiarlo de nuevo el{" "}
            <span className="font-medium text-foreground/90">{uLock.nextAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</span>.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                placeholder={`nuevo nombre (hoy: ${me.user.username})`}
                aria-label="Nuevo nombre de usuario"
                className="bg-card border-border flex-1"
                maxLength={20}
              />
              <Button
                onClick={submitUsername}
                disabled={userBusy || !newUsername.trim() || newUsername.trim() === me.user.username}
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shrink-0"
              >
                {userBusy ? "Cambiando…" : "Cambiar"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              3-20 caracteres: letras, números, punto, guion o guion bajo. Así te verán tus amigos.
            </p>
          </div>
        )}
        {userMsg && (
          <p
            className={`mt-2 text-xs ${userMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
            role="status"
          >
            {userMsg.text}
          </p>
        )}
      </Card>

      {/* Cumbre30 Pro */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">Cumbre30 Pro</p>
              {pro.active && (
                <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  PRO ACTIVO
                </Badge>
              )}
            </div>
            {pro.active ? (
              <>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  Activo con <span className="font-medium text-foreground">{pro.email}</span>. ¡Gracias por apoyar
                  el proyecto! Tienes constancias PDF ilimitadas y export GPX en cada viaje con GPS.
                </p>
                <button
                  onClick={() => {
                    deactivate();
                    setProMsg({ ok: true, text: "Licencia quitada de este teléfono." });
                    setTimeout(() => setProMsg(null), 6000);
                  }}
                  className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
                >
                  Quitar licencia de este teléfono
                </button>
              </>
            ) : (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">Todo lo de siempre, más herramientas de ciclista:</p>
                <ul className="mt-2 space-y-1.5">
                  {PRO_BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Pago único de <span className="font-semibold text-foreground">{PRO_PRICE_LABEL}</span>. Sin suscripciones: se activa con un código que te llega después de pagar.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={!PRO_PAY_URL}
                    onClick={() => void openExternal(PRO_PAY_URL)}
                    className="h-10 flex-1 bg-amber-500 font-bold text-zinc-950 hover:bg-amber-400"
                  >
                    <Crown className="mr-2 h-4 w-4" /> Comprar Pro
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowActivate((v) => !v);
                      if (!proEmail && me) setProEmail(me.user.email);
                    }}
                    className="h-10 border-border text-muted-foreground"
                  >
                    Ya pagué
                  </Button>
                </div>
                {!PRO_PAY_URL && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    El enlace de pago se está configurando. Mientras tanto escríbenos con el formulario de más abajo.
                  </p>
                )}
                {showActivate && (
                  <div className="mt-3 grid gap-2">
                    <Input
                      type="email"
                      placeholder="correo con el que pagaste"
                      aria-label="Correo con el que pagaste"
                      value={proEmail}
                      onChange={(e) => setProEmail(e.target.value)}
                      className="border-border bg-card"
                    />
                    <Input
                      placeholder="código C30P-XXXX-XXXX-XXXX-XXXX"
                      aria-label="Código de licencia"
                      value={proCode}
                      onChange={(e) => setProCode(e.target.value.toUpperCase())}
                      className="border-border bg-card font-mono"
                    />
                    <Button
                      onClick={activatePro}
                      disabled={proBusy || !proEmail || !proCode}
                      className="h-10 bg-emerald-600 font-semibold text-zinc-950 hover:bg-emerald-500"
                    >
                      {proBusy ? "Validando…" : "Activar Pro"}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Se valida sin internet y queda guardado en este teléfono.
                    </p>
                  </div>
                )}
              </>
            )}
            {proMsg && (
              <p
                className={`mt-2 text-xs ${proMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
                role="status"
              >
                {proMsg.text}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Aportes voluntarios (Mercado Pago) */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-pink-600 dark:text-pink-400" />
          <div className="text-sm flex-1">
            <p className="font-medium text-foreground">Apoya el proyecto</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Cumbre30 es gratis, sin publicidad y hecha en Chile. Tu aporte financia los mapas, los avisos
              de voz y las próximas funciones. ¡Cualquier monto ayuda!
            </p>
            <div className="mt-3 flex gap-2">
              {DONATE_OPTIONS.map((o) => (
                <Button
                  key={o.label}
                  variant="outline"
                  disabled={!o.url}
                  onClick={() => void openExternal(o.url)}
                  className="h-10 flex-1 border-border text-foreground"
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {DONATE_OPTIONS.every((o) => !o.url) && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                El link de Mercado Pago se está configurando — estará disponible en breve.
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">Pago seguro vía Mercado Pago.</p>
          </div>
        </div>
      </Card>

      {/* Compartir para Instagram */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3 mb-3">
          <Share2 className="h-5 w-5 text-pink-600 dark:text-pink-400 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Comparte tu ruta en Instagram</p>
            <p className="mt-1 leading-relaxed">
              Genera una imagen resumen con tus estadísticas (formato 4:5 ideal para post o historia) y súbela
              directo a Instagram desde el menú compartir de tu teléfono.
            </p>
          </div>
        </div>
        <Button onClick={share} className="w-full h-11 bg-pink-600 hover:bg-pink-500 text-white font-semibold">
          <Share2 className="h-4 w-4 mr-2" /> Generar y compartir resumen
        </Button>
        {shareMsg && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{shareMsg}</p>}
      </Card>

      {/* Descarga app Android */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3 mb-3">
          <Smartphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">App Android (APK)</p>
            <p className="mt-1 leading-relaxed">
              Lleva Cumbre30 al teléfono con mapas nativos, GPS en segundo plano y avisos de voz
              aunque la pantalla esté apagada. Al instalar, acepta “fuentes desconocidas”.
            </p>
          </div>
        </div>
        <a href="/api/apk" download className="block">
          <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold">
            <Download className="h-4 w-4 mr-2" /> Descargar Cumbre30 v{APP_VERSION} ({APK_SIZE_MB} MB)
          </Button>
        </a>
        <p className="mt-2 text-xs text-muted-foreground">
          Versión instalada en este teléfono: <span className="text-foreground/90 font-medium">v{APP_VERSION}</span> (build {APP_VERSION_CODE}).
          Si descargaste hace rato y algo no coincide, borra el APK viejo y vuelve a descargar.
        </p>
      </Card>

      {/* Bicicleta */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <BikeIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium text-foreground">Mi bicicleta</p>
            {me.user.bikeBrand || me.user.bikeType ? (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                <span className="text-muted-foreground">Marca</span><span className="text-foreground">{me.user.bikeBrand ?? "—"}</span>
                <span className="text-muted-foreground">Tipo</span><span className="text-foreground">{me.user.bikeType ?? "—"}</span>
                <span className="text-muted-foreground">Modelo</span><span className="text-foreground">{me.user.bikeModel ?? "—"}</span>
                <span className="text-muted-foreground">Talla</span><span className="text-foreground">{me.user.bikeSize ?? "—"}</span>
                <span className="text-muted-foreground">Color</span><span className="text-foreground">{me.user.bikeColor ?? "—"}</span>
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">Edita los datos de tu bici en la pestaña QR.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Amigos */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="font-medium text-foreground text-sm">Amigos ({me.friends.length})</p>
        </div>
        <div className="flex gap-2 mb-3">
          <Input
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            placeholder="usuario de tu amigo, ej: pedro_ruta"
            className="bg-card border-border"
            aria-label="Usuario de tu amigo"
          />
          <Button onClick={addFriend} disabled={!friendName.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold shrink-0">
            <UserPlus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        {friendError && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{friendError}</p>}
        {me.friends.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no tienes amigos. Agrega a alguien por su nombre de usuario para ver sus km y logros.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {me.friends.map((f) => {
              const fp = PINS[(f.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
              return (
                <li key={f.username} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{fp.emoji}</span>
                    <span className="font-semibold text-foreground text-sm">@{f.username}</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                      <Award className="h-3.5 w-3.5" /> {f.achievementCount ?? 0}
                    </span>
                    <button onClick={() => removeFriend(f.username)} aria-label={`Eliminar a ${f.username}`} className="text-muted-foreground/80 hover:text-red-600 dark:hover:text-red-400">
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

      {/* Logros y pin activo */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="font-medium text-foreground text-sm">Pin activo en el mapa</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Tu pin <span className="text-foreground">{pin.emoji} {pin.name}</span> es el que ven tus amigos y queda en tus
          reportes. Desbloquea más en la pestaña <span className="text-foreground/90">Desafíos</span>.
        </p>
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <KeyRound className="h-3.5 w-3.5" /> Tus rides del dispositivo se sincronizan automáticamente al tener sesión.
        </p>
      </Card>

      {/* Prototipo para otro parque (contacto) */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3">
          <Mountain className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm flex-1">
            <p className="font-medium text-foreground">¿Gestionas un parque o ciclovía?</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Cumbre30 nació para el Cerro San Cristóbal, pero el motor es reutilizable: geocercas, límite
              de velocidad con avisos, constancias y una app propia para tu parque. Cuéntanos tu caso y
              armamos un prototipo.
            </p>
            {!showContact ? (
              <Button variant="outline" onClick={() => setShowContact(true)} className="mt-3 h-10 border-border text-foreground">
                Me interesa un prototipo
              </Button>
            ) : (
              <div className="mt-3 grid gap-2">
                <Input placeholder="Tu nombre" aria-label="Tu nombre" value={cName} onChange={(e) => setCName(e.target.value)} className="border-border bg-card" />
                <Input placeholder="Parque o institución" aria-label="Parque o institución" value={cPark} onChange={(e) => setCPark(e.target.value)} className="border-border bg-card" />
                <Input type="email" placeholder="Tu correo" aria-label="Tu correo" value={cMail} onChange={(e) => setCMail(e.target.value)} className="border-border bg-card" />
                <Input placeholder="Teléfono (opcional)" aria-label="Teléfono opcional" value={cPhone} onChange={(e) => setCPhone(e.target.value)} className="border-border bg-card" />
                <Textarea
                  placeholder="Cuéntanos del parque: ubicación, límite de velocidad, qué necesitas…"
                  aria-label="Mensaje"
                  value={cText}
                  onChange={(e) => setCText(e.target.value)}
                  className="min-h-20 border-border bg-card"
                />
                <div className="flex gap-2">
                  <Button
                    disabled={!CONTACT_WHATSAPP || !contactOk}
                    onClick={sendWhatsApp}
                    className="h-10 flex-1 bg-emerald-600 font-semibold text-zinc-950 hover:bg-emerald-500"
                  >
                    Enviar por WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!CONTACT_EMAIL || !contactOk}
                    onClick={sendMail}
                    className="h-10 flex-1 border-border text-foreground"
                  >
                    Por correo
                  </Button>
                </div>
                {(!CONTACT_WHATSAPP || !CONTACT_EMAIL) && (
                  <p className="text-[11px] text-muted-foreground">
                    El contacto se está configurando — podrás enviarlo en breve.
                  </p>
                )}
                {cMsg && (
                  <p
                    className={`text-xs ${cMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
                    role="status"
                  >
                    {cMsg.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Descarga directa (fallback sin Web Share) */}
      <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
        <Download className="h-3 w-3" /> Si tu teléfono no muestra el menú compartir, la imagen se descarga y la subes manualmente.
      </p>
    </div>
  );
}
