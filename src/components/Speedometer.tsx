"use client";

// ============================================================
// Velocímetro de Cumbre30 - seis estilos (Pro desde v1.12.13):
//   · digital - el número grande de siempre (tamaño ajustable).
//   · arco    - gauge de 270 grados: arco de progreso + número.
//   · dial    - gauge con marcas de escala (cada 5 y 10 km/h).
//   · aguja   - analógico: aguja giratoria, marcas de escala y
//               zonas ámbar (25-30) y roja (30-60) en la pista.
//   · anillo  - círculo 360° estilo fitness: progreso fino, zonas
//               ámbar/roja al final y número gigante al centro.
//   · bloque  - tablero de 30 segmentos horizontales con la marca
//               del límite del parque (30 km/h) al centro.
// La escala llega a 60 km/h: el parque limita a 30, así que la
// mitad del arco es la zona segura. Colores por estado de
// velocidad con clases Tailwind (currentColor en el SVG), de
// modo que los temas Pro remapean el acento también aquí.
// ============================================================

import { speedoFontPx, speedoGaugeWidth, type SpeedoSize, type SpeedoStyle } from "@/lib/rideTheme";
import { t, useLang } from "@/lib/i18n";

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

// Marcas de escala compartidas por los estilos dial y aguja.
function Ticks() {
  return (
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
  );
}

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
      {ticks && <Ticks />}
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

// Gauge analógico: pista con zonas de velocidad + aguja giratoria.
// La aguja nace apuntando a la derecha (0 grados) y rota hasta el
// ángulo de la velocidad; nunca cruza la brecha inferior, donde va
// el número. Puntos calculados con la misma escala polar de arriba.
function NeedleGauge({ frac, className }: { frac: number; className: string }) {
  const [sx, sy] = polar(CX, CY, R, START_DEG);
  const [ex, ey] = polar(CX, CY, R, START_DEG + SWEEP_DEG);
  const [ax, ay] = polar(CX, CY, R, START_DEG + SWEEP_DEG * (25 / MAX_KMH));
  const [zx, zy] = polar(CX, CY, R, START_DEG + SWEEP_DEG * (30 / MAX_KMH));
  const deg = START_DEG + SWEEP_DEG * Math.max(0, Math.min(1, frac));
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
      {/* zona de precaución 25-30 km/h */}
      <path d={`M ${ax} ${ay} A ${R} ${R} 0 0 1 ${zx} ${zy}`} fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="butt" className="text-amber-500/40" />
      {/* zona de exceso 30-60 km/h */}
      <path d={`M ${zx} ${zy} A ${R} ${R} 0 0 1 ${ex} ${ey}`} fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="butt" className="text-red-500/40" />
      <Ticks />
      {/* aguja con contrapeso corto, girando sobre el eje */}
      <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 0.35s ease" }}>
        <line x1={CX - 22} y1={CY} x2={CX + R - STROKE / 2 - 10} y2={CY} stroke="currentColor" strokeWidth={7} strokeLinecap="round" className={className} />
      </g>
      <circle cx={CX} cy={CY} r={11} fill="currentColor" className="text-muted-foreground/40" />
      <circle cx={CX} cy={CY} r={5} fill="currentColor" className="text-muted-foreground/60" />
    </>
  );
}

