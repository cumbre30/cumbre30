"use client";

// ============================================================
// Cumbre30 - arquitectura de navegación del rediseño (brief §1):
//   · Bottom nav con 4 destinos: Ride · Explorar · Acceso · Perfil
//     (el QR se usa en la portada: siempre a un toque; «Perfil» es
//     el Perfil Ciclista desde v1.13.16 - la pantalla de datos y
//     pagos se llama «Cuenta» y vive en el menú lateral).
//   · Menú lateral con 4 zonas: CUMBRE30 PRO · Mi actividad ·
//     Cuenta · Plan actual.
//   · Header compacto: marca + estado GPS + plan + menú.
//   · El control Demo/GPS, pitidos y voz viven en Configuración.
// Todo lo que ya funcionaba se conserva: motor de ride, navegación
// (computeRoute), historial, QR, premios, licencia Pro.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Bike, Map as MapIcon, QrCode } from "lucide-react";
import { RideView } from "@/components/RideView";
import { HistoryTab } from "@/components/HistoryTab";
import { VehicleConfirmModal } from "@/components/VehicleConfirmModal";
import PopupReglaRuta from "@/components/PopupReglaRuta";
import { AppDrawer, type MenuScreen } from "@/components/AppDrawer";
import { BannerPedalea } from "@/components/BannerPedalea";
import { PlanPill, ProContextModal } from "@/components/ProUI";
import { PlanesTab } from "@/components/PlanesTab";
import { StatsTab } from "@/components/StatsTab";
import { ConfigTab } from "@/components/ConfigTab";
import { HelpTab } from "@/components/HelpTab";
import { FallOverlay } from "@/components/FallOverlay";
import { useRideEngine, type Source } from "@/hooks/useRideEngine";
import { useMe } from "@/hooks/useMe";
import { useNavEngine } from "@/hooks/useNavEngine";
import { useProLicense } from "@/lib/proLicense";
import { applyThemeColor, useRideTheme } from "@/lib/rideTheme";
import { linkRidesToAccount, setRideOwner } from "@/lib/history";
import { runMetricBackfill } from "@/lib/rideBackfill";
import { courseHeading } from "@/lib/geo";
import { createSmoother, snapToNet, snapToRoute } from "@/lib/navSnap";
import { loadNetwork, routeProgress, type LatLng, type Network } from "@/lib/routing";
import { alerts } from "@/lib/alertEngine";
import { programarAvisoHorario } from "@/lib/notificaciones";
import { autoCheckAlAbrir, registrarToqueActualizacion } from "@/lib/actualizacion";
import { t, useLang } from "@/lib/i18n";
import type { ProLockFeature } from "@/lib/planData";

/** Pantalla de carga de las secciones con import dinámico (i18n-aware). */
function Loading({ k, className }: { k: string; className: string }) {
  useLang();
  return (
    <div className={`${className} text-sm text-muted-foreground`}>
      {t(k)}
    </div>
  );
}

const Wallet = dynamic(() => import("@/components/Wallet"), {
  ssr: false,
  loading: () => (
    <Loading
      k="pg.cargandoBilletera"
      className="h-40 rounded-xl border border-border bg-card flex items-center justify-center"
    />
  ),
});

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <Loading
      k="pg.cargandoMapa"
      className="h-full min-h-[420px] bg-card flex items-center justify-center"
    />
  ),
});

const ProfileTab = dynamic(() => import("@/components/ProfileTab"), {
  ssr: false,
  loading: () => (
    <Loading
      k="pg.cargandoPerfil"
      className="h-40 rounded-xl border border-border bg-card flex items-center justify-center"
    />
  ),
});

const PerfilTab = dynamic(() => import("@/components/PerfilTab").then((m) => ({ default: m.PerfilTab })), {
  ssr: false,
  loading: () => (
    <Loading
      k="pg.cargandoCiclista"
      className="h-40 rounded-xl border border-border bg-card flex items-center justify-center"
    />
  ),
});

/** Destinos de la barra inferior (los 4 del brief + Perfil Ciclista). */
type TabScreen = "ride" | "explorar" | "acceso" | "ciclista";
/** Sub-pantallas accesibles desde el menú lateral. */
type SubScreen = MenuScreen; // historial | stats | perfil | config | ayuda | planes
type Screen = TabScreen | SubScreen;

/** Claves i18n de las sub-pantallas del menú lateral. */
const SUB_KEYS: Record<SubScreen, string> = {
  historial: "menu.historial",
  stats: "menu.stats",
  perfil: "menu.perfil",
  config: "menu.config",
  ayuda: "menu.ayuda",
  planes: "menu.planes",
};
// "premios" y "amigos" ya no son pantallas (v1.14.0): son secciones del
// Perfil Ciclista (screen "ciclista"), unificadas según el brief. 

