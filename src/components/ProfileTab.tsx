"use client";

// ============================================================
// Pestaña Cuenta (antes «Perfil»; el nombre pasa al Perfil Ciclista) - con subsecciones (solo se ve la activa):
//   · "Mis datos": sesión (correo + usuario), resumen de cuenta,
//     bici y pin. La versión de la app vive en Configuración → Acerca de.
//   · "Pagos y suscripciones": modo Pro (código / Play Billing) -
//     la licencia va atada al correo de la cuenta.
//   · "Gestionar" (v1.14.0): gestión de la cuenta - código de
//     recuperación, sincronización en la nube, descarga de datos y
//     eliminación de la cuenta.
// ============================================================

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AtSign,
  Bike,
  LogOut,
  LogIn,
  UserPlus,
  Users,
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
import { authAction, deleteAccount, forgotPassword, googleAuthAction, changeUsername, leerBienvenida, limpiarBienvenida, logout, resetPassword, revokeOtherSessions, useMe } from "@/hooks/useMe";
import { Checkbox } from "@/components/ui/checkbox";
import { isOfflineMode, offlineUpdateProfile } from "@/lib/offlineAuth";
import { DEFAULT_BIKE_KG, DEFAULT_RIDER_KG, getRideWeights, hydrateWeightsFromAccount, setRideWeights } from "@/lib/rideWeights";
import { manualSync, syncStore } from "@/lib/cloudSync";
import { CONTACT_WHATSAPP } from "@/lib/proConfig";
import { nativeGoogleSignIn, nativeGoogleSignOut } from "@/lib/googleAuth";
import { renderBotonGoogle } from "@/lib/googleWeb";
import { Capacitor } from "@capacitor/core";
import { shareOrDownloadFile } from "@/lib/shareFile";
import { usernameLocked } from "@/lib/username";
import { exportarMisDatos } from "@/lib/exportDatos";
import { FileDown } from "lucide-react";
import { PINS, DEFAULT_PIN, RIDER_LEVELS, riderLevelForKm, type PinId } from "@/lib/pins";
import { PagosTab } from "@/components/PagosTab";
import { SubTabs, type SubTabDef } from "@/components/SubTabs";
import { t, useLang } from "@/lib/i18n";

/** Subsecciones de Cuenta: se muestran al entrar y solo se ve la activa.
 *  "Pagos y suscripciones" y "Gestionar" aparecen solo con sesión: la
 *  licencia Pro va atada al correo y las tarjetas de gestión son de la
 *  cuenta. */
