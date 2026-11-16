"use client";

// ============================================================
// Bloque "Senderos y cumbres del parque" para el buscador de
// Explorar (FREE y PRO). Datos 100% oficiales: mapa Parquemet
// (largos y cumbres) + geometría OSM verificada (senderos.ts y
// park.ts). Las 5 rutas de enduro oficiales aún no están
// publicadas por Parquemet: se muestran como pendientes.
// Textos vía i18n (claves senderos.*); los nombres de senderos,
// lugares y cumbres vienen de los datos (español, no se tocan).
// ============================================================

import { ChevronDown, Route } from "lucide-react";
import { SENDEROS, type Sendero } from "@/lib/senderos";
import { CUMBRES, PARK_PLACES, type LatLng } from "@/lib/park";
import { normalizeForSearch } from "@/lib/marks";
import { t, useLang, type Lang } from "@/lib/i18n";

const TIPO_EMOJI: Record<Sendero["tipo"], string> = {
  ciclista: "🌲",
  peatonal: "🚶",
  paseo: "🛤️",
};

/** Locale numérico según el idioma activo (fechas/metros del panel). */
function localeDe(lang: Lang): string {
  if (lang === "en") return "en-US";
  if (lang === "pt") return "pt-BR";
  return "es-CL";
}

function distFmt(s: Sendero, loc: string): string {
  const m = s.largoOficialM ?? s.largoMedidoM;
  if (m == null) return "";
  return `· ${(m / 1000).toLocaleString(loc)} km`;
}

type Props = {
  query: string;
  onSetDest?: (d: { name: string; position: LatLng } | null) => void;
};

export default function SenderosBloque({ query, onSetDest }: Props) {
  const lang = useLang(); // re-render al cambiar el idioma
  const loc = localeDe(lang);
  const nq = normalizeForSearch(query);
  const senderos = SENDEROS.filter((s) => !nq || normalizeForSearch(s.nombre).includes(nq));
  const cumbres = CUMBRES.filter((c) => !nq || normalizeForSearch(c.name).includes(nq));
  const lugares = PARK_PLACES.filter((p) => !nq || normalizeForSearch(p.name).includes(nq));
  if (senderos.length === 0 && cumbres.length === 0 && lugares.length === 0) return null;

  const filaRuta = (nombre: string, pos: LatLng) =>
    onSetDest && (
      <button
        onClick={() => onSetDest({ name: nombre, position: pos })}
        className="shrink-0 rounded border border-sky-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-950/40 dark:text-sky-300"
        title={t("senderos.rutaTitle")}
      >
        <Route className="inline h-3 w-3 mr-0.5" /> {t("mapa.btnRuta")}
      </button>
    );

  return (
    <details className="group mt-2 rounded-lg border border-border bg-background/60 p-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-foreground/90 [&::-webkit-details-marker]:hidden">
        🌄 {t("senderos.bloqueTitulo")}
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-1.5">
        {senderos.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 border-b border-border/40 py-1.5 last:border-0">
            <button
              onClick={() => s.cabeza && s.tipo !== "peatonal" && onSetDest?.({ name: s.nombre, position: s.cabeza })}
              className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
              title={s.nota ?? s.nombre}
            >
              {TIPO_EMOJI[s.tipo]} {s.nombre}{" "}
              <span className="text-[10px] text-muted-foreground">
                {distFmt(s, loc)}
                {s.tipo === "peatonal" ? t("senderos.soloPeatones") : ""}
                {s.largoOficialM != null && s.largoMedidoM == null ? t("senderos.geoParcial") : ""}
              </span>
            </button>
            {/* Senderos peatonales (cliente 2026-11-13): «no para ruta» —
                sin botón «Ruta»; se ven en la capa del mapa. */}
            {s.cabeza && s.tipo !== "peatonal" && filaRuta(s.nombre, s.cabeza)}
          </li>
        ))}
        {lugares.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5 border-b border-border/40 py-1.5 last:border-0">
            <span className="min-w-0 flex-1 truncate text-left text-xs text-foreground">
              {p.name} <span className="text-[10px] text-muted-foreground">{t("senderos.lugarParque")}</span>
            </span>
            {filaRuta(p.name, p.position)}
          </li>
        ))}
        {cumbres.map((c) => (
          <li key={c.id} className="border-b border-border/40 py-1.5 last:border-0">
            <p className="text-xs text-foreground">
              ⛰️ {c.name}{" "}
              <span className="text-[10px] text-muted-foreground">
                · {c.altM.toLocaleString(loc)}{t("senderos.msnm")}
                {c.id === "san-cristobal" ? t("senderos.zonaPeatonal") : ""}
                {!c.dentroDelParque ? t("senderos.bosqueSantiago") : ""}
              </span>
            </p>
          </li>
        ))}
        <li className="pt-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
          {t("senderos.fuente")}
        </li>
      </ul>
    </details>
  );
}
