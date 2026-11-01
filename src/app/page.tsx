"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bike,
  History as HistoryIcon,
  Map as MapIcon,
  Mic,
  MicOff,
  Play,
  QrCode,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RideView } from "@/components/RideView";
import { HistoryTab } from "@/components/HistoryTab";
import { useRideEngine, type Source } from "@/hooks/useRideEngine";
import { alerts } from "@/lib/alertEngine";

const Wallet = dynamic(() => import("@/components/Wallet"), {
  ssr: false,
  loading: () => (
    <div className="h-40 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-sm text-zinc-500">
      Cargando billetera…
    </div>
  ),
});

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[62vh] min-h-[420px] rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-sm text-zinc-500">
      Cargando mapa…
    </div>
  ),
});

function GpsChip({ status, simRunning }: { status: string; simRunning: boolean }) {
  if (simRunning) {
    return (
      <span className="rounded-full border border-emerald-700 text-emerald-300 px-2.5 py-1 text-[11px] font-medium" role="status">
        Demo activo
      </span>
    );
  }
  const map: Record<string, { text: string; cls: string }> = {
    idle: { text: "GPS en espera", cls: "border-zinc-700 text-zinc-400" },
    requesting: { text: "Buscando GPS…", cls: "border-amber-700 text-amber-300 animate-pulse" },
    active: { text: "GPS activo", cls: "border-emerald-700 text-emerald-300" },
    denied: { text: "GPS denegado", cls: "border-red-700 text-red-300" },
    error: { text: "GPS sin señal", cls: "border-red-700 text-red-300" },
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
  const [tab, setTab] = useState("ride");
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);
  const [source, setSource] = useState<Source>("sim");

  const running = ride.status === "running";

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

  const handleStartStop = () => {
    if (running) {
      ride.stop();
      setHistoryKey((k) => k + 1);
    } else {
      ride.start(source);
      setTab("ride");
    }
  };

  const mapProps = useMemo(
    () => ({ track: ride.track, position: ride.position, accuracyM: ride.accuracyM }),
    [ride.track, ride.position, ride.accuracyM]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Bike className="h-5 w-5 text-zinc-950" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold leading-tight tracking-tight">
              Cumbre<span className="text-emerald-400">30</span>
            </h1>
            <p className="text-[11px] text-zinc-500 leading-tight">Ciclocomputador · Cerro San Cristóbal</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggleSound} aria-label={soundOn ? "Silenciar pitidos" : "Activar pitidos"} className="h-8 w-8 text-zinc-400">
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-400" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleVoice} aria-label={voiceOn ? "Desactivar avisos de voz" : "Activar avisos de voz"} className="h-8 w-8 text-zinc-400">
              {voiceOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
            </Button>
            <GpsChip status={running ? ride.gpsStatus : "idle"} simRunning={running && ride.source === "sim"} />
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-32">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4 bg-zinc-900 border border-zinc-800 h-11">
            <TabsTrigger value="ride" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-zinc-950 data-[state=active]:font-semibold">
              <Bike className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Ride</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-zinc-950 data-[state=active]:font-semibold">
              <MapIcon className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Mapa</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-zinc-950 data-[state=active]:font-semibold">
              <QrCode className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">QR</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-zinc-950 data-[state=active]:font-semibold">
              <HistoryIcon className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ride" className="mt-4">
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
              running={running}
            />
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <MapView {...mapProps} />
            <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
              El polígono y las zonas de riesgo son aproximaciones del prototipo, calibradas con los accesos
              Pío Nono y Pedro de Valdivia Norte. La versión final usaría el geocercado oficial de Parquemet.
            </p>
          </TabsContent>

          <TabsContent value="wallet" className="mt-4">
            <Wallet />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistoryTab refreshKey={historyKey} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Barra de control inferior */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden" role="radiogroup" aria-label="Fuente de datos">
            {(["sim", "gps"] as Source[]).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={source === s}
                disabled={running}
                onClick={() => setSource(s)}
                className={`px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  source === s ? "bg-zinc-800 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s === "sim" ? "Demo" : "GPS real"}
              </button>
            ))}
          </div>

          <Button
            onClick={handleStartStop}
            className={`flex-1 h-12 text-base font-bold rounded-lg ${
              running
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-zinc-950"
            }`}
          >
            {running ? (
              <><Square className="h-5 w-5 mr-2" /> Detener</>
            ) : (
              <><Play className="h-5 w-5 mr-2" /> Iniciar ride</>
            )}
          </Button>

          {running && (
            <div className="text-right shrink-0 hidden xs:block sm:block" aria-hidden>
              <div className={`font-mono text-xl font-bold tabular-nums leading-none ${ride.speedState === "over" ? "text-red-400" : ride.speedState === "caution" ? "text-amber-300" : "text-zinc-100"}`}>
                {Math.round(ride.speedKmh)}
              </div>
              <div className="text-[10px] text-zinc-500">km/h</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
