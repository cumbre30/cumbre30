"use client";

import { useState } from "react";
import { Bluetooth, BluetoothConnected, BluetoothOff, HeartPulse, Gauge, Loader2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { btSupported, connectHeartRate, connectWheelSpeed } from "@/lib/sensors";

type Status = "idle" | "connecting" | "connected" | "error";

export function SensorPanel({ onSensorSpeed }: { onSensorSpeed: (kmh: number | null) => void }) {
  const [hrStatus, setHrStatus] = useState<Status>("idle");
  const [hrName, setHrName] = useState<string | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [spdStatus, setSpdStatus] = useState<Status>("idle");
  const [spdName, setSpdName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = btSupported();

  const connectHr = async () => {
    setError(null);
    setHrStatus("connecting");
    try {
      const name = await connectHeartRate(setBpm, () => {
        setHrStatus("idle");
        setBpm(null);
        setHrName(null);
      });
      setHrName(name);
      setHrStatus("connected");
    } catch (e) {
      setHrStatus("idle");
      if ((e as Error).name !== "NotFoundError") setError((e as Error).message);
    }
  };

  const connectSpd = async () => {
    setError(null);
    setSpdStatus("connecting");
    try {
      const name = await connectWheelSpeed(onSensorSpeed, () => {
        setSpdStatus("idle");
        setSpdName(null);
        onSensorSpeed(null);
      });
      setSpdName(name);
      setSpdStatus("connected");
    } catch (e) {
      setSpdStatus("idle");
      if ((e as Error).name !== "NotFoundError") setError((e as Error).message);
    }
  };

  const chip = (s: Status) =>
    s === "connected"
      ? "text-emerald-300 border-emerald-700"
      : s === "connecting"
        ? "text-amber-300 border-amber-700"
        : "text-zinc-500 border-zinc-700";

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-1.5">
        <Bluetooth className="h-3.5 w-3.5" /> Sensores Bluetooth
      </div>
      <Card className="bg-zinc-900/80 border-zinc-800 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-sm ${spdStatus === "connected" ? "text-zinc-100" : "text-zinc-400"} flex-1 min-w-0`}>
            {spdStatus === "connected" ? <BluetoothConnected className="h-4 w-4 text-emerald-400 shrink-0" /> : spdStatus === "connecting" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Gauge className="h-4 w-4 shrink-0" />}
            <span className="truncate">{spdName ?? "Sensor de velocidad de rueda"}</span>
            {spdStatus === "connected" && <span className="text-[10px] text-emerald-400 shrink-0">sustituye al GPS</span>}
          </div>
          {spdStatus === "connected" ? (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${chip(spdStatus)}`}>conectado</span>
          ) : (
            <Button size="sm" variant="outline" onClick={connectSpd} disabled={!supported || spdStatus === "connecting"} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9">
              Emparejar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-sm ${hrStatus === "connected" ? "text-zinc-100" : "text-zinc-400"} flex-1 min-w-0`}>
            {hrStatus === "connected" ? <BluetoothConnected className="h-4 w-4 text-red-400 shrink-0" /> : hrStatus === "connecting" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <HeartPulse className="h-4 w-4 shrink-0" />}
            <span className="truncate">{hrName ?? "Pulso cardíaco (HRM)"}</span>
            {bpm !== null && <span className="font-mono text-red-300 font-bold shrink-0">{bpm} <span className="text-[10px] font-sans font-normal text-zinc-500">bpm</span></span>}
          </div>
          {hrStatus === "connected" ? (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${chip(hrStatus)}`}>conectado</span>
          ) : (
            <Button size="sm" variant="outline" onClick={connectHr} disabled={!supported || hrStatus === "connecting"} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9">
              Emparejar
            </Button>
          )}
        </div>

        {!supported && (
          <p className="text-xs text-amber-300/80 flex items-start gap-1.5">
            <BluetoothOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Web Bluetooth no está disponible en este navegador (iOS Safari no lo soporta).
            La velocidad seguirá viniendo del GPS. En Android usa Chrome o Edge.
          </p>
        )}
        {error && <p className="text-xs text-red-300 flex items-start gap-1.5"><BluetoothOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />{error}</p>}
        {supported && !error && (
          <p className="text-[11px] text-zinc-500 flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            La velocidad de rueda (estándar BLE CSC) no tiene el retraso del GPS: es la fuente
            recomendada para no pasarse del límite en las bajadas. Circunferencia por defecto 2.105 m.
          </p>
        )}
      </Card>
    </div>
  );
}
