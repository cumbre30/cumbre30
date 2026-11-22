"use client";

// ============================================================
// Configuración (v1.12.12: rediseño por secciones con tarjetas).
// Dos secciones con el mismo diseño de chips de las demás
// categorías (SubTabs): GENERAL y ACERCA DE. General muestra
// SOLO 3 tarjetas y el resto vive DENTRO de cada una, en su
// propia subpantalla (cliente 2026-11-16: «para ordenar y que
// no sea un listado»):
//   · Seguridad → Alertas (pitidos, avisos de voz, velocidad de la
//     voz y probar voz — v1.13.15 movidas desde Personalización/Voz,
//     avisos push del parque en la web), Detección de incidentes
//     (caída, confirmación de estado) y Asistencia de emergencia (ICE).
//   · Monitoreo y salud → zonas de esfuerzo del sensor BT.
//   · Personalización → Temas y pantalla ride, Accesibilidad
//     (modo oscuro/claro) e Idioma.
// Acerca de mantiene versión, actualizaciones, contacto y la
// marca Cumbre GEO.
// La fuente Demo/GPS la decide la plataforma (web = demo, APK
// = GPS). El control "Confirmación de estado" fija la ventana
// 15/30/60 s del overlay "¿Estás bien?" (fallDetect).
// ============================================================

import { useEffect, useState } from "react";
import { Volume2, VolumeX, Mic, MicOff, Info, Mail, Moon, Palette, Lock, Languages, Siren, ShieldAlert, UserPlus, UserRound, BellRing, HeartPulse, RefreshCw, Download, ChevronRight, ArrowLeft, Gauge, Map, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Speedometer } from "@/components/Speedometer";
import { MinimapPreview } from "@/components/MinimapPreview";
import { SubTabs } from "@/components/SubTabs";
import { ThemeIconButton } from "@/components/ThemeToggle";
import { APP_VERSION, APP_VERSION_CODE } from "@/lib/appVersion";
import { fallConfigOn, setFallConfigOn, fallConfirmSegs, setFallConfirmSegs, type FallConfirmSegs } from "@/lib/fallDetect";
import { autoPausaActivada, setAutoPausaActivada } from "@/lib/motorPerfil";
import {
  ICE_MAX,
  getIceConfig,
  iceValidationError,
  removeIceContact,
  setIceAuto,
  upsertIceContact,
  type IceConfig,
} from "@/lib/iceContacts";
import { getFcConfig, saveFcConfig, type FcConfig } from "@/lib/zonasFc";
import { t, useLang, setLang, type Lang } from "@/lib/i18n";
import { isNativeApp } from "@/lib/rideNative";
import { rateActual, setRate } from "@/lib/ttsVoices";
import { alerts } from "@/lib/alertEngine";
import { revisarActualizacion, nuevaConocida, abrirDescarga, type EstadoActualizacion } from "@/lib/actualizacion";
import { recolectarDiagMapa } from "@/lib/mapaDiag";
import { serverToken } from "@/lib/cloudSync";
import { MINIMAP_SIZES, SPEEDO_SIZES, SPEEDO_STYLES, THEME_COLORS, saveRideTheme, useRideTheme, type MinimapSize, type SpeedoSize, type SpeedoStyle, type ThemeColorId, MINIMAP_STYLES, type MinimapStyle } from "@/lib/rideTheme";

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
        {sub && <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** Tarjeta clicable del menú General (entra a la subpantalla). */
function TarjetaMenu({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <Card className="p-0">
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-accent/40">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        on ? "border-emerald-500/60 bg-emerald-600/40" : "border-border bg-muted"
      }`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${
          on ? "left-6 bg-emerald-500" : "left-1 bg-muted-foreground/70"
        }`}
      />
    </button>
  );
}

/** Fila de opciones tipo segmento (con candado en las Pro). */
function Seg<T extends string>({
  options,
  value,
  pro,
  onPick,
  onLocked,
}: {
  options: { id: T; label: string; proOnly: boolean }[];
  value: T;
  pro: boolean;
  onPick: (id: T) => void;
  onLocked: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const locked = o.proOnly && !pro;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => (locked ? onLocked(o.label) : onPick(o.id))}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
              active
                ? "border-transparent bg-emerald-600 text-(--c30-on-accent)"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
            {locked && <Lock className="h-3 w-3 opacity-70" />}
          </button>
        );
      })}
    </div>
  );
}

