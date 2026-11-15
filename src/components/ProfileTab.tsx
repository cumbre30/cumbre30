"use client";

// ============================================================
// Pestaña Perfil - con subsecciones (solo se ve la activa):
//   · "Mis datos": sesión (correo + usuario), resumen de cuenta,
//     bici, pin y compartir resumen para Instagram. La versión de
//     la app vive en Configuración → Acerca de.
//   · "Pagos y suscripciones": modo Pro (código / Play Billing) -
//     la licencia va atada al correo de la cuenta.
// ============================================================

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AtSign,
  Share2,
  LogOut,
  LogIn,
  UserPlus,
  Users,
  MapPin,
  KeyRound,
  PenLine,
  Trash2,
  CloudUpload,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authAction, deleteAccount, forgotPassword, googleAuthAction, changeUsername, logout, resetPassword, useMe } from "@/hooks/useMe";
import { isOfflineMode } from "@/lib/offlineAuth";
import { manualSync, syncStore } from "@/lib/cloudSync";
import { CONTACT_WHATSAPP } from "@/lib/proConfig";
import { nativeGoogleSignIn, nativeGoogleSignOut } from "@/lib/googleAuth";
import { renderBotonGoogle } from "@/lib/googleWeb";
import { Capacitor } from "@capacitor/core";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { usernameLocked } from "@/lib/username";
import { PINS, DEFAULT_PIN, RIDER_LEVELS, riderLevelForKm, type PinId } from "@/lib/pins";
import { buildShareImage, sharePngBlob } from "@/lib/shareImage";
import { PagosTab } from "@/components/PagosTab";
import { SubTabs, type SubTabDef } from "@/components/SubTabs";

/** Subsecciones de Perfil: se muestran al entrar y solo se ve la activa.
 *  "Pagos y suscripciones" aparece solo con sesión: la licencia Pro va
 *  atada al correo de la cuenta. */
type SubKey = "datos" | "pagos";
const PROFILE_SUBS: SubTabDef[] = [
  { key: "datos", label: "Mis datos" },
  { key: "pagos", label: "Pagos y suscripciones" },
];

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

