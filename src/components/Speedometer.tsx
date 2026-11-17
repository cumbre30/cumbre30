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
//   · neon    - dial 360° del diseño adjunto del cliente: aro de
//               neón con gradiente azul→magenta, marcas radiales,
//               aguja brillante y odometer del ride arriba.
//   · rayos   - semicírculo de 30 segmentos radiales tipo dashboard
//               digital, con gradiente violeta→azul en el encendido.
// La escala llega a 60 km/h: el parque limita a 30, así que la
// mitad del arco es la zona segura. Colores por estado de
// velocidad con clases Tailwind (currentColor en el SVG), de
// modo que los temas Pro remapean el acento también aquí.
// ============================================================

import { useId } from "react";
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
  /** km acumulados del ride: alimenta el odometer del estilo neon. */
  odoKm?: number;
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

export function Speedometer({ speedKmh, idle, over, caution, inPark, style, size, odoKm }: Props) {
  const lang = useLang(); // re-render al cambiar el idioma
  const gid = useId(); // ids únicos de SVG: el mismo dial puede montarse 2 veces (ride + vista previa)
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

  if (style === "neon") {
    // Diseño adjunto del cliente (v1.12.14): aro exterior de neón con
    // gradiente azul→magenta y glow, dial interior clásico con marcas
    // radiales blancas, números cada 10, aguja brillante magenta y
    // odometer del ride arriba. El estado de velocidad lo marca el
    // número central; el aro es la estética del diseño.
    const S = 240;
    const C = S / 2;
    const RA = 94; // aro exterior de neón
    const STA = 9;
    const RD = 70; // dial interior (marcas + aguja)
    const ang = START_DEG + SWEEP_DEG * Math.max(0, Math.min(1, frac));
    const numPxN = Math.round(width * 0.2);
    const unitPxN = Math.max(11, Math.round(width * 0.05));
    const [dx, dy] = polar(C, C, RD + 8, ang);
    return (
      <svg
        viewBox={`0 0 ${S} ${S}`}
        style={{ width: Math.min(width, 230), maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        <defs>
          <linearGradient id={`${gid}-aro`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <filter id={`${gid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* aro exterior de neón (marco decorativo completo) */}
        <circle cx={C} cy={C} r={RA} fill="none" stroke={`url(#${gid}-aro)`} strokeWidth={STA} opacity={0.18} />
        <circle cx={C} cy={C} r={RA} fill="none" stroke={`url(#${gid}-aro)`} strokeWidth={STA} strokeLinecap="round" opacity={0.85} filter={`url(#${gid}-glow)`} />
        {/* dial interior: marcas radiales blancas, mayores cada 10 km/h */}
        {Array.from({ length: 60 }, (_, k) => {
          const deg = START_DEG + (k * SWEEP_DEG) / 59;
          if (k % 5 !== 0 && k % 2 !== 0) return null;
          const may = k % 5 === 0;
          const [x1, y1] = polar(C, C, may ? RD - 12 : RD - 6, deg);
          const [x2, y2] = polar(C, C, RD, deg);
          return <line key={`n${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={may ? 2.5 : 1.4} strokeLinecap="round" className={may ? "text-foreground/50" : "text-muted-foreground/30"} />;
        })}
        {/* números de escala cada 10 */}
        {Array.from({ length: 7 }, (_, k) => {
          const deg = START_DEG + (k * SWEEP_DEG) / 6;
          const [x, y] = polar(C, C, RD - 20, deg);
          return (
            <text key={`e${k}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="currentColor" className="font-sans font-bold text-muted-foreground/55" style={{ fontSize: 9.5 }}>
              {k * 10}
            </text>
          );
        })}
        {/* aguja neón con contrapeso corto */}
        <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: `${C}px ${C}px`, transition: "transform 0.35s ease" }}>
          <line x1={C - 14} y1={C} x2={C + RD - 4} y2={C} stroke="#ec4899" strokeWidth={5} strokeLinecap="round" filter={`url(#${gid}-glow)`} />
        </g>
        <circle cx={C} cy={C} r={6.5} fill="#ec4899" filter={`url(#${gid}-glow)`} />
        <circle cx={C} cy={C} r={2.6} fill="#0a0a12" />
        {/* odometer del ride (prop opcional) */}
        {typeof odoKm === "number" && (
          <text x={C} y={C - numPxN * 0.72} textAnchor="middle" dominantBaseline="central" fill="currentColor" className="font-mono font-bold text-muted-foreground/70" style={{ fontSize: 13 }}>
            {odoKm.toFixed(1)} km
          </text>
        )}
        {/* número central + unidad */}
        <text
          x={C}
          y={C + (typeof odoKm === "number" ? 7 : -3)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          className={`${colorCls} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPxN }}
        >
          {shown}
        </text>
        <text
          x={C}
          y={C + (typeof odoKm === "number" ? numPxN * 0.62 : numPxN * 0.5)}
          textAnchor="middle"
          fill="currentColor"
          className="font-sans font-semibold text-muted-foreground"
          style={{ fontSize: unitPxN }}
        >
          km/h
        </text>
        {/* punto de referencia inferior (remate del dial, como el diseño) */}
        <circle cx={dx} cy={dy} r={1.5} fill="currentColor" className="text-muted-foreground/40" />
      </svg>
    );
  }

  if (style === "rayos") {
    // Diseño adjunto del cliente (v1.12.14): semicírculo tipo dashboard
    // digital con 30 segmentos radiales (2 km/h cada uno, igual que
    // bloque). Los encendidos llevan gradiente violeta→azul de la
    // izquierda a la derecha; ámbar >25 y rojo >30 conservan la
    // semántica de seguridad del resto de estilos. km/h arriba del
    // número, escala 0-60 en los extremos. ViewBox 240×150.
    const S = 240;
    const CX2 = 120;
    const CY2 = 128;
    const R1 = 60;
    const R2 = 102;
    const N = 30;
    const lit = Math.max(0, Math.min(N, Math.round(frac * N)));
    const numPxR = Math.round(width * 0.24);
    const rayClass = (i: number): string => {
      const vHasta = ((i + 1) / N) * MAX_KMH;
      if (vHasta > 30) return "text-red-500/85";
      if (vHasta > 25) return "text-amber-500/85";
      return "";
    };
    return (
      <svg
        viewBox={`0 0 ${S} 150`}
        style={{ width, maxWidth: "100%" }}
        className="mx-auto block"
        role="img"
        aria-label={t("vel.ariaActual", shown)}
      >
        <defs>
          <linearGradient id={`${gid}-ray`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        {/* segmentos radiales (arco superior: 180°→360° pasa por el
            cenit - polar() usa ángulos de pantalla, 90° es abajo) */}
        {Array.from({ length: N }, (_, i) => {
          const deg = 180 + ((i + 0.5) * 180) / N;
          const [x1, y1] = polar(CX2, CY2, R1, deg);
          const [x2, y2] = polar(CX2, CY2, R2, deg);
          const vHasta = ((i + 1) / N) * MAX_KMH;
          const encendido = i < lit;
          const solid = vHasta > 25; // ámbar/rojo: color de estado
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={encendido && !solid ? `url(#${gid}-ray)` : "currentColor"}
              strokeWidth={encendido ? 9 : 7}
              strokeLinecap="round"
              className={encendido && solid ? rayClass(i) : encendido ? "" : "text-muted-foreground/25"}
              style={{ transition: "stroke 0.3s ease" }}
            />
          );
        })}
        {/* escala 0-60 en los extremos (como el diseño) */}
        <text x={CX2 - R1 + 4} y={CY2 - 8} textAnchor="middle" fill="currentColor" className="font-sans font-bold text-muted-foreground/55" style={{ fontSize: 11 }}>
          0
        </text>
        <text x={CX2 + R1 - 4} y={CY2 - 8} textAnchor="middle" fill="currentColor" className="font-sans font-bold text-muted-foreground/55" style={{ fontSize: 11 }}>
          {MAX_KMH}
        </text>
        {/* km/h arriba del número (como el diseño) */}
        <text x={CX2} y={CY2 - 78} textAnchor="middle" fill="currentColor" className="font-sans font-semibold text-muted-foreground" style={{ fontSize: 13 }}>
          km/h
        </text>
        {/* número central grande */}
        <text
          x={CX2}
          y={CY2 - 38}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          className={`${colorCls} font-mono font-extrabold tabular-nums`}
          style={{ fontSize: numPxR }}
        >
          {shown}
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