type SeccionCfg = "general" | "acerca";
type TarjetaCfg = "menu" | "seguridad" | "salud" | "personalizacion";

export function ConfigTab({
  soundOn,
  onToggleSound,
  voiceOn,
  onToggleVoice,
  pro,
  onGoPro,
}: {
  soundOn: boolean;
  onToggleSound: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  pro: boolean;
  onGoPro: () => void;
}) {
  const theme = useRideTheme();
  const lang = useLang(); // re-render al cambiar el idioma
  const [proNote, setProNote] = useState<string | null>(null);
  // Secciones (v1.12.12): General | Acerca de, y dentro de General la
  // tarjeta activa (menu = listado de 3).
  const [seccion, setSeccion] = useState<SeccionCfg>("general");
  const [card, setCard] = useState<TarjetaCfg>("menu");
  // Subpantalla de segundo nivel (v1.12.13): General → Seguridad →
  // Alertas, etc. null = menú de subsecciones de la tarjeta.
  const [sub, setSub] = useState<string | null>(null);
  // Detección de caída: persistida en fallDetect (on por defecto).
  const [fallOn, setFallOn] = useState(fallConfigOn());
  const toggleFall = () => {
    const v = !fallOn;
    setFallOn(v);
    setFallConfigOn(v);
  };
  // Pausa automática del motor GPS (fase única 2026-11-22): perfil
  // persistido en motor/config; el ride pausa solo al detenerse y
  // reanuda al pedalear. Aplica al ride en curso también (en vivo).
  const [autoPausaOn, setAutoPausaOn] = useState(autoPausaActivada());
  const toggleAutoPausa = () => {
    const v = !autoPausaOn;
    setAutoPausaOn(v);
    setAutoPausaActivada(v);
  };
  // Confirmación de estado (v1.12.1): ventana 15/30/60 s del overlay
  // "¿Estás bien?" antes de la ayuda automática. Default 30 s.
  const [confirmSegs, setConfirmSegs] = useState<FallConfirmSegs>(() => fallConfirmSegs());
  const pickConfirm = (id: string) => {
    const v = Number(id) as FallConfirmSegs;
    setFallConfirmSegs(v);
    setConfirmSegs(v);
  };
  // v1.13.15: la velocidad de la voz y «Probar voz» viven en
  // Seguridad → Alertas (antes Personalización → Voz). La selección
  // de voz del sistema se retiró a pedido del cliente; la velocidad
  // vive en localStorage y se aplica en alerts.prefs.
  const [velVoz, setVelVoz] = useState<number>(() => rateActual());
  const pickVelVoz = (r: number) => {
    setVelVoz(r);
    setRate(r);
  };
  const probarVoz = () => {
    alerts.unlock();
    alerts.speak("cfg-probar", t("voz.prueba"), 0);
  };
  // Contactos ICE (Ola 1): persistidos en iceContacts (auto on por defecto).
  const [ice, setIce] = useState<IceConfig>(() => getIceConfig());
  const [iceName, setIceName] = useState("");
  const [icePhone, setIcePhone] = useState("");
  const [iceErr, setIceErr] = useState<string | null>(null);
  const addIce = () => {
    const err = iceValidationError(iceName, icePhone);
    if (err) {
      setIceErr(err);
      return;
    }
    setIceErr(null);
    setIce(upsertIceContact(iceName, icePhone));
    setIceName("");
    setIcePhone("");
  };
  const toggleIceAuto = () => {
    const v = !ice.auto;
    setIceAuto(v);
    setIce({ ...ice, auto: v });
  };
  // Zonas de esfuerzo (Ola 1): FC máxima y reposo para Karvonen.
  const [fcCfg, setFcCfg] = useState<FcConfig>(() => getFcConfig());
  const [fcMax, setFcMax] = useState(String(fcCfg.maxBpm));
  const [fcReposo, setFcReposo] = useState(String(fcCfg.reposoBpm));
  const [fcErr, setFcErr] = useState<string | null>(null);
  const [fcOk, setFcOk] = useState(false);
  const guardarFc = () => {
    const maxBpm = Number(fcMax);
    const reposoBpm = Number(fcReposo);
    if (!(maxBpm >= 120 && maxBpm <= 230) || !(reposoBpm >= 30 && reposoBpm <= 120) || reposoBpm >= maxBpm - 20) {
      setFcErr(t("cfg.fcErr"));
      return;
    }
    setFcErr(null);
    const saved = saveFcConfig({ maxBpm, reposoBpm });
    setFcCfg(saved);
    setFcMax(String(saved.maxBpm));
    setFcReposo(String(saved.reposoBpm));
    setFcOk(true);
    setTimeout(() => setFcOk(false), 2500);
  };

  // ---- Actualizaciones (v1.12.4): el chequeo corre en el APK ----
  const [actEstado, setActEstado] = useState<"idle" | "check" | EstadoActualizacion>("idle");
  const [actNativo, setActNativo] = useState(false);
  useEffect(() => {
    setActNativo(isNativeApp());
    const conocida = nuevaConocida();
    if (conocida) {
      setActEstado({ estado: "nueva", versionNueva: conocida.version, urlDescarga: conocida.url });
    }
  }, []);
  const revisarAhora = () => {
    setActEstado("check");
    void revisarActualizacion().then(setActEstado);
  };

  const locked = (what: string) => setProNote(t("cfg.proNota", what));
  const pick = <T extends string>(old: T, id: T, fn: (v: T) => void) => {
    if (id !== old) fn(id);
    setProNote(null);
  };

  // ---- Web Push del parque (Ola 2): avisos del navegador en la web ----
  const [pushEstado, setPushEstado] = useState<"cargando" | "activado" | "apagado" | "denegado" | "nativo">("cargando");
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    const revisar = async () => {
      if (isNativeApp()) {
        setPushEstado("nativo");
        return;
      }
      if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushEstado("apagado");
        return;
      }
      if (Notification.permission === "denied") {
        setPushEstado("denegado");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setPushEstado(sub ? "activado" : "apagado");
      } catch {
        setPushEstado("apagado");
      }
    };
    void revisar();
  }, []);

  const activarPush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      const rpk = await fetch("/api/push/publickey");
      if (!rpk.ok) {
        setPushMsg(t("cfg.pushNoCfg"));
        return;
      }
      const { publicKey } = (await rpk.json()) as { publicKey: string };
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setPushEstado("denegado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const u8a = new Uint8Array(publicKey.replace(/-/g, "+").replace(/_/g, "/").match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8a as BufferSource });
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const tok = serverToken();
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const rs = await fetch("/api/push/subscribe", {
        method: "POST",
        headers,
        body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
      });
      if (!rs.ok) throw new Error();
      setPushEstado("activado");
    } catch {
      setPushMsg(t("cfg.pushErr"));
    } finally {
      setPushBusy(false);
    }
  };

  const desactivarPush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
        await sub.unsubscribe();
      }
      setPushEstado("apagado");
    } catch {
      setPushMsg(t("cfg.pushErr"));
    } finally {
      setPushBusy(false);
    }
  };

  const probarPush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      const headers: Record<string, string> = {};
      const tok = serverToken();
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const r = await fetch("/api/push/test", { method: "POST", headers });
      if (r.status === 401) setPushMsg(t("cfg.pushSesion"));
      else if (!r.ok) setPushMsg(t("cfg.pushNoCfg"));
      else setPushMsg(t("cfg.pushEnviada"));
    } catch {
      setPushMsg(t("cfg.pushErr"));
    } finally {
      setPushBusy(false);
    }
  };

  // Encabezado de subpantalla: botón Volver + título. En nivel 3 (una
  // subsección abierta) vuelve al menú de la tarjeta; en nivel 2 vuelve
  // a General. El botón se llama «Volver» (pedido del cliente).
  const headerSub = (titulo: string) => (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => (sub ? setSub(null) : setCard("menu"))}
        aria-label={t("cfg.volver")}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("cfg.volver")}
      </button>
      <p className="text-[13px] font-extrabold text-foreground">{titulo}</p>
    </div>
  );

  // ---- Contenido por tarjeta (se renderiza en su subpantalla) ----

  // SEGURIDAD: subpantallas (v1.12.13). Nivel 2 = menú de subsecciones;
  // nivel 3 = Alertas (pitidos de velocidad + avisos de voz + aviso
  // orientativo), Detección de incidentes, Emergencia (ICE) y Avisos
  // push del parque (solo web; el APK usa notificaciones nativas).
  const SUBS_SEGURIDAD = [
    { id: "alertas", icon: <Volume2 className="h-5 w-5" />, titulo: t("cfg.grAlertas"), sub: t("cfg.subAlertas") },
    { id: "deteccion", icon: <Siren className="h-5 w-5" />, titulo: t("cfg.grDeteccion"), sub: t("cfg.subDeteccion") },
    { id: "emergencia", icon: <UserPlus className="h-5 w-5" />, titulo: t("cfg.grEmergencia"), sub: t("cfg.subEmergencia") },
    ...(pushEstado !== "nativo"
      ? [{ id: "push", icon: <BellRing className="h-5 w-5" />, titulo: t("cfg.push"), sub: t("cfg.subPush") }]
      : []),
  ];

  const seguridadBody = (id: string) => {
    switch (id) {
      case "alertas":
        return (
          <Card className="p-0">
            <Row icon={soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} title={t("cfg.pitidos")} sub={t("cfg.pitidosSub")}>
              <Toggle on={soundOn} onChange={onToggleSound} label={t("cfg.pitidos")} />
            </Row>
            <Row icon={voiceOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />} title={t("cfg.avisosVoz")} sub={t("cfg.avisosVozSub")}>
              <Toggle on={voiceOn} onChange={onToggleVoice} label={t("cfg.avisosVoz")} />
            </Row>
            {/* Mensaje de responsabilidad (requerimiento de cumplimiento,
                2026-11-16): texto oficial exigido para las alertas geográficas. */}
            <Row icon={<Info className="h-5 w-5" />} title={t("cfg.disclaimerTitulo")} sub={t("cfg.disclaimerTexto")}>
              <span />
            </Row>
            {/* v1.13.15: velocidad de la voz + probar voz (antes
                Personalización → Voz, retirada por el cliente). Afecta a
                TODAS las alertas habladas (avisos de voz, navegación). */}
            <div className="border-b border-border/60 px-4 pb-3.5 pt-2">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.vozVel")}</p>
              <div className="mt-2.5">
                <Seg
                  options={[
                    { id: "0.9", label: t("cfg.vozLenta"), proOnly: false },
                    { id: "1.05", label: t("cfg.vozNormal"), proOnly: false },
                    { id: "1.2", label: t("cfg.vozRapida"), proOnly: false },
                  ]}
                  value={String(velVoz)}
                  pro={true}
                  onPick={(v) => pickVelVoz(parseFloat(v))}
                  onLocked={() => undefined}
                />
              </div>
            </div>
            <div className="px-4 py-3.5">
              <button onClick={probarVoz} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold active:bg-muted">
                <Volume2 className="h-4 w-4" />
                {t("cfg.vozProbar")}
              </button>
            </div>
          </Card>
        );
      case "deteccion":
        return (
          <Card className="p-0">
            <Row icon={<Siren className="h-5 w-5" />} title={t("cfg.caida")} sub={t("cfg.caidaSub")}>
              <Toggle on={fallOn} onChange={toggleFall} label={t("cfg.caida")} />
            </Row>
            <Row icon={<Timer className="h-5 w-5" />} title={t("cfg.autoPausa")} sub={t("cfg.autoPausaSub")}>
              <Toggle on={autoPausaOn} onChange={toggleAutoPausa} label={t("cfg.autoPausa")} />
            </Row>
            <Row icon={<ShieldAlert className="h-5 w-5" />} title={t("cfg.confirmEstado")} sub={t("cfg.confirmEstadoSub")}>
              <span />
            </Row>
            <div className="border-b border-border/60 px-4 pb-3.5 pt-2">
              <Seg
                options={[
                  { id: "15", label: "15 s", proOnly: false },
                  { id: "30", label: "30 s", proOnly: false },
                  { id: "60", label: "60 s", proOnly: false },
                ]}
                value={String(confirmSegs)}
                pro={true}
                onPick={pickConfirm}
                onLocked={() => undefined}
              />
            </div>
            {/* B-02: alcance real de la detección, siempre visible. */}
            <div className="px-4 py-3.5">
              <p className="text-[11.5px] leading-snug text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {t("cfg.caidaLimites")}
              </p>
            </div>
          </Card>
        );
      case "emergencia":
        return (
          <Card className="p-0">
            <Row icon={<UserPlus className="h-5 w-5" />} title={t("cfg.ice")} sub={t("cfg.iceSub")}>
              <span />
            </Row>
            <div className="border-b border-border/60 px-4 py-3.5">
              <div className="flex flex-col gap-1.5">
                {ice.contacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2">
                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.phone}</p>
                    </div>
                    <button
                      onClick={() => setIce(removeIceContact(c.id))}
                      aria-label={`${t("cfg.iceQuitar")} ${c.name}`}
                      className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-red-500"
                    >
                      {t("cfg.iceQuitar")}
                    </button>
                  </div>
                ))}
                {ice.contacts.length === 0 && (
                  <p className="text-[11.5px] leading-snug text-muted-foreground">{t("cfg.iceEmpty", ICE_MAX)}</p>
                )}
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <input
                  value={iceName}
                  onChange={(e) => setIceName(e.target.value)}
                  placeholder={t("cfg.iceNombre")}
                  maxLength={40}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500"
                />
                <input
                  value={icePhone}
                  onChange={(e) => setIcePhone(e.target.value)}
                  placeholder={t("cfg.iceTelefono")}
                  maxLength={24}
                  inputMode="tel"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-emerald-500"
                />
                <button
                  onClick={addIce}
                  disabled={!iceName.trim() || !icePhone.trim()}
                  className="h-9 rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {t("cfg.iceAgregar")}
                </button>
                {iceErr && (
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">{iceErr}</p>
                )}
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">{t("cfg.iceNota")}</p>
            </div>
            <Row icon={<BellRing className="h-5 w-5" />} title={t("cfg.iceAuto")} sub={t("cfg.iceAutoSub")}>
              <Toggle on={ice.auto} onChange={toggleIceAuto} label={t("cfg.iceAuto")} />
            </Row>
          </Card>
        );
      case "push":
        return (
          <Card className="p-0">
            <Row icon={<BellRing className="h-5 w-5" />} title={t("cfg.push")} sub={t("cfg.pushSub")}>
              <span />
            </Row>
            <div className="px-4 pb-4">
              {pushEstado === "activado" && (
                <p className="mb-2 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300">{t("cfg.pushActivado")}</p>
              )}
              {pushEstado === "denegado" && (
                <p className="mb-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">{t("cfg.pushDenegado")}</p>
              )}
              {pushMsg && (
                <p className="mb-2 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300" role="status">{pushMsg}</p>
              )}
              <div className="flex gap-2">
                {pushEstado === "activado" ? (
                  <>
                    <button
                      onClick={() => void desactivarPush()}
                      disabled={pushBusy}
                      className="h-9 flex-1 rounded-lg border border-border bg-card text-[12px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {t("cfg.pushDesactivar")}
                    </button>
                    <button
                      onClick={() => void probarPush()}
                      disabled={pushBusy}
                      className="h-9 flex-1 rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {t("cfg.pushProbar")}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => void activarPush()}
                    disabled={pushBusy || pushEstado === "denegado"}
                    className="h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {t("cfg.pushActivar")}
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  const menuSeguridad = (
    <>
      {SUBS_SEGURIDAD.map((s2) => (
        <TarjetaMenu key={s2.id} icon={s2.icon} title={s2.titulo} sub={s2.sub} onClick={() => setSub(s2.id)} />
      ))}
    </>
  );

  // MONITOREO Y SALUD: subpantalla de zonas de esfuerzo (FC del
  // sensor BT, fórmula de Karvonen).
  const menuSalud = (
    <TarjetaMenu icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.fc")} sub={t("cfg.subMonitoreo")} onClick={() => setSub("fc")} />
  );

  const saludBody = (id: string) =>
    id === "fc" ? (
      <Card className="p-0">
        <Row icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.fc")} sub={t("cfg.fcSub")}>
          <span />
        </Row>
        <div className="px-4 py-3.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">{t("cfg.fcMax")}</span>
              <input
                value={fcMax}
                onChange={(e) => setFcMax(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="190"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted-foreground">{t("cfg.fcReposo")}</span>
              <input
                value={fcReposo}
                onChange={(e) => setFcReposo(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="60"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          <button
            onClick={guardarFc}
            disabled={fcErr !== null}
            className="mt-2.5 h-9 w-full rounded-lg bg-emerald-600 text-[12px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {fcOk ? t("cfg.fcOk") : t("cfg.fcGuardar")}
          </button>
          {fcErr && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">{fcErr}</p>
          )}
        </div>
      </Card>
    ) : null;

  // PERSONALIZACIÓN: subpantallas (v1.12.13): Apariencia (temas y
  // color), Velocímetro (estilo, tamaño, vista previa), Minimapa,
  // Accesibilidad (claro/oscuro) e Idioma. La voz se retiró en
  // v1.13.15 (velocidad y probar voz pasaron a Seguridad → Alertas).
  const SUBS_PERSO = [
    { id: "apariencia", icon: <Palette className="h-5 w-5" />, titulo: t("cfg.grTemas"), sub: t("cfg.subApariencia") },
    { id: "velocimetro", icon: <Gauge className="h-5 w-5" />, titulo: t("cfg.velocimetro"), sub: t("cfg.subVelocimetro") },
    { id: "minimapa", icon: <Map className="h-5 w-5" />, titulo: t("cfg.minimapa"), sub: t("cfg.subMinimapa") },
    { id: "accesibilidad", icon: <Moon className="h-5 w-5" />, titulo: t("cfg.grAccesibilidad"), sub: t("cfg.temaSub") },
    { id: "idioma", icon: <Languages className="h-5 w-5" />, titulo: t("cfg.grIdioma"), sub: t("cfg.idiomaSub") },
  ];

  const persoBody = (id: string) => {
    switch (id) {
      case "apariencia":
        return (
          <Card className="p-0">
            <Row
              icon={<Palette className="h-5 w-5" />}
              title={t("cfg.temas")}
              sub={t("cfg.temasSub")}
            >
              <span />
            </Row>
            <div className="border-b border-border/60 px-4 py-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.colorApp")}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {THEME_COLORS.map((c) => {
                  const isLocked = c.proOnly && !pro;
                  const active = theme.color === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => (isLocked ? locked(`El tema ${c.label}`) : pick(theme.color, c.id, (v: ThemeColorId) => saveRideTheme({ color: v })))}
                      aria-pressed={active}
                      aria-label={`Tema ${c.label}${isLocked ? " (Pro)" : ""}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                        active ? "border-emerald-500/70 bg-emerald-600/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/20" style={{ background: c.swatch }} aria-hidden />
                      {c.label}
                      {isLocked && <Lock className="h-3 w-3 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      case "velocimetro":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <div className="flex flex-col gap-2.5">
                <Seg
                  options={SPEEDO_STYLES}
                  value={theme.speedoStyle}
                  pro={pro}
                  onPick={(v: SpeedoStyle) => pick(theme.speedoStyle, v, (x) => saveRideTheme({ speedoStyle: x }))}
                  onLocked={(label) => locked(t("cfg.lockVelocimetro", label.toLowerCase()))}
                />
                <Seg
                  options={SPEEDO_SIZES}
                  value={theme.speedoSize}
                  pro={pro}
                  onPick={(v: SpeedoSize) => pick(theme.speedoSize, v, (x) => saveRideTheme({ speedoSize: x }))}
                  onLocked={(label) => locked(t("cfg.lockTamano", label.toLowerCase()))}
                />
              </div>
              {/* Vista previa con 27 km/h (cerca del límite del parque) */}
              <div className="mt-3 rounded-xl border border-border/70 bg-background/50 px-3 py-3">
                <Speedometer speedKmh={27} idle={false} over={false} caution={true} inPark={true} style={theme.speedoStyle} size={theme.speedoSize} />
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">{t("cfg.vistaPrevia")}</p>
              </div>
            </div>
          </Card>
        );
      case "minimapa":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.estiloMinimapa")}</p>
              <div className="mt-2.5">
                <Seg
                  options={MINIMAP_STYLES}
                  value={theme.minimapStyle}
                  pro={pro}
                  onPick={(v: MinimapStyle) => pick(theme.minimapStyle, v, (x) => saveRideTheme({ minimapStyle: x }))}
                  onLocked={(label) => locked(t("cfg.lockEstiloMinimapa", label.toLowerCase()))}
                />
              </div>
              <p className="mt-3 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("cfg.tamanoMinimapa")}</p>
              <div className="mt-2.5">
              <Seg
                options={MINIMAP_SIZES}
                value={theme.minimapSize}
                pro={pro}
                onPick={(v: MinimapSize) => pick(theme.minimapSize, v, (x) => saveRideTheme({ minimapSize: x }))}
                onLocked={(label) => locked(`El minimapa ${label.toLowerCase()}`)}
              />
              </div>
              {/* Vista previa: el mismo motor MapLibre del minimapa
                  real (base CyclOSM) con el marco y tamaño elegidos */}
              <div className="mt-3 rounded-xl border border-border/70 bg-background/50 p-3">
                <MinimapPreview style={theme.minimapStyle} size={theme.minimapSize} />
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">{t("cfg.vistaPreviaMini")}</p>
              </div>
            </div>
          </Card>
        );
      case "accesibilidad":
        return (
          <Card className="p-0">
            <Row icon={<Moon className="h-5 w-5" />} title={t("cfg.tema")} sub={t("cfg.temaSub")}>
              <ThemeIconButton />
            </Row>
          </Card>
        );
      case "idioma":
        return (
          <Card className="p-0">
            <div className="px-4 py-3.5">
              <p className="text-[13.5px] font-semibold text-foreground">{t("cfg.idioma")}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t("cfg.idiomaSub")}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(["es", "en", "pt"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      lang === l
                        ? "border-transparent bg-emerald-600 text-(--c30-on-accent)"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l === "es" ? t("cfg.esp") : l === "en" ? t("cfg.eng") : t("cfg.port")}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        );
      default:
        return null;
    }
  };

  const menuPerso = (
    <>
      {SUBS_PERSO.map((s2) => (
        <TarjetaMenu key={s2.id} icon={s2.icon} title={s2.titulo} sub={s2.sub} onClick={() => setSub(s2.id)} />
      ))}
    </>
  );

  // ACERCA DE: versión, actualizaciones, contacto y marca Cumbre GEO
  // Diagnóstico de mapas (v1.13.5): GPU/WebGL que reporta el WebView,
  // visible desde Acerca de. Con una captura sabemos qué soporta de
  // verdad el teléfono antes de volver a intentar el render nativo.
  const [verDiag, setVerDiag] = useState(false);
  const diag = verDiag ? recolectarDiagMapa() : null;
  const acercaCard = (
    <Card className="p-0">
      <Row
        icon={<Info className="h-5 w-5" />}
        title="Cumbre30"
        sub={t("cfg.acercaSub", APP_VERSION, APP_VERSION_CODE)}
      >
        <span className="shrink-0 rounded bg-emerald-600/15 px-2 py-1 text-[10px] font-extrabold tracking-widest text-emerald-700 dark:text-emerald-300">
          v{APP_VERSION}
        </span>
      </Row>
      {/* Revisar actualizaciones (v1.12.4): compara la versión del
          APK con la última publicada en la web y ofrece descargar. */}
      {actNativo && (
        <Row icon={<RefreshCw className="h-5 w-5" />} title={t("act.titulo")} sub={t("act.sub")}>
          <button
            onClick={revisarAhora}
            disabled={actEstado === "check"}
            className="h-9 shrink-0 rounded-lg border border-border bg-card px-3 text-[12px] font-bold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {actEstado === "check" ? t("act.revisando") : t("act.btn")}
          </button>
        </Row>
      )}
      {actEstado !== "idle" && actEstado !== "check" && actEstado.estado === "nueva" && (
        <Row
          icon={<Download className="h-5 w-5" />}
          title={t("act.descargaTitulo", actEstado.versionNueva || "")}
          sub={t("act.descargaSub")}
        >
          <button
            onClick={() => abrirDescarga(actEstado.urlDescarga || "")}
            className="h-9 shrink-0 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-500"
          >
            {t("act.descargar")}
          </button>
        </Row>
      )}
      {actEstado !== "idle" && actEstado !== "check" && actEstado.estado === "al-dia" && (
        <p className="border-t border-border/60 px-4 py-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          ✓ {t("act.alDia", `v${APP_VERSION}`)}
        </p>
      )}
      {actEstado !== "idle" && actEstado !== "check" && actEstado.estado === "error" && (
        <p className="border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">{t("act.error")}</p>
      )}
      {/* Diagnóstico de mapas (v1.13.5): el nativo quedó dormido tras
          v1.13.2-v1.13.4 (negro en dispositivo con Vulkan y con GL ES).
          Estos datos dicen qué GPU soporta de verdad este equipo. */}
      <Row icon={<Map className="h-5 w-5" />} title={t("cfg.diag")} sub={t("cfg.diagSub")}>
        <button
          onClick={() => setVerDiag((v) => !v)}
          className="h-9 shrink-0 rounded-lg border border-border bg-card px-3 text-[12px] font-bold text-foreground hover:bg-accent"
        >
          {verDiag ? t("cfg.diagOcultar") : t("cfg.diagVer")}
        </button>
      </Row>
      {diag && (
        <div className="mx-4 mb-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <span className="font-bold text-foreground">{diag.android}</span> · WebView {diag.webview}
          </p>
          <p>
            WebGL1: {diag.webgl1 ? "sí" : "NO"} · WebGL2: {diag.webgl2 ? "sí" : "NO"}
          </p>
          <p className="break-words">GPU: {diag.gpu}</p>
          <p>Motor de mapas: {diag.motorMapas}</p>
          <p className="opacity-70">{diag.cuando}</p>
        </div>
      )}
      <Row icon={<Mail className="h-5 w-5" />} title={t("cfg.contacto")} sub={t("cfg.contactoSub")}>
        <span />
      </Row>
      <Row
        icon={<span className="text-base font-black tracking-tight text-foreground">CG</span>}
        title={t("cfg.cgeo")}
        sub={t("cfg.cgeoSub")}
      >
        <span />
      </Row>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Secciones con el mismo diseño de chips de las demás categorías */}
      <SubTabs
        tabs={[
          { key: "general", label: t("cfg.grGeneral") },
          { key: "acerca", label: t("cfg.grAcerca") },
        ]}
        value={seccion}
        onChange={(k) => {
          setSeccion(k as SeccionCfg);
          setCard("menu");
          setSub(null);
        }}
        ariaLabel={t("menu.config")}
      />

      {seccion === "general" && card === "menu" && (
        <>
          <TarjetaMenu icon={<Siren className="h-5 w-5" />} title={t("cfg.grSeguridad")} sub={t("cfg.subSeguridad")} onClick={() => { setCard("seguridad"); setSub(null); }} />
          <TarjetaMenu icon={<HeartPulse className="h-5 w-5" />} title={t("cfg.grSalud")} sub={t("cfg.subSalud")} onClick={() => { setCard("salud"); setSub(null); }} />
          <TarjetaMenu icon={<Palette className="h-5 w-5" />} title={t("cfg.grPersonalizacion")} sub={t("cfg.subPersonalizacion")} onClick={() => { setCard("personalizacion"); setSub(null); }} />
        </>
      )}

      {seccion === "general" && card === "seguridad" && (
        <>
          {headerSub(sub ? SUBS_SEGURIDAD.find((x) => x.id === sub)?.titulo ?? t("cfg.grSeguridad") : t("cfg.grSeguridad"))}
          {sub ? seguridadBody(sub) : menuSeguridad}
        </>
      )}

      {seccion === "general" && card === "salud" && (
        <>
          {headerSub(sub ? t("cfg.fc") : t("cfg.grSalud"))}
          {sub ? saludBody(sub) : menuSalud}
        </>
      )}

      {seccion === "general" && card === "personalizacion" && (
        <>
          {headerSub(sub ? SUBS_PERSO.find((x) => x.id === sub)?.titulo ?? t("cfg.grPersonalizacion") : t("cfg.grPersonalizacion"))}
          {sub ? persoBody(sub) : menuPerso}
          {proNote && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{proNote}</span>
              <button onClick={onGoPro} className="shrink-0 font-extrabold underline underline-offset-2">
                {t("cfg.verPlanes")}
              </button>
            </div>
          )}
          {!pro && !proNote && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("cfg.proFoot")}
            </p>
          )}
        </>
      )}

      {seccion === "acerca" && acercaCard}
    </div>
  );
}