export function Speedometer({ speedKmh, idle, over, caution, inPark, style, size }: Props) {
  const lang = useLang(); // re-render al cambiar el idioma
  const colorCls = stateTextClass(idle, over, caution, inPark);
  const frac = Math.max(0, Math.min(1, speedKmh / MAX_KMH));
  const shown = Math.round(speedKmh);

  if (style === "digital") {
    const px = speedoFontPx(size);
    return (
      <div
        className={`text-center font-mono font-extrabold tabular-nums leading-none tracking-tighter ${colorCls}`}
        style={{ fontSize: px }}
        aria-label={t("vel.ariaActual", shown)}
      >
        {shown}
        <span className="ml-2 align-baseline font-sans text-base font-semibold normal-case tracking-normal text-muted-foreground">km/h</span>
      </div>
    );
  }

  const width = speedoGaugeWidth(size);
  const numPx = style === "arco" ? Math.round(width * 0.26) : Math.round(width * (style === "aguja" ? 0.19 : 0.21));
  const unitPx = Math.max(11, Math.round(width * 0.05));
  const unitY = style === "dial" ? CY + 40 : CY + 46;

  if (style === "aguja") {
    return (
      <svg
        viewBox="0 0 300 220"
        style={{ width, maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        <NeedleGauge frac={frac} className={colorCls} />
        <text
          x={CX}
          y={CY + 50}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          className={`${colorCls} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPx }}
        >
          {shown}
          <tspan dx={numPx * 0.16} className="font-sans font-semibold text-muted-foreground" style={{ fontSize: unitPx }}>
            km/h
          </tspan>
        </text>
      </svg>
    );
  }

  if (style === "anillo") {
    // Anillo completo 360° estilo fitness (cliente 2026-11-17): pista
    // circular fina, zonas ámbar (25-30) y roja (30-60) al final del
    // recorrido, punto en la punta del progreso y número gigante al
    // centro. ViewBox cuadrado 240×240.
    const S = 240;
    const C = S / 2;
    const RR = 96;
    const ST = 13;
    const LEN = 2 * Math.PI * RR;
    const fClamped = Math.max(0, Math.min(1, frac));
    const f25 = 25 / MAX_KMH;
    const f30 = 30 / MAX_KMH;
    const numPxR = Math.round(width * 0.3);
    const unitPxR = Math.max(11, Math.round(width * 0.05));
    const ang = -90 + 360 * fClamped;
    const [dx, dy] = polar(C, C, RR, ang);
    return (
      <svg
        viewBox={`0 0 ${S} ${S}`}
        style={{ width: Math.min(width, 230), maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        {/* pista */}
        <circle cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST} className="text-muted-foreground/20" />
        {/* zona ámbar 25-30 y roja 30-60 (arcos del final) */}
        <circle
          cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST}
          className="text-amber-500/40"
          strokeDasharray={`${LEN * (f30 - f25)} ${LEN + 4}`}
          strokeDashoffset={-LEN * f25}
        />
        <circle
          cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST}
          className="text-red-500/40"
          strokeDasharray={`${LEN * (1 - f30)} ${LEN + 4}`}
          strokeDashoffset={-LEN * f30}
        />
        {/* progreso */}
        <circle
          cx={C} cy={C} r={RR} fill="none" stroke="currentColor" strokeWidth={ST}
          strokeLinecap="round"
          className={colorCls}
          strokeDasharray={`${LEN * fClamped} ${LEN + 4}`}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: "stroke-dasharray 0.35s ease" }}
        />
        {/* punto en la punta del progreso */}
        {fClamped > 0.01 && fClamped < 0.99 && (
          <circle cx={dx} cy={dy} r={ST / 2 + 2} fill="currentColor" className={colorCls} transform={`rotate(90 ${dx} ${dy})`} style={{ transition: "cx 0.35s ease, cy 0.35s ease" }} />
        )}
        <text
          x={C} y={C - 6}
          textAnchor="middle" dominantBaseline="central"
          fill="currentColor"
          className={`${colorCls} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPxR }}
        >
          {shown}
        </text>
        <text
          x={C} y={C + numPxR * 0.42}
          textAnchor="middle"
          fill="currentColor"
          className="font-sans font-semibold text-muted-foreground"
          style={{ fontSize: unitPxR }}
        >
          km/h
        </text>
      </svg>
    );
  }

  if (style === "bloque") {
    // Tablero de segmentos (cliente 2026-11-17): 30 bloques verticales
    // (2 km/h cada uno) que se encienden hasta la velocidad; ámbar
    // 25-30 y rojo 30-60 según posición, marca del límite del parque
    // (30 km/h) al centro y número grande a la izquierda. ViewBox 300×120.
    const SEG = 30;
    const X0 = 118;
    const X1 = 292;
    const Y0 = 44;
    const HH = 30;
    const GAP = 1.5;
    const SW = (X1 - X0 - GAP * (SEG - 1)) / SEG;
    const lit = Math.max(0, Math.min(SEG, Math.round(frac * SEG)));
    const numPxB = Math.round(width * 0.24);
    const unitPxB = Math.max(11, Math.round(width * 0.05));
    const segCls = (i: number) => {
      const vHasta = ((i + 1) / SEG) * MAX_KMH;
      if (vHasta > 30) return "text-red-500/75";
      if (vHasta > 25) return "text-amber-500/75";
      return colorCls;
    };
    return (
      <svg
        viewBox="0 0 300 120"
        style={{ width, maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        {/* número grande a la izquierda */}
        <text
          x={14} y={54}
          textAnchor="start" dominantBaseline="central"
          fill="currentColor"
          className={`${colorCls} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPxB }}
        >
          {shown}
        </text>
        <text
          x={16} y={54 + numPxB * 0.55}
          textAnchor="start"
          fill="currentColor"
          className="font-sans font-semibold text-muted-foreground"
          style={{ fontSize: unitPxB }}
        >
          km/h
        </text>
        {/* escala */}
        <text x={X0} y={Y0 - 10} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 9 }}>0</text>
        <text x={(X0 + X1) / 2} y={Y0 - 10} textAnchor="middle" fill="currentColor" className="font-sans font-bold text-amber-600 dark:text-amber-400" style={{ fontSize: 9 }}>30</text>
        <text x={X1} y={Y0 - 10} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 9 }}>60</text>
        {/* segmentos */}
        {Array.from({ length: SEG }, (_, i) => (
          <rect
            key={i}
            x={X0 + i * (SW + GAP)}
            y={Y0}
            width={SW}
            height={HH}
            rx={2.5}
            fill="currentColor"
            className={i < lit ? segCls(i) : "text-muted-foreground/15"}
            style={{ transition: "fill 0.3s ease" }}
          />
        ))}
        {/* marca del límite del parque (30 km/h) */}
        <line
          x1={X0 + 15 * (SW + GAP) - GAP / 2}
          y1={Y0 - 5}
          x2={X0 + 15 * (SW + GAP) - GAP / 2}
          y2={Y0 + HH + 5}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="text-amber-600 dark:text-amber-400"
        />
        <text x={(X0 + X1) / 2} y={Y0 + HH + 20} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 9.5 }}>
          límite del parque
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 300 220"
      style={{ width, maxWidth: "100%" }}
      className="mx-auto block"
      role="img"
      aria-label={t("vel.ariaActual", shown)}
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
