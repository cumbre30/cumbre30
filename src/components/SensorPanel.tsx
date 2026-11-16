"use client";

import { useState } from "react";
import { Bluetooth, BluetoothConnected, BluetoothOff, HeartPulse, Gauge, Loader2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { btSupported, connectHeartRate, connectWheelSpeed, isNativeBle } from "@/lib/sensors";
import { t, useLang } from "@/lib/i18n";

// ============================================================
// Panel de sensores Bluetooth (velocidad de rueda + pulso).
// Textos vía i18n (claves sens.*); el mensaje de error crudo del
// navegador ({error}) se muestra tal cual, no es traducible.
// ============================================================

type Status = "idle" | "connecting" | "connected" | "error";

export function SensorPanel({
  onSensorSpeed,
  onBpm,
}: {
  /** Solo se muestra la fila de velocidad de rueda si alguien consume la velocidad. */
  onSensorSpeed?: (kmh: number | null) => void;
  /** Callback por cada lectura de pulso (y null al desconectar). */
  onBpm?: (bpm: number | null) => void;
}) {
  const lang = useLang(); // re-render al cambiar el idioma
  const [hrStatus, setHrStatus] = useState<Status>("idle");
  const [hrName, setHrName] = useState<string | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [spdStatus, setSpdStatus] = useState<Status>("idle");
  const [spdName, setSpdName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = btSupported();
  const native = isNativeBle();

  const connectHr = async () => {
    setError(null);
    setHrStatus("connecting");
    try {
      const name = await connectHeartRate((v) => {
        setBpm(v);
        onBpm?.(v);
      }, () => {
        setHrStatus("idle");
        setBpm(null);
        setHrName(null);
        onBpm?.(null);
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
      const name = await connectWheelSpeed((kmh) => onSensorSpeed?.(kmh), () => {
        setSpdStatus("idle");
        setSpdName(null);
        onSensorSpeed?.(null);
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
        <Bluetooth className="h-3.5 w-3.5" /> {t("sens.titulo")}
      </div>
      <Card className="bg-zinc-900/80 border-zinc-800 p-4 flex flex-col gap-3">
        {onSensorSpeed && (
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-sm ${spdStatus === "connected" ? "text-zinc-100" : "text-zinc-400"} flex-1 min-w-0`}>
            {spdStatus === "connected" ? <BluetoothConnected className="h-4 w-4 text-emerald-400 shrink-0" /> : spdStatus === "connecting" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Gauge className="h-4 w-4 shrink-0" />}
            <span className="truncate">{spdName ?? t("sens.spdNombre")}</span>
            {spdStatus === "connected" && <span className="text-[10px] text-emerald-400 shrink-0">{t("sens.sustituyeGps")}</span>}
          </div>
          {spdStatus === "connected" ? (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${chip(spdStatus)}`}>{t("sens.conectado")}</span>
          ) : (
            <Button size="sm" variant="outline" onClick={connectSpd} disabled={!supported || spdStatus === "connecting"} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9">
              {t("sens.emparejar")}
            </Button>
          )}
        </div>
        )}

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-sm ${hrStatus === "connected" ? "text-zinc-100" : "text-zinc-400"} flex-1 min-w-0`}>
            {hrStatus === "connected" ? <BluetoothConnected className="h-4 w-4 text-red-400 shrink-0" /> : hrStatus === "connecting" ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <HeartPulse className="h-4 w-4 shrink-0" />}
            <span className="truncate">{hrName ?? t("sens.hrNombre")}</span>
            {bpm !== null && <span className="font-mono text-red-300 font-bold shrink-0">{bpm} <span className="text-[10px] font-sans font-normal text-zinc-500">bpm</span></span>}
          </div>
          {hrStatus === "connected" ? (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${chip(hrStatus)}`}>{t("sens.conectado")}</span>
          ) : (
            <Button size="sm" variant="outline" onClick={connectHr} disabled={!supported || hrStatus === "connecting"} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9">
              {t("sens.emparejar")}
            </Button>
          )}
        </div>

        {!supported && (
          <p className="text-xs text-amber-300/80 flex items-start gap-1.5">
            <BluetoothOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {t("sens.noWebBt")}
          </p>
        )}
        {error && <p className="text-xs text-red-300 flex items-start gap-1.5"><BluetoothOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />{error}</p>}
        {native && !error && (
          <p className="text-[11px] text-zinc-500 flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            {t("sens.nativoNota")}
          </p>
        )}
        {supported && !error && (
          <p className="text-[11px] text-zinc-500 flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            {t("sens.cscNota")}
          </p>
        )}
      </Card>
    </div>
  );
}
