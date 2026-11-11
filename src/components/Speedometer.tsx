"use client";

// ============================================================
// Velocímetro de Cumbre30 - tres estilos (Pro):
//   · digital - el número grande de siempre (tamaño ajustable).
//   · arco    - gauge de 270 grados: arco de progreso + número.
//   · dial    - gauge con marcas de escala (cada 5 y 10 km/h).
// La escala llega a 60 km/h: el parque limita a 30, así que la
// mitad del arco es la zona segura. Colores por estado de
// velocidad con clases Tailwind (currentColor en el SVG), de
// modo que los temas Pro remapean el acento también aquí.
// ============================================================

import { speedoFontPx, speedoGaugeWidth, type SpeedoSize, type SpeedoStyle } from "@/lib/rideTheme";

type Props = {
  speedKmh: number;
  idle: boolean;
  over: boolean;
  caution: boolean;
  inPark: boolean;
  style: SpeedoStyle;
  size: SpeedoSize;
};

/** Clase de color del valor según estado (misma lógica del ride). */
function stateTextClass(idle: boolean, over: boolean, caution: boolean, inPark: boolean): string {
  if (idle) return "text-muted-foreground/50";
  if (over) return "text-red-600 dark:text-red-500";
  if (caution) return "text-amber-600 dark:text-amber-400";
  if (inPark) return "text-emerald-600 dark:text-emerald-400";
  return "text-foreground";
}

const MAX_KMH = 60;

// Geometría del gauge (viewBox fijo 300 x 220, se escala por width).
const CX = 150;
const CY = 130;
const R = 100;
const STROKE = 18;
const START_DEG = 135; // abajo a la izquierda
const SWEEP_DEG = 270; // hasta 45 grados (abajo a la derecha)

const RAD = Math.PI / 180;
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = deg * RAD;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

// Longitud exacta del arco de 270 grados (dasharray del progreso).
const ARC_LEN = 2 * Math.PI * R * (SWEEP_DEG / 360);

function GaugeArc({ frac, className, ticks }: { frac: number; className: string; ticks: boolean }) {
  const [sx, sy] = polar(CX, CY, R, START_DEG);
  const [ex, ey] = polar(CX, CY, R, START_DEG + SWEEP_DEG);
  const fracClamped = Math.max(0, Math.min(1, frac));
  return (
    <>
      {/* pista */}
      <path
        d={`M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        className="text-muted-foreground/20"
      />
      {ticks && (
        <g>
          {/* marcas mayores cada 10 km/h */}
          {Array.from({ length: 7 }, (_, k) => {
            const deg = START_DEG + (k * SWEEP_DEG) / 6;
            const [x1, y1] = polar(CX, CY, R - STROKE / 2 - 8, deg);
            const [x2, y2] = polar(CX, CY, R - STROKE / 2 - 1, deg);
            return <line key={`M${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="text-muted-foreground/40" />;
          })}
          {/* marcas menores cada 5 km/h */}
          {Array.from({ length: 12 }, (_, j) => {
            if (j % 2 === 0) return null;
            const deg = START_DEG + (j * SWEEP_DEG) / 12;
            const [x1, y1] = polar(CX, CY, R - STROKE / 2 - 6, deg);
            const [x2, y2] = polar(CX, CY, R - STROKE / 2 - 1, deg);
            return <line key={`m${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-muted-foreground/30" />;
          })}
        </g>
      )}
      {/* progreso */}
      <path
        d={`M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${ARC_LEN * fracClamped} ${ARC_LEN + 4}`}
        className={className}
        style={{ transition: "stroke-dasharray 0.35s ease" }}
      />
    </>
  );
}

export function Speedometer({ speedKmh, idle, over, caution, inPark, style, size }: Props) {
  const colorCls = stateTextClass(idle, over, caution, inPark);
  const frac = Math.max(0, Math.min(1, speedKmh / MAX_KMH));
  const shown = Math.round(speedKmh);

  if (style === "digital") {
    const px = speedoFontPx(size);
    return (
      <div
        className={`text-center font-mono font-extrabold tabular-nums leading-none tracking-tighter ${colorCls}`}
        style={{ fontSize: px }}
        aria-label={`Velocidad actual ${shown} kilómetros por hora`}
      >
        {shown}
        <span className="ml-2 align-baseline font-sans text-base font-semibold normal-case tracking-normal text-muted-foreground">km/h</span>
      </div>
    );
  }

  const width = speedoGaugeWidth(size);
  const numPx = style === "dial" ? Math.round(width * 0.21) : Math.round(width * 0.26);
  const unitPx = Math.max(12, Math.round(width * 0.05));
  const unitY = style === "dial" ? CY + 40 : CY + 46;

  return (
    <svg
      viewBox="0 0 300 220"
      style={{ width, maxWidth: "100%" }}
      className="mx-auto block"
      role="img"
      aria-label={`Velocidad actual ${shown} kilómetros por hora`}
    >
      <GaugeArc frac={frac} className={colorCls} ticks={style === "dial"} />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        className={`${colorCls} font-mono font-extrabold tabular-nums`}
        style={{ fontSize: numPx }}
      >
        {shown}
      </text>
      <text
        x={CX}
        y={unitY}
        textAnchor="middle"
        fill="currentColor"
        className="font-sans font-semibold text-muted-foreground"
        style={{ fontSize: unitPx }}
      >
        km/h
      </text>
    </svg>
  );
}
