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
import { authAction, cambiarPassword, crearPasswordInicial, deleteAccount, forgotPassword, googleAuthAction, changeUsername, leerBienvenida, limpiarBienvenida, logout, resetPassword, revokeOtherSessions, useMe } from "@/hooks/useMe";
import { Checkbox } from "@/components/ui/checkbox";
import { isOfflineMode, offlineUpdateProfile } from "@/lib/offlineAuth";
import { DEFAULT_BIKE_KG, DEFAULT_RIDER_KG, getRideWeights, hydrateWeightsFromAccount, setRideWeights } from "@/lib/rideWeights";
import { manualSync, syncStore } from "@/lib/cloudSync";
import { apiUrl } from "@/lib/backend";
import { CONTACT_EMAIL } from "@/lib/proConfig";
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
  // Refs espejo de las casillas: el callback de Google (GSI) vive dentro
  // de un efecto que no se re-ejecuta al tildar, así que lee estos refs.
  const terminosRef = useRef(false);
  const edadRef = useRef(false);
  const alCambiarTerminos = (v: boolean) => { setAceptaTerminos(v); terminosRef.current = v; };
  const alCambiarEdad = (v: boolean) => { setConfirmaEdad(v); edadRef.current = v; };
  // Validador previo (web, petición del usuario): el correo decide si se
  // muestra el acceso — SIN casillas, que solo aplican al CREAR cuenta —
  // o se deriva a «Crear cuenta». El APK mantiene su flujo local sin
  // validador (cuenta en el teléfono + internet incierto).
  const [validado, setValidado] = useState(false);
  const [sinContrasena, setSinContrasena] = useState(false); // cuenta Google aún sin contraseña
  const [validando, setValidando] = useState(false);
  const [derivar, setDerivar] = useState(false); // mensaje al derivar a registro
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
  // Server: paso 1 pide el código (lo entrega soporte por CORREO tras
  // verificar identidad), paso 2 cambia la contraseña con el código.
  // APK: se usa el código de recuperación local (XXXX-XXXX).
  const [authView, setAuthView] = useState<"form" | "forgot" | "googlePass">("form");
  const [fStep, setFStep] = useState<1 | 2 | 3>(1); // 3 = listo
  const [fEmail, setFEmail] = useState("");
  const [fCode, setFCode] = useState("");
  const [fPass, setFPass] = useState("");
  const [fBusy, setFBusy] = useState(false);
  const [fMsg, setFMsg] = useState<string | null>(null);
  const [fErr, setFErr] = useState<string | null>(null);

  // --- Paso «Crea tu contraseña» (primer ingreso con Google) ---
  const [gpPass, setGpPass] = useState("");
  const [gpPass2, setGpPass2] = useState("");
  const [gpBusy, setGpBusy] = useState(false);
  const [gpErr, setGpErr] = useState<string | null>(null);

  // --- Cambiar contraseña (Gestionar): para quien conoce la actual ---
  const [cambiarPassAbierto, setCambiarPassAbierto] = useState(false);
  const [cpActual, setCpActual] = useState("");
  const [cpNueva, setCpNueva] = useState("");
  const [cpNueva2, setCpNueva2] = useState("");
  const [cpBusy, setCpBusy] = useState(false);
  const [cpOk, setCpOk] = useState(false);
  const [cpMsg, setCpMsg] = useState<string | null>(null);

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
    // Validador previo: Enter en el correo (sin contraseña aún) valida.
    if (!validado) {
      setBusy(false);
      void alValidarEmail();
      return;
    }
    const err = await authAction(mode, { email, password });
    setBusy(false);
    if (err) setError(err);
  };

  // Validador previo (web Y APK): consulta al servidor si el correo
  // tiene cuenta y contraseña. La decisión la toma el CORREO, nunca
  // el método de sesión: con cuenta sin contraseña (creada con
  // Google) se abre «Crea tu contraseña», no un registro nuevo.
  // Unificado vía apiUrl(): en el APK el fetch relativo moriría en
  // el webview (v1.26.0 derivaba a «Crear cuenta» por ese bug).
  const alValidarEmail = async () => {
    const correo = email.trim();
    if (!correo || validando) return;
    setValidando(true);
    setError(null);
    setDerivar(false);
    setSinContrasena(false);
    try {
      const url = apiUrl("/api/auth/existe");
      if (!url) {
        setError(t("pf.validarErr"));
        return;
      }
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo }),
      });
      const d = (await r.json().catch(() => ({}))) as { existe?: boolean; tieneContrasena?: boolean; error?: string };
      if (!r.ok) {
        setError(d.error ?? t("pf.validarErr"));
        return;
      }
      if (!d.existe) {
        setMode("register");
        setDerivar(true);
        setValidado(false);
        return;
      }
      setSinContrasena(!d.tieneContrasena);
      setValidado(true);
    } catch {
      setError(t("pf.validarErr"));
    } finally {
      setValidando(false);
    }
  };

  // C-02: cierra las sesiones en otros dispositivos.
  const cerrarOtrasSesiones = async () => {
    setSesionesMsg(null);
    const n = await revokeOtherSessions();
    setSesionesMsg(n === null ? t("pf.sesionesError") : n === 0 ? t("pf.sesionesCero") : t("pf.sesionesOk").replace("{n}", String(n)));
  };

  // Paso 1: pedir el código (server): llega al correo registrado,
  // en la web y en el APK por igual.
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
    setFMsg(t("pf.solicitudOk"));
  };

  // Paso 2: cambiar la contraseña con el código (6 dígitos del correo
  // vía server — deja la sesión iniciada — o código de recuperación
  // local del dispositivo sin internet).
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
    // El reset deja la sesión iniciada (server + espejo local en el
    // APK): si refreshMe ya trajo la cuenta, la UI cambia sola a la
    // vista con sesión. fStep 3 queda para el caso sin sesión.
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
    // Sin casillas obligatorias en el acceso: para cuentas ya creadas el
    // servidor no las pide. Si Google tuviera que CREAR la cuenta (400),
    // derivamos a «Crear cuenta», donde viven las casillas.
    setBusyGoogle(true);
    setError(null);
    try {
      const acct = await nativeGoogleSignIn();
      // idToken incluido: offlineGoogleSignIn lo canjea por un token de
      // sesión del servidor (linkGoogle). Sin él, amigos/rides/compartir
      // en el APK nunca sabían de la cuenta Google (bug hasta v1.12.5).
      const { err, nueva } = await googleAuthAction({ sub: acct.sub, email: acct.email, name: acct.name, idToken: acct.idToken, aceptacion: { terminos: aceptaTerminos, edad14: confirmaEdad } });
      if (err) {
        setError(err);
        if (err.includes("para crear tu cuenta con Google")) setMode("register"); // casillas visibles ahí
      } else if (nueva) setAuthView("googlePass"); // paso obligatorio: crear contraseña
    } catch (e) {
      setError((e as Error).message || t("pf.googleErr1"));
    } finally {
      setBusyGoogle(false);
    }
  };

  // Paso «Crea tu contraseña»: fija la contraseña (server con la sesión
  // recién canjeada + cuenta local en el APK) y recarga con la sesión.
  const guardarPassGoogle = async () => {
    if (gpPass !== gpPass2) {
      setGpErr(t("pf.passNoCoincide"));
      return;
    }
    setGpBusy(true);
    setGpErr(null);
    const err = await crearPasswordInicial(gpPass);
    setGpBusy(false);
    if (err) {
      setGpErr(err);
      return;
    }
    window.location.reload();
  };

  // Cambiar contraseña (Gestionar): pide la actual y la nueva; el
  // servidor además cierra las sesiones activas en otros dispositivos.
  const guardarCambioPass = async () => {
    if (cpNueva !== cpNueva2) {
      setCpOk(false);
      setCpMsg(t("pf.passNoCoincide"));
      return;
    }
    setCpBusy(true);
    setCpMsg(null);
    const err = await cambiarPassword(cpActual, cpNueva);
    setCpBusy(false);
    if (err) {
      setCpOk(false);
      setCpMsg(err);
      return;
    }
    setCpOk(true);
    setCpMsg(t("pf.cambiarPassOk"));
    setCpActual("");
    setCpNueva("");
    setCpNueva2("");
    setTimeout(() => {
      setCpMsg(null);
      setCambiarPassAbierto(false);
    }, 6000);
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
        // Sin casillas obligatorias en el acceso: cuentas existentes
        // entran directo. Si el servidor pide las casillas (400:
        // Google crearía una cuenta nueva), derivamos a «Crear cuenta».
        try {
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken, terminos: terminosRef.current, edad14: edadRef.current }),
          });
          if (!vivo) return;
          if (!r.ok) {
            const d = (await r.json().catch(() => ({}))) as { error?: string };
            if (r.status === 400 && d.error) {
              setError(d.error);
              setMode("register"); // casillas visibles aquí
              return;
            }
            setError(d.error ?? t("pf.googleErr2"));
            return;
          }
          const d = (await r.json().catch(() => ({}))) as { nueva?: boolean };
          if (d.nueva) {
            // Cuenta recién creada: antes de entrar, crear contraseña.
            if (vivo) setAuthView("googlePass");
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
  }, [offline, mode, validado]);

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

  // ---------- Reparación de la vinculación de sync (contraseña
  // divergente teléfono/web): reset por código de correo DENTRO de la
  // tarjeta — al terminar, el token del reset vincula el progreso. ----------
  const [syncReset, setSyncReset] = useState<"idle" | "codigo">("idle");
  const [syncCode, setSyncCode] = useState("");
  const [syncPass, setSyncPass] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const enviarCodigoSync = async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    const err = await forgotPassword(me?.user?.email ?? "");
    setSyncBusy(false);
    if (err) {
      setSyncMsg(err);
      return;
    }
    setSyncReset("codigo");
    setSyncMsg(t("pf.syncCodigoEnviado"));
  };

  const vincularConReset = async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    const err = await resetPassword({ email: me?.user?.email ?? "", code: syncCode, newPassword: syncPass });
    setSyncBusy(false);
    // Sin error, el token del reset dejó la sync en "ok": la tarjeta
    // cambia sola de estado (y el espejo quedó con la contraseña nueva).
    if (err) setSyncMsg(err);
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
                        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("pf.resetAsunto"))}&body=${encodeURIComponent(`${t("pf.resetCuerpo")} ${fEmail}`)}`}
                      >
                        {t("pf.escribirSoporte")}
                      </a>
                    </Button>
                  </div>
                )}

                {fStep === 2 && (
                  <>
                    {/* Código unificado: 6 dígitos del correo (server,
                       web y APK) o el código local XXXX-XXXX del
                       dispositivo como respaldo sin internet. */}
                    <div className="grid gap-1.5">
                      <Label htmlFor="pf-f-code" className="text-foreground/90">{t("pf.codigoAcceso")}</Label>
                      <Input
                        id="pf-f-code"
                        autoCapitalize="characters"
                        autoComplete="one-time-code"
                        spellCheck={false}
                        maxLength={9}
                        className="bg-card border-border font-mono tracking-widest uppercase"
                        placeholder="······  ·  XXXX-XXXX"
                        value={fCode}
                        onChange={(e) => setFCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                      />
                    </div>
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
                  onClick={() => void (fStep === 2 ? confirmReset() : requestReset())}
                  disabled={fBusy || !fEmail || (fStep === 2 ? !fCode || fPass.length < 8 : false)}
                  className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold"
                >
                  {fBusy ? t("pf.conectando") : fStep === 2 ? t("pf.resetTitulo") : t("pf.solicitarCodigo")}
                </Button>
                {offline && fStep === 1 && (
                  /* Respaldo sin internet: el código local del
                     dispositivo (se muestra con la sesión iniciada en
                     Cuenta → Mis datos) salta directo al paso 2. */
                  <button
                    type="button"
                    onClick={() => { setFStep(2); setFMsg(null); setFErr(null); }}
                    className="justify-self-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {t("pf.usarCodigoLocal")}
                  </button>
                )}
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
        ) : authView === "googlePass" ? (
          /* --- Paso obligatorio tras el primer ingreso con Google:
                crea la contraseña para entrar también por correo.
                «Olvidé mi contraseña» queda solo para recuperar. --- */
          <Card className="bg-card/80 border-border p-4 grid gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium text-foreground">{t("pf.googlePassTitulo")}</p>
            </div>
            <p className="text-sm text-muted-foreground">{t("pf.googlePassIntro")}</p>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-gp-pass" className="text-foreground/90">{t("pf.contrasena")}</Label>
              <Input id="pf-gp-pass" type="password" autoComplete="new-password" className="bg-card border-border" placeholder={t("pf.min6")} value={gpPass} onChange={(e) => setGpPass(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-gp-pass2" className="text-foreground/90">{t("pf.confirmarContrasena")}</Label>
              <Input id="pf-gp-pass2" type="password" autoComplete="new-password" className="bg-card border-border" value={gpPass2} onChange={(e) => setGpPass2(e.target.value)} />
            </div>
            {gpErr && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{gpErr}</p>}
            <Button disabled={gpBusy || gpPass.length < 8 || gpPass !== gpPass2} onClick={() => void guardarPassGoogle()} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
              {gpBusy ? t("pf.conectando") : t("pf.googlePassGuardar")}
            </Button>
          </Card>
        ) : (
        <>
        <div className="flex gap-2">
          <Button
            variant={mode === "login" ? "default" : "outline"}
            onClick={() => { setMode("login"); setValidado(false); setSinContrasena(false); setDerivar(false); setError(null); }}
            className={`flex-1 ${mode === "login" ? "bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-semibold" : "border-border text-muted-foreground"}`}
          >
            <LogIn className="h-4 w-4 mr-2" /> {t("pf.iniciarSesion")}
          </Button>
          <Button
            variant={mode === "register" ? "default" : "outline"}
            onClick={() => { setMode("register"); setDerivar(false); setError(null); }}
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
            <Input id="pf-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" className="bg-card border-border" placeholder="tu@correo.cl" value={email} onChange={(e) => { setEmail(e.target.value); if (mode === "login") { setValidado(false); setSinContrasena(false); } }} />
          </div>
          {mode === "register" && (
            <>
              {derivar && (
                <div className="rounded-lg border border-sky-600/40 bg-sky-950/20 p-3 text-xs text-sky-700 dark:text-sky-300">
                  <p>{t("pf.derivarNota")}</p>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="pf-user" className="text-foreground/90">{t("pf.usuario")}</Label>
                <Input id="pf-user" name="username" autoCapitalize="none" autoComplete="username" spellCheck={false} className="bg-card border-border" placeholder="ej: ciclista_stgo" value={username} onChange={(e) => setUsername(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">{t("pf.usuarioHint")}</p>
              </div>
              {/* A-01/B-05: aceptación explícita y confirmación de edad. */}
              <label className="flex items-start gap-2.5 text-[12px] leading-snug text-muted-foreground">
                <Checkbox checked={aceptaTerminos} onCheckedChange={(v) => alCambiarTerminos(v === true)} className="mt-0.5" />
                <span>
                  {t("pf.aceptoA")}{" "}
                  <a href="/terminos" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">{t("pf.terminos")}</a>{" "}
                  {t("pf.aceptoY")}{" "}
                  <a href="/privacidad" className="font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400">{t("pf.privacidad")}</a>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-[12px] leading-snug text-muted-foreground">
                <Checkbox checked={confirmaEdad} onCheckedChange={(v) => alCambiarEdad(v === true)} className="mt-0.5" />
                <span>{t("pf.confirmaEdad")}</span>
              </label>
            </>
          )}
          {(mode === "register" || validado) && (
            <div className="grid gap-1.5">
              <Label htmlFor="pf-pass" className="text-foreground/90">{t("pf.contrasena")}</Label>
              <Input id="pf-pass" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} className="bg-card border-border" placeholder={t("pf.min6")} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          {mode === "login" && validado && sinContrasena && (
            /* El servidor reconoce la cuenta (409 sinContrasena): se creó
               con Google y aún no tiene contraseña. Ofrecer definir una
               por correo (código al registro) o entrar con Google. */
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/20 p-3 text-xs text-emerald-700 dark:text-emerald-300 grid gap-2">
              <p>{t("pf.googleSinPass")}</p>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-emerald-600/50 text-emerald-700 hover:bg-emerald-950/40 dark:text-emerald-300"
                onClick={() => { setFEmail(email.trim()); setFCode(""); setFPass(""); setFStep(1); setFMsg(null); setFErr(null); setAuthView("forgot"); }}
              >
                {t("pf.googleSinPassBoton")}
              </Button>
            </div>
          )}
          {mode === "login" && !validado ? (
            /* Validador previo: solo el correo + validar. Las casillas de
               Términos/edad NO van en el acceso: se aceptaron al crear la
               cuenta; viven únicamente en «Crear cuenta». */
            <>
              <Button
                type="button"
                onClick={() => void alValidarEmail()}
                disabled={validando || !email}
                className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold"
              >
                {validando ? t("pf.conectando") : t("pf.validarContinuar")}
              </Button>
              <p className="text-[11px] leading-snug text-muted-foreground text-center">{t("pf.validarNota")}</p>
            </>
          ) : (
            <Button type="submit" disabled={busy || !email || (mode === "register" ? !username || !aceptaTerminos || !confirmaEdad : !password)} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
              {busy ? t("pf.conectando") : mode === "login" ? t("pf.entrar") : t("pf.crearMiCuenta")}
            </Button>
          )}
          {mode === "login" && validado && (
            <button
              type="button"
              onClick={() => { setFEmail(email.trim()); setAuthView("forgot"); }}
              className="justify-self-center text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
            >
              {t("pf.olvidaste")}
            </button>
          )}
          {mode === "login" && validado && offline && (
            <p className="text-[11px] leading-snug text-muted-foreground text-center">
              {t("pf.webCuentaNota")}
            </p>
          )}

          {/* Google solo con el correo ya validado (existe) o creando
             cuenta: si el correo no está registrado se deriva a
             «Crear cuenta» en vez de dejar entrar con Google. */}
          {(mode === "register" || validado) && (
          <>
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
          </>
          )}
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
                        ? sync.linkReason === "sinPass"
                          ? t("pf.syncSinPass")
                          : sync.linkReason === "passDistinta"
                            ? t("pf.syncPassDistinta")
                            : t("pf.syncUnlinked")
                        : sync.phase === "error"
                          ? t("pf.syncError")
                          : t("pf.syncEntra")}
                {sync.phase === "ok" && sync.lastSyncAt
                  ? t("pf.ultimaSync", new Date(sync.lastSyncAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }))
                  : ""}
              </p>
              {sync.phase === "unlinked" && sync.linkReason === "passDistinta" && (
                /* Contraseña del teléfono ≠ web: reset por código de
                   correo aquí mismo; al terminar, el token del reset
                   vincula el progreso (la tarjeta pasa a «ok» sola). */
                <div className="mt-2 grid gap-2">
                  {syncReset === "idle" && (
                    <Button size="sm" variant="outline" className="h-7 justify-start px-2 text-[11px] text-muted-foreground" disabled={syncBusy} onClick={() => void enviarCodigoSync()}>
                      {syncBusy ? t("pf.conectando") : t("pf.syncRestablecer")}
                    </Button>
                  )}
                  {syncReset === "codigo" && (
                    <>
                      <Input inputMode="numeric" autoComplete="one-time-code" className="h-8 bg-card border-border text-sm" placeholder={t("pf.syncCodigo")} value={syncCode} onChange={(e) => setSyncCode(e.target.value)} />
                      <Input type="password" autoComplete="new-password" className="h-8 bg-card border-border text-sm" placeholder={t("pf.syncNuevaPass")} value={syncPass} onChange={(e) => setSyncPass(e.target.value)} />
                      <Button size="sm" className="h-7 justify-start bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold" disabled={syncBusy || syncCode.trim().length !== 6 || syncPass.length < 8} onClick={() => void vincularConReset()}>
                        {syncBusy ? t("pf.conectando") : t("pf.syncVincular")}
                      </Button>
                    </>
                  )}
                  {syncMsg && <p className="text-[11px] text-muted-foreground">{syncMsg}</p>}
                </div>
              )}
              {sync.phase === "unlinked" && sync.linkReason === "sinPass" && (
                /* Cuenta Google sin contraseña en la nube: entrar con
                   Google la vincula al instante (linkGoogle → token). */
                <Button size="sm" variant="outline" className="mt-2 h-7 justify-start px-2 text-[11px] text-muted-foreground" disabled={busyGoogle} onClick={() => void signInGoogle()}>
                  {busyGoogle ? t("pf.conectando") : t("pf.syncEntrarGoogle")}
                </Button>
              )}
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

      {/* Cambiar contraseña (Gestionar): para quien conoce su contraseña
          actual; recuperar una perdida es «Olvidé mi contraseña». */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <p className="font-medium text-foreground">{t("pf.cambiarPassTitulo")}</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{t("pf.cambiarPassIntro")}</p>
            {cambiarPassAbierto ? (
              <div className="mt-3 grid gap-2">
                <Input type="password" autoComplete="current-password" className="bg-card border-border" placeholder={t("pf.contrasenaActual")} value={cpActual} onChange={(e) => setCpActual(e.target.value)} />
                <Input type="password" autoComplete="new-password" className="bg-card border-border" placeholder={t("pf.nuevaContrasena")} value={cpNueva} onChange={(e) => setCpNueva(e.target.value)} />
                <Input type="password" autoComplete="new-password" className="bg-card border-border" placeholder={t("pf.confirmarContrasena")} value={cpNueva2} onChange={(e) => setCpNueva2(e.target.value)} />
                {cpMsg && (
                  <p className={`text-[11.5px] ${cpOk ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`} role="status">
                    {cpMsg}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" disabled={cpBusy || cpNueva.length < 8 || cpNueva !== cpNueva2} onClick={() => void guardarCambioPass()} className="h-8 bg-emerald-600 hover:bg-emerald-500 text-(--c30-on-accent) font-bold">
                    {cpBusy ? t("pf.conectando") : t("pf.cambiarPassBoton")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setCambiarPassAbierto(false); setCpMsg(null); setCpActual(""); setCpNueva(""); setCpNueva2(""); }} className="h-8 border-border px-3 text-[12px]">
                    {t("pf.cancelar")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setCambiarPassAbierto(true)} className="mt-3 h-8 border-border px-3 text-[12px]">
                <KeyRound className="mr-1 h-3.5 w-3.5" /> {t("pf.cambiarPassBoton")}
              </Button>
            )}
          </div>
        </div>
      </Card>

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