function GpsChip({ status, simRunning }: { status: string; simRunning: boolean }) {
  useLang(); // re-render al cambiar el idioma
  if (simRunning) {
    return (
      <span className="rounded-full border border-emerald-700 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-medium" role="status">
        {t("gps.demo")}
      </span>
    );
  }
  const map: Record<string, { text: string; cls: string }> = {
    idle: { text: t("gps.idle"), cls: "border-border text-muted-foreground" },
    requesting: { text: t("gps.buscar"), cls: "border-amber-700 text-amber-700 dark:text-amber-300 animate-pulse" },
    active: { text: t("gps.activo"), cls: "border-emerald-700 text-emerald-700 dark:text-emerald-300" },
    denied: { text: t("gps.denegado"), cls: "border-red-700 text-red-700 dark:text-red-300" },
    error: { text: t("gps.error"), cls: "border-red-700 text-red-700 dark:text-red-300" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.cls}`} role="status">
      {s.text}
    </span>
  );
}

export default function Home() {
  useLang(); // re-render de header/nav al cambiar el idioma
  const ride = useRideEngine();
  const { me } = useMe();
  const { pro } = useProLicense();
  const [screen, setScreen] = useState<Screen>("ride");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [proLock, setProLock] = useState<ProLockFeature | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);
  // Separación web/APK (v1.11.0): el APK es el producto GPS - el demo se
  // prueba en vivo en la web (botón "Probar demo" del modal en /geo) y la
  // web corre el demo por defecto. Escape hatch de desarrollo: ?gps=1.
  const [source] = useState<Source>(() => {
    if (process.env.NEXT_PUBLIC_STATIC === "1") return "gps";
    try {
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("gps")) {
        return "gps";
      }
    } catch {
      // sin window: default
    }
    return "sim";
  });

  const status = ride.status; // idle | running | paused
  const active = status !== "idle"; // el ride (o su pausa) está en curso
  // Tema Pro de color: remapea el acento por CSS (html[data-accent]).
  const rideTheme = useRideTheme();
  useEffect(() => {
    applyThemeColor(rideTheme.color);
  }, [rideTheme.color]);
  // Notificaciones locales (Ola 1, APK): re-programa el aviso de luces
  // y el de cierre del parque cada vez que se abre la app.
  useEffect(() => {
    void programarAvisoHorario();
    // Actualizaciones (v1.12.4, APK): chequeo al abrir (a lo más una
    // vez al día) y tocar la notificación abre la descarga.
    registrarToqueActualizacion();
    void autoCheckAlAbrir();
  }, []);
  // Invitación de amigo (Ola 2): /geo?agregar=usuario abre el Perfil
  // Ciclista en su sección Amigos con el nombre prellenado (después del
  // montaje, sin romper la hidratación).
  const [invitado, setInvitado] = useState<string | null>(null);
  useEffect(() => {
    const quien = new URLSearchParams(window.location.search).get("agregar");
    if (quien) {
      setInvitado(quien);
      setScreen("ciclista");
    }
  }, []);
  // Enlace viaje ↔ cuenta: rides nuevos y antiguos quedan asociados al
  // correo de la sesión; sin correo son locales del dispositivo.
  const userEmail = me?.user.email ?? null;
  useEffect(() => {
    setRideOwner(userEmail);
    if (userEmail) linkRidesToAccount(userEmail);
  }, [userEmail]);
  // Backfill del Perfil Ciclista (v1.13.17): rides sin métricas derivadas
  // se recalculan desde su pista local (IndexedDB) y suben. Una vez por
  // apertura, en segundo plano a los 12 s para no competir con el arranque
  // ni con el GPS; web y APK comparten este punto de entrada.
  const backfillRef = useRef(false);
  useEffect(() => {
    if (!userEmail || backfillRef.current) return;
    backfillRef.current = true;
    const id = setTimeout(() => {
      void runMetricBackfill(userEmail).catch(() => undefined);
    }, 12_000);
    return () => clearTimeout(id);
  }, [userEmail]);
  // Navegación compartida: velocímetro (minimapa) + mapa grande.
  // Sigue viva también en pausa: revisar la ruta no requiere ride activo.
  const nav = useNavEngine(ride.position, active);
  // Rumbo (v1.12.8): course nativo del GPS (Doppler con avance ≥4 km/h) con
  // respaldo en el curso derivado del recorrido (≥3 m de avance); detenido
  // ambos dan null y la cámara conserva la última orientación válida.
  const heading = useMemo(
    () => (ride.course !== null && ride.course !== undefined ? ride.course : courseHeading(ride.track)),
    [ride.course, ride.track]
  );

  // Pin de PANTALLA sobre la calzada (v1.12.8): filtro anti-saltos de GPS +
  // snapping a la ruta activa (ventana alrededor del vértice más cercano) o
  // a la vía más cercana del grafo. SOLO cambia lo que se dibuja en el
  // minimapa: el recorrido grabado y las estadísticas siguen del fix crudo.
  const smootherRef = useRef(createSmoother());
  const lastOkRef = useRef<LatLng | null>(null);
  const [netSnap, setNetSnap] = useState<Network | null>(null);
  const hasFix = ride.position !== null;
  useEffect(() => {
    if (!hasFix || netSnap) return;
    let alive = true;
    void loadNetwork().then((n) => {
      if (alive) setNetSnap(n);
    });
    return () => {
      alive = false;
    };
  }, [hasFix, netSnap]);

  const posDisplay = useMemo<LatLng | null>(() => {
    const raw = ride.position;
    if (!raw) return null;
    const ok = smootherRef.current(raw, ride.speedKmh ?? 0, ride.accuracyM);
    if (ok) lastOkRef.current = ok;
    const base = lastOkRef.current ?? raw;
    let snapped: LatLng | null = null;
    if (nav.route && nav.route.coords.length > 1) {
      const prog = routeProgress(nav.route, base);
      snapped = snapToRoute(nav.route, prog.nearestIdx, base);
    }
    if (!snapped && netSnap) snapped = snapToNet(netSnap, base);
    return snapped ?? base;
  }, [ride.position, ride.speedKmh, ride.accuracyM, nav.route, netSnap]);

  const toggleSound = () => {
    const v = !soundOn;
    setSoundOn(v);
    alerts.prefs.soundEnabled = v;
    if (v) alerts.unlock();
  };
  const toggleVoice = () => {
    const v = !voiceOn;
    setVoiceOn(v);
    alerts.prefs.enabled = v;
  };

  const startRide = () => {
    ride.start(source);
    setScreen("ride");
  };
  const finishRide = () => {
    ride.stop();
    setHistoryKey((k) => k + 1);
  };

  const go = (s: Screen) => {
    setScreen(s);
    setDrawerOpen(false);
  };

  const mapProps = useMemo(
    () => ({
      track: ride.track,
      position: ride.position,
      accuracyM: ride.accuracyM,
      heading,
      userPin: me?.user.selectedPin,
      route: nav.route,
      dest: nav.dest,
    }),
    [ride.track, ride.position, ride.accuracyM, heading, me?.user.selectedPin, nav.route, nav.dest]
  );

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* A-04: aviso del plan Pedalea Seguro (cierre con fecha). */}
      <BannerPedalea />
      {/* Header compacto (brief §2.1): marca · GPS · plan · menú */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Bike className="h-5 w-5 text-(--c30-on-accent)" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold leading-tight tracking-tight">
              Cumbre<span className="text-emerald-600 dark:text-emerald-400">30</span>
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{t("nav.subtitle")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <GpsChip status={ride.gpsStatus} simRunning={status === "running" && ride.source === "sim"} />
            <PlanPill pro={pro.active} onClick={() => go("planes")} />
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={t("nav.abrirMenu")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido: Explorar va a pantalla completa (el mapa llena la
          vista y lo demás flota encima); el resto mantiene su Layout. */}
      <main
        className={
          screen === "explorar"
            ? "flex min-h-0 flex-1 flex-col w-full max-w-md mx-auto overflow-hidden"
            : "flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-28"
        }
      >
        {screen === "ride" && (
          <RideView
            speedKmh={ride.speedKmh}
            maxKmh={ride.maxKmh}
            avgKmh={ride.avgKmh}
            distanceKm={ride.distanceKm}
            elapsedSec={ride.elapsedSec}
            gainM={ride.gainM}
            slopePct={ride.slopePct}
            insidePark={ride.insidePark}
            speedState={ride.speedState}
            overLimitSec={ride.overLimitSec}
            maxInParkKmh={ride.maxInParkKmh}
            accuracyM={ride.accuracyM}
            events={ride.events}
            status={status}
            source={source}
            position={ride.position}
            posDisplay={posDisplay}
            track={ride.track}
            heading={heading}
            userPin={me?.user.selectedPin}
            nav={nav}
            onOpenMap={() => go("explorar")}
            onStart={startRide}
            onPause={ride.pause}
            onResume={ride.resume}
            onFinish={finishRide}
          />
        )}

        {screen === "explorar" && (
          <MapView
            {...mapProps}
            navLoading={nav.loading}
            navNote={nav.note}
            onSetDest={nav.setDestination}
            onProLocked={(f) => setProLock(f)}
          />
        )}

        {screen === "acceso" && <Wallet />}

        {/* Perfil Ciclista (v1.13.16): 4ª pestaña. Sin sesión muestra la
            invitación a Cuenta - el perfil no se inventa datos. */}
        {screen === "ciclista" && (
          <PerfilTab
            onGoCuenta={() => go("perfil")}
            onGoPro={() => go("planes")} // desafíos Pro → comparación FREE/PRO
            invitado={invitado}
          />
        )}

        {screen !== "ride" && screen !== "explorar" && screen !== "acceso" && screen !== "ciclista" && (
          <section aria-label={t(SUB_KEYS[screen])}>
            <h2 className="mb-3 text-xl font-bold tracking-tight text-foreground">{t(SUB_KEYS[screen])}</h2>
            {screen === "planes" && <PlanesTab />}
            {screen === "historial" && (
              <HistoryTab
                refreshKey={historyKey}
                user={
                  me
                    ? { email: me.user.email, username: me.user.username, selectedPin: me.user.selectedPin }
                    : undefined
                }
                onGoPro={() => go("perfil")} // activar Pro ahora vive en Perfil → Pagos y suscripciones
              />
            )}
            {screen === "stats" && <StatsTab onGoPro={() => go("planes")} />}
            {/* Desafíos y recompensas + Amigos: secciones del Perfil Ciclista (v1.14.0) */}
            {screen === "perfil" && <ProfileTab />}
            {screen === "config" && (
              <ConfigTab
                soundOn={soundOn}
                onToggleSound={toggleSound}
                voiceOn={voiceOn}
                onToggleVoice={toggleVoice}
                pro={pro.active}
                onGoPro={() => go("planes")}
              />
            )}
            {screen === "ayuda" && <HelpTab />}
          </section>
        )}

        {/* v1.12.11: popup de reglas de accesos (F3/D3) - compartido por
            minimapa y mapa grande a través del motor de navegación. */}
        <PopupReglaRuta decision={nav.decision} onElegir={nav.resolverDecision} onCancelar={nav.cancelarDecision} />
      </main>

      {/* Barra inferior: 4 destinos (Ride · Explorar · Acceso · Perfil) */}
      <nav
        aria-label={t("pg.navegacionAria")}
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-3 py-1.5">
          <BottomTab icon={<Bike className="h-[22px] w-[22px]" />} label={t("nav.ride")} on={screen === "ride"} onClick={() => go("ride")} />
          <BottomTab icon={<MapIcon className="h-[22px] w-[22px]" />} label={t("nav.explorar")} on={screen === "explorar"} onClick={() => go("explorar")} />
          {/* "acceso" es el id interno histórico; visible: credencial Pedalea Seguro */}
          <BottomTab icon={<QrCode className="h-[22px] w-[22px]" />} label={t("nav.credencial")} on={screen === "acceso"} onClick={() => go("acceso")} />
          {/* Perfil Ciclista: id interno "ciclista" (el "perfil" del menú es Cuenta) */}
          <BottomTab icon={<Activity className="h-[22px] w-[22px]" />} label={t("nav.perfil")} on={screen === "ciclista"} onClick={() => go("ciclista")} />
        </div>
      </nav>

      {/* Menú lateral: PRO · Mi actividad · Cuenta · Plan actual */}
      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pro={pro.active}
        username={me?.user.username}
        email={me?.user.email}
        onNavigate={(s) => go(s)}
      />

      {/* Modal contextual de funciones Pro (buscador / marcadores) */}
      <ProContextModal feature={proLock} onClose={() => setProLock(null)} onDiscover={() => { setProLock(null); go("planes"); }} />

      {/* ¿Fuiste en bici?: corrección del flag de vehículo detectado */}
      <VehicleConfirmModal pending={ride.pendingConfirm} onAnswer={ride.confirmVehicle} />

      {/* Detección de caída (2026-11-14): overlay "¿Estás bien?" a nivel
          de app, activo aunque el ciclista esté en otra pestaña. */}
      <FallOverlay
        alert={ride.fallAlert}
        position={ride.position}
        onDismiss={ride.dismissFall}
        onHelp={ride.requestFallHelp}
      />
    </div>
  );
}

function BottomTab({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-bold transition-colors ${
        on ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className={`flex items-center justify-center rounded-full px-4 py-0.5 ${on ? "bg-emerald-600/15" : ""}`}>{icon}</span>
      {label}
    </button>
  );
}