type SubKey = "datos" | "pagos" | "gestionar";
// labels = claves i18n (se traducen al renderizar; ver SubTabs abajo)
const PROFILE_SUBS: SubTabDef[] = [
  { key: "datos", label: "pf.subDatos" },
  { key: "pagos", label: "pf.subPagos" },
  { key: "gestionar", label: "pf.subGestionar" },
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
  useLang();
  const offline = isOfflineMode();
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.getServer);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // Bienvenida al crear cuenta (v1.14.1): la marca authAction al registrar
  // (web o APK). El efecto la re-lee cuando hay sesión, porque el flag se
  // escribe DESPUÉS del primer render de este componente.
  const [bienvenida, setBienvenida] = useState<string | null>(null);
  useEffect(() => {
    setBienvenida(me ? leerBienvenida() : null);
  }, [me?.user.email]);
  // A-01/B-05: aceptación de términos y confirmación de edad al crear cuenta.
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [confirmaEdad, setConfirmaEdad] = useState(false);
  // C-02: resultado de "cerrar otras sesiones".
  const [sesionesMsg, setSesionesMsg] = useState<string | null>(null);
  // A-02: resultado de la exportación de datos personales.
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delStage, setDelStage] = useState<"idle" | "confirm" | "busy">("idle");

  // --- Mi bici · pesos (v1.13.17): watts estimados en subida >4% ---
  const [pesoR, setPesoR] = useState(String(DEFAULT_RIDER_KG));
  const [pesoB, setPesoB] = useState(String(DEFAULT_BIKE_KG));
  const [pesoMsg, setPesoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Hidratación: los pesos guardados en el teléfono mandan; si aún no
  // hay ninguno y la cuenta trae respaldo, se adopta (rideWeights).
  useEffect(() => {
    if (!me) return;
    const w = getRideWeights();
    setPesoR(String(w.riderKg));
    setPesoB(String(w.bikeKg));
    hydrateWeightsFromAccount(me.user);
  }, [me?.user.email]);
  const guardarPesos = () => {
    const w = setRideWeights(Number(pesoR.replace(",", ".")), Number(pesoB.replace(",", ".")));
    if (!w) {
      setPesoMsg({ ok: false, text: t("pf.pesoError") });
      return;
    }
    setPesoR(String(w.riderKg));
    setPesoB(String(w.bikeKg));
    const patch = { riderWeightKg: w.riderKg, bikeWeightKg: w.bikeKg };
    try {
      if (isOfflineMode()) {
        // APK: cuenta local + op en el outbox (PUT /api/me al sincronizar).
        offlineUpdateProfile(patch);
      } else {
        void fetch("/api/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      }
    } catch {
      // sin conexión: los pesos ya quedaron en el teléfono
    }
    setPesoMsg({ ok: true, text: t("pf.pesoOk") });
    setTimeout(() => setPesoMsg(null), 6000);
  };

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

  // Subsección activa de Cuenta (se mantiene al iniciar sesión).
  // Sin sesión "pagos" y "gestionar" no existen: caen a "datos".
  const [sub, setSub] = useState<SubKey>("datos");
  const activeSub: SubKey = (sub === "pagos" || sub === "gestionar") && !me ? "datos" : sub;

  const submit = async () => {
    setBusy(true);
    setError(null);
    if (mode === "register") {
      const err = await authAction(mode, {
        email,
        username,
        password,
        terminos: aceptaTerminos,
        edad14: confirmaEdad,
      });
      setBusy(false);
      if (err) setError(err);
      return;
    }
    const err = await authAction(mode, { email, password });
    setBusy(false);
    if (err) setError(err);
  };

  // C-02: cierra las sesiones en otros dispositivos.
  const cerrarOtrasSesiones = async () => {
    setSesionesMsg(null);
    const n = await revokeOtherSessions();
    setSesionesMsg(n === null ? t("pf.sesionesError") : n === 0 ? t("pf.sesionesCero") : t("pf.sesionesOk").replace("{n}", String(n)));
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
    setFMsg(offline ? null : t("pf.solicitudOk"));
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
      setError((e as Error).message || t("pf.googleErr1"));
    } finally {
      setBusyGoogle(false);
    }
  };

  // Google en la web (GSI oficial, v1.12.5): el botón renderizado por
  // Google abre el selector de cuentas del navegador; el idToken va a
  // /api/auth/google, que valida y deja la sesión en cookie - igual
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
            setError(t("pf.googleErr2"));
            return;
          }
          window.location.reload(); // cookie de sesión lista: la web recarga con la sesión
        } catch {
          if (vivo) setError(t("pf.googleErr2"));
        }
      })();
    }).then((ok) => {
      if (vivo) setGsiWebOk(ok);
    });
    return () => {
      vivo = false;
    };
  }, [offline, mode]);

  // «Compartir perfil» se trasladó al Perfil Ciclista (4ª pestaña,
  // v1.13.16): desde allí comparte la tarjeta de arquetipo + ejes.

  const submitUsername = async () => {
    setUserBusy(true);
    setUserMsg(null);
    const err = await changeUsername(newUsername);
    setUserBusy(false);
    if (err) {
      setUserMsg({ ok: false, text: err });
    } else {
      setUserMsg({ ok: true, text: t("pf.cambioListo", newUsername.trim().toLowerCase()) });
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
              <p className="font-medium text-foreground">{t("pf.tuCuenta")}</p>
              <p className="mt-1 leading-relaxed">
                {t("pf.cuentaIntro")}
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
              <p className="font-medium text-foreground">{t("pf.resetTitulo")}</p>
            </div>

            {fStep === 3 ? (
              <>
                <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
                  {t("pf.resetListo")}
                </p>
                <Button onClick={() => backToForm(true)} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
                  {t("pf.iniciarSesion")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {offline
                    ? t("pf.resetOffline")
                    : t("pf.resetServer")}
                </p>

                <div className="grid gap-1.5">
                  <Label htmlFor="pf-f-email" className="text-foreground/90">{t("pf.correoCuenta")}</Label>
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
                        {t("pf.escribirWhatsapp")}
                      </a>
                    </Button>
                  </div>
                )}

                {(offline || fStep === 2) && (
                  <>
                    {offline && (
                      <div className="grid gap-1.5">
                        <Label htmlFor="pf-f-code" className="text-foreground/90">{t("pf.codigoRecuperacion")}</Label>
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
                        <Label htmlFor="pf-f-code" className="text-foreground/90">{t("pf.codigo6")}</Label>
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
                      <Label htmlFor="pf-f-pass" className="text-foreground/90">{t("pf.nuevaContrasena")}</Label>
                      <Input
                        id="pf-f-pass"
                        type="password"
                        autoComplete="new-password"
                        className="bg-card border-border"
                        placeholder={t("pf.min6")}
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
                  {fBusy ? t("pf.conectando") : offline || fStep === 2 ? t("pf.resetTitulo") : t("pf.solicitarCodigo")}
                </Button>
                <button
                  type="button"
                  onClick={() => backToForm(true)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t("pf.volverLogin")}
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
            <LogIn className="h-4 w-4 mr-2" /> {t("pf.iniciarSesion")}
          </Button>
          <Button
            variant={mode === "register" ? "default" : "outline"}
            onClick={() => setMode("register")}
            className={`flex-1 ${mode === "register" ? "bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold" : "border-border text-muted-foreground"}`}
          >
            <UserPlus className="h-4 w-4 mr-2" /> {t("pf.crearCuenta")}
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
            <Label htmlFor="pf-email" className="text-foreground/90">{t("pf.correo")}</Label>
            <Input id="pf-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" className="bg-card border-border" placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "register" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="pf-user" className="text-foreground/90">{t("pf.usuario")}</Label>
                <Input id="pf-user" name="username" autoCapitalize="none" autoComplete="username" spellCheck={false} className="bg-card border-border" placeholder="ej: ciclista_stgo" value={username} onChange={(e) => setUsername(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">{t("pf.usuarioHint")}</p>
              </div>
              {/* A-01/B-05: aceptación explícita y confirmación de edad. */}
              <label className="flex items-start gap-2.5 text-[12px] leading-snug text-muted-foreground">
                <Checkbox checked={aceptaTerminos} onCheckedChange={(v) => setAceptaTerminos(v === true)} className="mt-0.5" />
                <span>
                  {t("pf.aceptoA")}{" "}
                  <a href="/terminos" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">{t("pf.terminos")}</a>{" "}
                  {t("pf.aceptoY")}{" "}
                  <a href="/privacidad" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">{t("pf.privacidad")}</a>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-[12px] leading-snug text-muted-foreground">
                <Checkbox checked={confirmaEdad} onCheckedChange={(v) => setConfirmaEdad(v === true)} className="mt-0.5" />
                <span>{t("pf.confirmaEdad")}</span>
              </label>
            </>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="pf-pass" className="text-foreground/90">{t("pf.contrasena")}</Label>
            <Input id="pf-pass" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} className="bg-card border-border" placeholder={t("pf.min6")} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || !email || !password || (mode === "register" && (!username || !aceptaTerminos || !confirmaEdad))} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
            {busy ? t("pf.conectando") : mode === "login" ? t("pf.entrar") : t("pf.crearMiCuenta")}
          </Button>
          {mode === "login" && (
            <button
              type="button"
              onClick={() => setAuthView("forgot")}
              className="justify-self-center text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
            >
              {t("pf.olvidaste")}
            </button>
          )}
          {mode === "login" && offline && (
            <p className="text-[11px] leading-snug text-muted-foreground text-center">
              {t("pf.webCuentaNota")}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-muted" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{t("pf.o")}</span>
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
              {busyGoogle ? t("pf.conectando") : (<><GoogleIcon /> <span className="ml-2">{t("pf.continuarGoogle")}</span></>)}
            </Button>
          ) : (
            /* Web: botón oficial de Google (GSI). El div lo llena el
               efecto de arriba; si Google no carga queda vacío y el
               texto de abajo lo explica. */
            <div ref={gsiDiv} className="flex min-h-11 justify-center" />
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
            {offline
              ? t("pf.googleApkNota")
              : gsiWebOk === false
                ? t("pf.googleWebErr")
                : t("pf.googleNota")}
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
    return <div className="h-24 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">{t("pf.cargandoPerfil")}</div>;
  }

  const pin = PINS[(me.user.selectedPin as PinId) ?? DEFAULT_PIN] ?? PINS[DEFAULT_PIN];
  const uLock = usernameLocked(me.user.usernameChangedAt);
  // Nivel del ciclista (compartido con Desafíos): km GPS de la cuenta.
  const lvl = riderLevelForKm(me.stats.totalKm);

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel={t("pf.subAria")}
        value={activeSub}
        onChange={(k) => setSub(k as SubKey)}
        tabs={PROFILE_SUBS.map((s) => ({ ...s, label: t(s.label) }))}
      />

      {sub === "datos" && (
      <>
      {/* Bienvenida al crear cuenta (se cierra y no vuelve a aparecer) */}
      {bienvenida !== null && (
        <Card className="border-emerald-600/40 bg-emerald-600/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>🎉</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">
                {bienvenida ? t("pf.bienvenidoTitulo", bienvenida) : t("pf.bienvenidoTituloSinNombre")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("pf.bienvenidoCuerpo")}</p>
              <Button
                size="sm"
                className="mt-3 h-9 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold"
                onClick={() => {
                  limpiarBienvenida();
                  setBienvenida(null);
                }}
              >
                {t("pf.bienvenidoOk")}
              </Button>
            </div>
          </div>
        </Card>
      )}
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
              onClick={() => {
                void nativeGoogleSignOut();
                void logout();
              }}
              className="h-8 border-border px-2.5 text-[11px] text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="mr-1 h-3.5 w-3.5" /> {t("pf.salir")}
            </Button>
            {/* C-02: revoca las sesiones activas en otros dispositivos. */}
            {!offline && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void cerrarOtrasSesiones()}
                  className="h-8 border-border px-2.5 text-[11px] text-muted-foreground"
                >
                  {t("pf.sesionesBoton")}
                </Button>
                {sesionesMsg && <p className="max-w-[16rem] text-[10.5px] leading-snug text-muted-foreground">{sesionesMsg}</p>}
              </>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatBox label={t("pf.kmRecorridos")} value={me.stats.totalKm.toFixed(1)} unit="km" />
          <StatBox label={t("pf.rides")} value={me.stats.rideCount} />
          <StatBox label={t("pf.velMax")} value={me.stats.maxKmh.toFixed(1)} unit="km/h" />
          <StatBox label={t("pf.desnivelAcum")} value={`+${me.stats.totalGainM}`} unit="m" />
        </div>
      </Card>
      {/* Cambiar nombre de usuario (1 vez cada 30 días) */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3 mb-3">
          <PenLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("pf.cambiarUsuario")}</p>
            <p className="mt-1 leading-relaxed">
              {t("pf.cambiarIntro1")}<span className="font-semibold text-foreground">@{me.user.username}</span>{t("pf.cambiarIntro2", me.user.email)}
            </p>
          </div>
        </div>
        {uLock.locked && uLock.nextAt ? (
          <p className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            {t("pf.usuarioLock")}
            <span className="font-medium text-foreground/90">{uLock.nextAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</span>.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                placeholder={t("pf.usuarioPlaceholder", me.user.username)}
                aria-label={t("pf.usuarioAria")}
                className="bg-card border-border flex-1"
                maxLength={20}
              />
              <Button
                onClick={submitUsername}
                disabled={userBusy || !newUsername.trim() || newUsername.trim() === me.user.username}
                className="bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold shrink-0"
              >
                {userBusy ? t("pf.cambiando") : t("pf.cambiar")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("pf.usuarioHint")}
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

      {/* Mi bici · pesos (v1.13.17): alimentan los watts estimados en
          subida >4% del Perfil Ciclista. El valor vive en el teléfono
          (rideWeights); la cuenta lo respalda por si cambia de teléfono. */}
      <Card className="bg-card/80 border-border p-4">
        <div className="flex items-start gap-3 mb-3">
          <Bike className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("pf.pesoTitulo")}</p>
            <p className="mt-1 leading-relaxed">{t("pf.pesoIntro")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="peso-ciclista" className="text-[11px] text-muted-foreground">{t("pf.pesoCiclista")}</Label>
            <Input
              id="peso-ciclista"
              inputMode="decimal"
              value={pesoR}
              onChange={(e) => setPesoR(e.target.value)}
              className="bg-card border-border mt-1"
              aria-label={t("pf.pesoCiclista")}
            />
          </div>
          <div>
            <Label htmlFor="peso-bici" className="text-[11px] text-muted-foreground">{t("pf.pesoBici")}</Label>
            <Input
              id="peso-bici"
              inputMode="decimal"
              value={pesoB}
              onChange={(e) => setPesoB(e.target.value)}
              className="bg-card border-border mt-1"
              aria-label={t("pf.pesoBici")}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-3 h-8 border-border px-3 text-[12px]" onClick={guardarPesos}>
          {t("pf.pesoGuardar")}
        </Button>
        {pesoMsg && (
          <p
            className={`mt-2 text-xs ${pesoMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
            role="status"
          >
            {pesoMsg.text}
          </p>
        )}
      </Card>

      </>
      )}

      {/* Gestionar (v1.14.0): gestión de la cuenta en un solo lugar -
          código de recuperación, sincronización en la nube, descarga de
          datos y baja definitiva. Sin sesión la subsección cae a "datos". */}
      {sub === "gestionar" && (
      <>
      {offline && me.user.recoveryCode && (
        /* Solo APK: el código permite restablecer la contraseña de la
           cuenta local sin perder km, logros ni pines. */
        <Card className="bg-card/60 border-border p-3">
          <div className="flex items-center gap-3">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{t("pf.codigoRecuperacion")}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("pf.guardarCodigo")}
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
                    () => setShareMsg(t("pf.codigoCopiado")),
                    () => undefined
                  );
                  setTimeout(() => setShareMsg(null), 8000);
                }}
              >
                {t("pf.copiar")}
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
              <p className="text-[13px] font-medium text-foreground">{t("pf.syncNube")}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {sync.phase === "syncing"
                  ? t("pf.syncSubiendo")
                  : sync.phase === "ok"
                    ? t("pf.syncOk", sync.email ? ` (${sync.email})` : "")
                    : sync.phase === "offline"
                      ? t("pf.syncOffline", sync.pending)
                      : sync.phase === "unlinked"
                        ? t("pf.syncUnlinked")
                        : sync.phase === "error"
                          ? t("pf.syncError")
                          : t("pf.syncEntra")}
                {sync.phase === "ok" && sync.lastSyncAt
                  ? t("pf.ultimaSync", new Date(sync.lastSyncAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }))
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
                {t("pf.sincronizar")}
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

      {/* A-02: portabilidad de datos personales (Ley 21.719). */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <FileDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="font-medium text-foreground">{t("pf.exportarTitulo")}</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{t("pf.exportarIntro")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const perfil = {
                  email: me?.user.email ?? null,
                  username: me?.user.username ?? null,
                  bicicleta: {
                    marca: me?.user.bikeBrand ?? null,
                    tipo: me?.user.bikeType ?? null,
                    modelo: me?.user.bikeModel ?? null,
                    talla: me?.user.bikeSize ?? null,
                    color: me?.user.bikeColor ?? null,
                  },
                };
                void exportarMisDatos(perfil).then((ok) => {
                  setExportMsg(ok ? t("pf.exportarOk") : t("pf.exportarError"));
                  window.setTimeout(() => setExportMsg(null), 6000);
                });
              }}
              className="mt-3 h-8 border-border px-3 text-[12px]"
            >
              <FileDown className="mr-1 h-3.5 w-3.5" /> {t("pf.exportarBoton")}
            </Button>
            {exportMsg && <p className="mt-2 text-[11.5px] text-muted-foreground">{exportMsg}</p>}
          </div>
        </div>
      </Card>

      {/* Zona de cuenta - baja definitiva (Google Play exige eliminación in-app) */}
      <Card className="border-red-900/40 bg-red-950/10 p-4">
        <div className="flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="font-medium text-foreground">{t("pf.eliminarCuenta")}</p>
            {delStage === "idle" ? (
              <>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {t("pf.eliminarIntro")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDelStage("confirm")}
                  className="mt-3 h-8 border-red-900/50 px-3 text-[12px] text-red-600 hover:border-red-600 hover:text-red-500 dark:text-red-400"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("pf.eliminarMiCuenta")}
                </Button>
              </>
            ) : delStage === "confirm" ? (
              <>
                <p className="mt-1 leading-relaxed text-foreground/90">
                  {t("pf.eliminarSeguro1")}<span className="font-semibold">{t("pf.eliminarSeguroBold")}</span>{t("pf.eliminarSeguro2")}<span className="font-semibold">{me.user.email}</span>.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDelStage("idle")}
                    className="h-8 border-border px-3 text-[12px] text-muted-foreground"
                  >
                    {t("mapa.cancelar")}
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
                    {t("pf.eliminarDefinitivamente")}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-red-600 dark:text-red-400">{t("pf.eliminando")}</p>
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