export default function ProfileTab() {
  const { me, ready } = useMe();
  const offline = isOfflineMode();
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.getServer);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delStage, setDelStage] = useState<"idle" | "confirm" | "busy">("idle");

  // --- Olvidé mi contraseña ---
  // Server: paso 1 pide el código (lo entrega soporte por WhatsApp tras
  // verificar identidad), paso 2 cambia la contraseña con el código.
  // APK: se usa el código de recuperación local (XXXX-XXXX).
  const [authView, setAuthView] = useState<"form" | "forgot">("form");
  const [fStep, setFStep] = useState<1 | 2 | 3>(1); // 3 = listo
  const [fEmail, setFEmail] = useState("");
  const [fCode, setFCode] = useState("");
  const [fPass, setFPass] = useState("");
  const [fBusy, setFBusy] = useState(false);
  const [fMsg, setFMsg] = useState<string | null>(null);
  const [fErr, setFErr] = useState<string | null>(null);

  // Subsección activa de Perfil (se mantiene al iniciar sesión).
  // Sin sesión "pagos" no existe: cae a "datos".
  const [sub, setSub] = useState<SubKey>("datos");
  const activeSub: SubKey = sub === "pagos" && !me ? "datos" : sub;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = await authAction(mode, mode === "register" ? { email, username, password } : { email, password });
    setBusy(false);
    if (err) setError(err);
  };

  // Paso 1: pedir el código (server). En offline no hay solicitud remota.
  const requestReset = async () => {
    setFBusy(true);
    setFErr(null);
    setFMsg(null);
    const err = await forgotPassword(fEmail);
    setFBusy(false);
    if (err) {
      setFErr(err);
      return;
    }
    setFStep(2);
    setFMsg(offline ? null : "Solicitud registrada. Escríbenos por WhatsApp para recibir el código.");
  };

  // Paso 2: cambiar la contraseña con el código (server o código de recuperación).
  const confirmReset = async () => {
    setFBusy(true);
    setFErr(null);
    setFMsg(null);
    const err = await resetPassword({ email: fEmail, code: fCode, newPassword: fPass });
    setFBusy(false);
    if (err) {
      setFErr(err);
      return;
    }
    setFStep(3);
    setFMsg(null);
  };

  const backToForm = (login = true) => {
    setAuthView("form");
    setFStep(1);
    setFCode("");
    setFPass("");
    setFMsg(null);
    setFErr(null);
    if (login) {
      setMode("login");
      if (fEmail) setEmail(fEmail);
      setPassword("");
      setError(null);
    }
  };

  const signInGoogle = async () => {
    setBusyGoogle(true);
    setError(null);
    try {
      const acct = await nativeGoogleSignIn();
      // idToken incluido: offlineGoogleSignIn lo canjea por un token de
      // sesión del servidor (linkGoogle). Sin él, amigos/rides/compartir
      // en el APK nunca sabían de la cuenta Google (bug hasta v1.12.5).
      const err = await googleAuthAction({ sub: acct.sub, email: acct.email, name: acct.name, idToken: acct.idToken });
      if (err) setError(err);
    } catch (e) {
      setError((e as Error).message || "No pudimos iniciar sesión con Google.");
    } finally {
      setBusyGoogle(false);
    }
  };

  // Google en la web (GSI oficial, v1.12.5): el botón renderizado por
  // Google abre el selector de cuentas del navegador; el idToken va a
  // /api/auth/google, que valida y deja la sesión en cookie — igual
  // que el login por contraseña. Antes la web solo aceptaba cuenta
  // Cumbre30 y el botón Google daba error fuera del APK. El APK
  // mantiene su flujo nativo (botón propio de abajo).
  const gsiDiv = useRef<HTMLDivElement | null>(null);
  const [gsiWebOk, setGsiWebOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (offline) return; // APK: flujo nativo
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
          window.location.reload(); // cookie de sesión lista: la web recarga con la sesión
        } catch {
          if (vivo) setError("No pudimos iniciar sesión con Google. Intenta de nuevo.");
        }
      })();
    }).then((ok) => {
      if (vivo) setGsiWebOk(ok);
    });
    return () => {
      vivo = false;
    };
  }, [offline, mode]);

  const share = useCallback(async () => {
    if (!me) return;
    setShareMsg(null);
    try {
      const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
      const blob = await buildShareImage({
        headline: `${pin.emoji} @${me.user.username}`,
        sub: "Mi resumen de pedaleo",
        rows: [
          { label: "Km recorridos", value: me.stats.totalKm.toFixed(1) },
          { label: "Rides completados", value: String(me.stats.rideCount) },
          { label: "Velocidad máxima", value: `${me.stats.maxKmh.toFixed(1)} km/h` },
          { label: "Desnivel acumulado", value: `+${Math.round(me.stats.totalGainM)} m` },
        ],
      });
      const res = await sharePngBlob(blob, "cumbre30-resumen.png", "Mi resumen de pedaleo con Cumbre30 🚴");
      setShareMsg(
        res === "shared"
          ? "¡Listo! Elige Instagram (Historia o Feed) en el panel."
          : "Imagen descargada. Compártela en Instagram como historia o post."
      );
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setShareMsg("No pudimos generar la imagen en este dispositivo.");
    }
    setTimeout(() => setShareMsg(null), 8000);
  }, [me]);

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

  // ---------- Sin sesión: login en "Mis datos" ----------
  if (ready && !me) {
    return (
      <div className="flex flex-col gap-4">
        {activeSub === "datos" && (
        <>
        <Card className="bg-card/80 border-border p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Tu cuenta Cumbre30</p>
              <p className="mt-1 leading-relaxed">
                Crea tu sesión con correo y nombre de usuario para acumular kilómetros,
                desbloquear pines y reportar incidencias visibles para todos.
              </p>
            </div>
          </div>
        </Card>

        {authView === "forgot" ? (
          /* --- Olvidé mi contraseña: código por soporte (server) o
                código de recuperación (APK) --- */
          <Card className="bg-card/80 border-border p-4 grid gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium text-foreground">Restablecer contraseña</p>
            </div>

            {fStep === 3 ? (
              <>
                <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
                  ¡Listo! Tu contraseña se actualizó. Ingresa con la nueva.
                </p>
                <Button onClick={() => backToForm(true)} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
                  Iniciar sesión
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {offline
                    ? "Tu cuenta vive en este dispositivo: ingresa el código de recuperación que te mostramos en Perfil → Mis datos (con la sesión iniciada)."
                    : "Te entregaremos un código de 6 dígitos por WhatsApp o correo tras verificar tu identidad. El código vence en 30 minutos."}
                </p>

                <div className="grid gap-1.5">
                  <Label htmlFor="pf-f-email" className="text-foreground/90">Correo de tu cuenta</Label>
                  <Input
                    id="pf-f-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoComplete="email"
                    className="bg-card border-border"
                    placeholder="tu@correo.cl"
                    value={fEmail}
                    onChange={(e) => setFEmail(e.target.value)}
                    disabled={fStep === 2}
                  />
                </div>

                {fStep === 2 && fMsg && (
                  <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/20 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                    <p>{fMsg}</p>
                    <Button asChild variant="outline" className="mt-2 h-9 w-full border-emerald-600/50 text-emerald-700 hover:bg-emerald-950/40 dark:text-emerald-300">
                      <a
                        href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Hola Cumbre30, olvidé mi contraseña. Mi correo es ${fEmail}. ¿Me envían el código de restablecimiento?`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Escribir por WhatsApp
                      </a>
                    </Button>
                  </div>
                )}

                {(offline || fStep === 2) && (
                  <>
                    {offline && (
                      <div className="grid gap-1.5">
                        <Label htmlFor="pf-f-code" className="text-foreground/90">Código de recuperación</Label>
                        <Input
                          id="pf-f-code"
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={9}
                          className="bg-card border-border font-mono tracking-widest uppercase"
                          placeholder="XXXX-XXXX"
                          value={fCode}
                          onChange={(e) => setFCode(e.target.value.toUpperCase())}
                        />
                      </div>
                    )}
                    {!offline && (
                      <div className="grid gap-1.5">
                        <Label htmlFor="pf-f-code" className="text-foreground/90">Código de 6 dígitos</Label>
                        <Input
                          id="pf-f-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          className="bg-card border-border font-mono tracking-[0.3em]"
                          placeholder="······"
                          value={fCode}
                          onChange={(e) => setFCode(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                    )}
                    <div className="grid gap-1.5">
                      <Label htmlFor="pf-f-pass" className="text-foreground/90">Nueva contraseña</Label>
                      <Input
                        id="pf-f-pass"
                        type="password"
                        autoComplete="new-password"
                        className="bg-card border-border"
                        placeholder="mínimo 6 caracteres"
                        value={fPass}
                        onChange={(e) => setFPass(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {fErr && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{fErr}</p>}

                <Button
                  onClick={() => void (offline || fStep === 2 ? confirmReset() : requestReset())}
                  disabled={fBusy || !fEmail || (offline || fStep === 2 ? !fCode || fPass.length < 6 : false)}
                  className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold"
                >
                  {fBusy ? "Conectando…" : offline || fStep === 2 ? "Restablecer contraseña" : "Solicitar código"}
                </Button>
                <button
                  type="button"
                  onClick={() => backToForm(true)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Volver a iniciar sesión
                </button>
              </>
            )}
          </Card>
        ) : (
        <>
        <div className="flex gap-2">
          <Button
            variant={mode === "login" ? "default" : "outline"}
            onClick={() => setMode("login")}
            className={`flex-1 ${mode === "login" ? "bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold" : "border-border text-muted-foreground"}`}
          >
            <LogIn className="h-4 w-4 mr-2" /> Iniciar sesión
          </Button>
          <Button
            variant={mode === "register" ? "default" : "outline"}
            onClick={() => setMode("register")}
            className={`flex-1 ${mode === "register" ? "bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold" : "border-border text-muted-foreground"}`}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Crear cuenta
          </Button>
        </div>

        {/* form: permite enviar con Enter desde cualquier campo */}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="pf-email" className="text-foreground/90">Correo</Label>
            <Input id="pf-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" className="bg-card border-border" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "register" && (
            <div className="grid gap-1.5">
              <Label htmlFor="pf-user" className="text-foreground/90">Nombre de usuario</Label>
              <Input id="pf-user" name="username" autoCapitalize="none" autoComplete="username" spellCheck={false} className="bg-card border-border" placeholder="ej: ciclista_stgo" value={username} onChange={(e) => setUsername(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">3-20 caracteres: letras, números, punto, guion o guion bajo. Así te verán tus amigos.</p>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pf-pass" className="text-foreground/90">Contraseña</Label>
            <Input id="pf-pass" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} className="bg-card border-border" placeholder="mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || !email || !password || (mode === "register" && !username)} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
            {busy ? "Conectando…" : mode === "login" ? "Entrar" : "Crear mi cuenta"}
          </Button>
          {mode === "login" && (
            <button
              type="button"
              onClick={() => setAuthView("forgot")}
              className="justify-self-center text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {mode === "login" && offline && (
            <p className="text-[11px] leading-snug text-muted-foreground text-center">
              ¿Creaste tu cuenta en la web (cumbregeo.cl)? Entra con el mismo correo y contraseña: la cuenta se copia a este teléfono con tus logros y tu perfil.
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-muted" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">o</span>
            <div className="h-px flex-1 bg-muted" />
          </div>
          {offline ? (
            <Button
              type="button"
              variant="outline"
              onClick={signInGoogle}
              disabled={busyGoogle}
              className="h-11 border-zinc-600! bg-zinc-100! text-zinc-900! hover:bg-zinc-200! hover:text-zinc-900! font-semibold"
            >
              {busyGoogle ? ("Conectando…") : (<><GoogleIcon /> <span className="ml-2">Continuar con Google</span></>)}
            </Button>
          ) : (
            /* Web: botón oficial de Google (GSI). El div lo llena el
               efecto de arriba; si Google no carga queda vacío y el
               texto de abajo lo explica. */
            <div ref={gsiDiv} className="flex min-h-11 justify-center" />
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
            {offline
              ? "En la app Android puedes entrar con tu cuenta de Google. Si ya tienes una cuenta con el mismo correo, se enlaza y conservas tus km, logros y pines."
              : gsiWebOk === false
                ? "No pudimos cargar el acceso con Google (¿extensión o red lo bloquea?). Entra con tu correo y contraseña."
                : "Entra con Google o con tu cuenta Cumbre30. Si ya tienes una cuenta con el mismo correo, se enlaza y conservas tus km, logros y pines."}
          </p>
        </form>
        </>
        )}
        </>
        )}
      </div>
    );
  }

  // ---------- Con sesión ----------
  if (!me) {
    return <div className="h-24 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">Cargando perfil…</div>;
  }

  const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
  const uLock = usernameLocked(me.user.usernameChangedAt);
  // Nivel del ciclista (compartido con Desafíos): km GPS de la cuenta.
  const lvl = riderLevelForKm(me.stats.totalKm);

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel="Subsecciones de Perfil"
        value={activeSub}
        onChange={(k) => setSub(k as SubKey)}
        tabs={PROFILE_SUBS}
      />

      {sub === "datos" && (
      <>
      {/* Cabecera de cuenta */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full border-2 flex items-center justify-center text-2xl shrink-0" style={{ borderColor: pin.color }}>
            {pin.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-foreground truncate">@{me.user.username}</div>
            <div className="mt-0.5">
              <span
                className="inline-flex items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-950/30 px-2 py-0.5 text-[10.5px] font-bold leading-4 text-emerald-700 dark:text-emerald-300"
                title={`Nivel ${lvl.index + 1} de ${RIDER_LEVELS.length} · ${me.stats.totalKm.toFixed(1)} km acumulados`}
              >
                <span aria-hidden>{lvl.level.emoji}</span> {lvl.level.name}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1 truncate">
              <AtSign className="h-3 w-3" /> {me.user.email}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void share()}
              title="Genera una imagen con tu resumen para compartir en Instagram"
              className="h-8 border-border px-2.5 text-[11px] text-muted-foreground hover:border-pink-600/50 hover:text-pink-600 dark:hover:text-pink-400"
            >
              <Share2 className="mr-1 h-3.5 w-3.5" /> Compartir perfil
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void nativeGoogleSignOut();
                void logout();
              }}
              className="h-8 border-border px-2.5 text-[11px] text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="mr-1 h-3.5 w-3.5" /> Salir
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatBox label="Km recorridos" value={me.stats.totalKm.toFixed(1)} unit="km" />
          <StatBox label="Rides" value={me.stats.rideCount} />
          <StatBox label="Velocidad máx." value={me.stats.maxKmh.toFixed(1)} unit="km/h" />
          <StatBox label="Desnivel acum." value={`+${me.stats.totalGainM}`} unit="m" />
        </div>
      </Card>
      {offline && me.user.recoveryCode && (
        /* Solo APK: el código permite restablecer la contraseña de la
           cuenta local sin perder km, logros ni pines. */
        <Card className="bg-card/60 border-border p-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">Código de recuperación</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Guárdalo en un lugar seguro: con él puedes restablecer tu contraseña sin perder tus km y logros.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-widest text-foreground">{me.user.recoveryCode}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={() => {
                  void navigator.clipboard?.writeText(me.user.recoveryCode ?? "").then(
                    () => setShareMsg("Código copiado al portapapeles."),
                    () => undefined
                  );
                  setTimeout(() => setShareMsg(null), 8000);
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </Card>
      )}
      {offline && (
        /* Progreso enlazado a la cuenta (APK): outbox en IndexedDB +
           token de sesión. Estado visible y sync manual a demanda. */
        <Card className="bg-card/60 border-border p-3">
          <div className="flex items-center gap-3">
            {sync.phase === "syncing" ? (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />
            ) : sync.phase === "unlinked" || sync.phase === "offline" ? (
              <CloudOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <CloudUpload className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">Sincronización con la nube</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {sync.phase === "syncing"
                  ? "Subiendo tu progreso…"
                  : sync.phase === "ok"
                    ? `Tu progreso queda guardado en tu cuenta${sync.email ? ` (${sync.email})` : ""}.`
                    : sync.phase === "offline"
                      ? `Sin conexión ahora: ${sync.pending} elemento(s) esperando para subirse.`
                      : sync.phase === "unlinked"
                        ? "No pudimos vincular tu cuenta: la contraseña del teléfono es distinta a la de la web, o el servidor no responde."
                        : sync.phase === "error"
                          ? "Algo falló al sincronizar. Lo reintentamos solo al volver la conexión."
                          : "Entra a tu cuenta para guardar tu progreso en la nube."}
                {sync.phase === "ok" && sync.lastSyncAt
                  ? ` Última sync ${new Date(sync.lastSyncAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}.`
                  : ""}
              </p>
            </div>
            {sync.phase !== "syncing" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground"
                onClick={() => void manualSync()}
              >
                Sincronizar
              </Button>
            )}
          </div>
        </Card>
      )}
      {shareMsg && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
          {shareMsg}
        </p>
      )}

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
                className="bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold shrink-0"
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

      {/* Zona de cuenta - baja definitiva (Google Play exige eliminación in-app) */}
      <Card className="border-red-900/40 bg-red-950/10 p-4">
        <div className="flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="font-medium text-foreground">Eliminar cuenta</p>
            {delStage === "idle" ? (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  Borra definitivamente tu cuenta: correo, usuario, kilómetros, logros, pines y todo tu historial de
                  viajes. Si este era el único usuario del teléfono, también se elimina tu licencia Pro local. La
                  acción es irreversible.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDelStage("confirm")}
                  className="mt-3 h-8 border-red-900/50 px-3 text-[12px] text-red-600 hover:border-red-600 hover:text-red-500 dark:text-red-400"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar mi cuenta
                </Button>
              </>
            ) : delStage === "confirm" ? (
              <>
                <p className="mt-1 leading-relaxed text-foreground/90">
                  ¿Seguro? Esta acción <span className="font-semibold">no se puede deshacer</span> y perderás todo lo
                  asociado a <span className="font-semibold">{me.user.email}</span>.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDelStage("idle")}
                    className="h-8 border-border px-3 text-[12px] text-muted-foreground"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDelStage("busy");
                      void deleteAccount().finally(() => setDelStage("idle"));
                    }}
                    className="h-8 bg-red-600 px-3 text-[12px] font-semibold text-white hover:bg-red-500"
                  >
                    Eliminar definitivamente
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-red-600 dark:text-red-400">Eliminando tu cuenta…</p>
            )}
          </div>
        </div>
      </Card>
      </>
      )}

      {sub === "pagos" && <PagosTab />}
    </div>
  );
}
