"use client";

// ============================================================
// Cumbre30 — arquitectura de navegación del rediseño (brief §1):
//   · Bottom nav con 3 destinos: Ride · Explorar · Acceso
//     (el QR se usa en la portada: siempre a un toque).
//   · Menú lateral con 4 zonas: CUMBRE30 PRO · Mi actividad ·
//     Cuenta · Plan actual.
//   · Header compacto: marca + estado GPS + plan + menú.
//   · El control Demo/GPS, pitidos y voz viven en Configuración.
// Todo lo que ya funcionaba se conserva: motor de ride, navegación
// (computeRoute), historial, QR, premios, perfil, licencia Pro.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Bike, Map as MapIcon, QrCode } from "lucide-react";
import { RideView } from "@/components/RideView";
import { HistoryTab } from "@/components/HistoryTab";
import { VehicleConfirmModal } from "@/components/VehicleConfirmModal";
import { AppDrawer, type MenuScreen } from "@/components/AppDrawer";
import { PlanPill, ProContextModal } from "@/components/ProUI";
import { PlanesTab } from "@/components/PlanesTab";
import { StatsTab } from "@/components/StatsTab";
import { ConfigTab } from "@/components/ConfigTab";
import { HelpTab } from "@/components/HelpTab";
import { useRideEngine, type Source } from "@/hooks/useRideEngine";
import { useMe } from "@/hooks/useMe";
import { useNavEngine } from "@/hooks/useNavEngine";
import { useProLicense } from "@/lib/proLicense";
import { linkRidesToAccount, setRideOwner } from "@/lib/history";
import { courseHeading } from "@/lib/geo";
import { alerts } from "@/lib/alertEngine";
import type { ProLockFeature } from "@/lib/planData";

const Wallet = dynamic(() => import("@/components/Wallet"), {
  ssr: false,
  loading: () => (
    <div className="h-40 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
      Cargando billetera…
    </div>
  ),
});

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[62vh] min-h-[420px] rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
      Cargando mapa…
    </div>
  ),
});

const ProfileTab = dynamic(() => import("@/components/ProfileTab"), {
  ssr: false,
  loading: () => (
    <div className="h-40 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
      Cargando perfil…
    </div>
  ),
});

const ChallengesTab = dynamic(() => import("@/components/ChallengesTab"), {
  ssr: false,
  loading: () => (
    <div className="h-40 rounded-xl border border-border bg-card flex items-center justify-center text-sm text-muted-foreground">
      Cargando desafíos…
    </div>
  ),
});

/** Destinos de la barra inferior (los 3 del brief). */
type TabScreen = "ride" | "explorar" | "acceso";
/** Sub-pantallas accesibles desde el menú lateral. */
type SubScreen = MenuScreen; // historial | stats | premios | perfil | config | ayuda | planes
type Screen = TabScreen | SubScreen;

const SUB_TITLES: Record<SubScreen, string> = {
  historial: "Mis viajes",
  stats: "Estadísticas generales",
  premios: "Desafíos y recompensas",
  perfil: "Perfil",
  config: "Configuración",
  ayuda: "Ayuda y contacto",
  planes: "Planes",
};

function GpsChip({ status, simRunning }: { status: string; simRunning: boolean }) {
  if (simRunning) {
    return (
      <span className="rounded-full border border-emerald-700 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-medium" role="status">
        Demo activo
      </span>
    );
  }
  const map: Record<string, { text: string; cls: string }> = {
    idle: { text: "GPS en espera", cls: "border-border text-muted-foreground" },
    requesting: { text: "Buscando GPS…", cls: "border-amber-700 text-amber-700 dark:text-amber-300 animate-pulse" },
    active: { text: "GPS activo", cls: "border-emerald-700 text-emerald-700 dark:text-emerald-300" },
    denied: { text: "GPS denegado", cls: "border-red-700 text-red-700 dark:text-red-300" },
    error: { text: "GPS sin señal", cls: "border-red-700 text-red-700 dark:text-red-300" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.cls}`} role="status">
      {s.text}
    </span>
  );
}

export default function Home() {
  const ride = useRideEngine();
  const { me } = useMe();
  const { pro } = useProLicense();
  const [screen, setScreen] = useState<Screen>("ride");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [proLock, setProLock] = useState<ProLockFeature | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);
  const [source, setSource] = useState<Source>("sim");

  const status = ride.status; // idle | running | paused
  const active = status !== "idle"; // el ride (o su pausa) está en curso
  // Enlace viaje ↔ cuenta: rides nuevos y antiguos quedan asociados al
  // correo de la sesión; sin correo son locales del dispositivo.
  const userEmail = me?.user.email ?? null;
  useEffect(() => {
    setRideOwner(userEmail);
    if (userEmail) linkRidesToAccount(userEmail);
  }, [userEmail]);
  // Navegación compartida: velocímetro (minimapa) + mapa grande.
  // Sigue viva también en pausa: revisar la ruta no requiere ride activo.
  const nav = useNavEngine(ride.position, active);
  const heading = useMemo(() => courseHeading(ride.track), [ride.track]);

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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header compacto (brief §2.1): marca · GPS · plan · menú */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Bike className="h-5 w-5 text-zinc-950" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold leading-tight tracking-tight">
              Cumbre<span className="text-emerald-600 dark:text-emerald-400">30</span>
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Cerro San Cristóbal</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <GpsChip status={ride.gpsStatus} simRunning={status === "running" && ride.source === "sim"} />
            <PlanPill pro={pro.active} onClick={() => go("planes")} />
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-28">
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
            track={ride.track}
            heading={heading}
            userPin={me?.user.selectedPin}
            nav={nav}
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

        {screen !== "ride" && screen !== "explorar" && screen !== "acceso" && (
          <section aria-label={SUB_TITLES[screen]}>
            <h2 className="mb-3 text-xl font-bold tracking-tight text-foreground">{SUB_TITLES[screen]}</h2>
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
            {screen === "premios" && (
              <ChallengesTab
                onGoPerfil={() => go("perfil")}
                onGoPro={() => go("planes")} // desafíos Pro → comparación FREE/PRO
              />
            )}
            {screen === "perfil" && <ProfileTab />}
            {screen === "config" && (
              <ConfigTab
                source={source}
                onSource={setSource}
                soundOn={soundOn}
                onToggleSound={toggleSound}
                voiceOn={voiceOn}
                onToggleVoice={toggleVoice}
              />
            )}
            {screen === "ayuda" && <HelpTab />}
          </section>
        )}
      </main>

      {/* Barra inferior: 3 destinos (Ride · Explorar · Acceso) */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 px-3 py-1.5">
          <BottomTab icon={<Bike className="h-[22px] w-[22px]" />} label="Ride" on={screen === "ride"} onClick={() => go("ride")} />
          <BottomTab icon={<MapIcon className="h-[22px] w-[22px]" />} label="Explorar" on={screen === "explorar"} onClick={() => go("explorar")} />
          {/* "acceso" es el id interno histórico; visible: credencial Pedalea Seguro */}
          <BottomTab icon={<QrCode className="h-[22px] w-[22px]" />} label="Credencial" on={screen === "acceso"} onClick={() => go("acceso")} />
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
