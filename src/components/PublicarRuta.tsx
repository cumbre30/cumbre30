"use client";

// ============================================================
// VISTA PREVIA DE PUBLICACIÓN (fase D, arquitectura v2.1 §3.2).
// Publicar exige pasar por aquí: mapa con la geometría PROTEGIDA
// y, como capa superpuesta opt-in, la ORIGINAL para comparar;
// metros recortados por extremo con su nivel (A/B/C); advertencia
// si el tope de recorte quedó excedido (CT-P6); la lista exacta de
// datos que salen del dispositivo; y la confirmación obligatoria
// «revisé la protección aplicada». El payload del POST lleva SOLO
// la geometría protegida (CT-P1/P4: el original jamás sale).
// Sin red: la publicación queda en el outbox y reintenta sola.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { ShieldCheck, Send, TriangleAlert } from "lucide-react";
import { protegerRuta } from "@/lib/proteccionRuta";
import { publicarRuta } from "@/lib/rutasApi";
import { borradores } from "@/lib/rutasBorrador";
import { rutasStore, type RutaV2 } from "@/lib/rutasStore";
import { t, useLang } from "@/lib/i18n";

type BboxMapa = { n: number; s: number; e: number; o: number };

export default function PublicarRuta({
  rutaId,
  abierto,
  onClose,
}: {
  rutaId: string | null;
  abierto: boolean;
  onClose: () => void;
}) {
  useLang();
  const ruta = useMemo(
    () => (rutaId ? rutasStore.get().find((r) => r.id === rutaId && r.status === "borrador") ?? null : null),
    [rutaId],
  );
  const [verOriginal, setVerOriginal] = useState(false);
  const [revisada, setRevisada] = useState(false);
  const [aceptaTope, setAceptaTope] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const mapaRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const prot = useMemo(() => {
    if (!ruta) return null;
    try {
      return protegerRuta(ruta.coords);
    } catch {
      return null;
    }
  }, [ruta]);

  // Mapa de vista previa: instancia propia (el overlay vive en un
  // portal a body, fuera del mapa grande). Un único efecto crea el
  // mapa si falta y dibuja la geometría protegida + zonas de extremo
  // (+ la original solo si el creador la muestra, opt-in).
  useEffect(() => {
    if (!abierto || !prot) return;
    const el = mapaRef.current;
    if (!el) return;
    if (!leafletRef.current) {
      leafletRef.current = L.map(el, { zoomControl: false, attributionControl: false });
      L.tileLayer("https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(leafletRef.current);
    }
    const m = leafletRef.current;
    const grupo = L.featureGroup();
    L.polyline(prot.coords.map((p) => [p.lat, p.lon] as [number, number]), { color: "#059669", weight: 4 }).addTo(grupo);
    if (verOriginal && ruta) L.polyline(ruta.coords.map((p) => [p.lat, p.lon] as [number, number]), { color: "#8b5cf6", weight: 3, dashArray: "6 6" }).addTo(grupo);
    L.circle([prot.inicioAprox.lat, prot.inicioAprox.lon], { radius: 150, color: "#059669", weight: 1, fillOpacity: 0.15 }).addTo(grupo);
    L.circle([prot.finAprox.lat, prot.finAprox.lon], { radius: 150, color: "#059669", weight: 1, fillOpacity: 0.15 }).addTo(grupo);
    grupo.addTo(m);
    // El mapa se acaba de crear: fitBounds difiere a whenReady — llamarlo
    // síncrono crashea (layerPointToLatLng sobre tamaño no calculado).
    m.whenReady(() => {
      try { m.fitBounds(grupo.getBounds(), { padding: [16, 16] }); } catch { /* bounds vacíos */ }
    });
    return () => {
      grupo.remove();
    };
  }, [abierto, prot, verOriginal, ruta]);

  if (!abierto || !ruta || !prot) return null;

  const topeExcedido = prot.registro.topeExcedido;
  const puedePublicar = revisada && (!topeExcedido || aceptaTope) && !enviando && !ruta.serverId;

  const publicar = async () => {
    if (!puedePublicar) return;
    setEnviando(true);
    setResultado(null);
    // Elevación: lo que el dispositivo tiene (eleM) viaja; si no hay,
    // el servidor la muestrea al publicar (eleFuente 'servicio').
    const eleM = ruta.eleM;
    const ele = eleM && eleM.length === ruta.coords.length
      ? (() => {
          let loss = 0;
          let prev: number | null = null;
          const validos = eleM.filter((e): e is number => e != null);
          for (const e of eleM) { if (e != null && prev != null && e < prev) loss += prev - e; if (e != null) prev = e; }
          return {
            gainM: ruta.gainM, lossM: Math.round(loss),
            minEle: validos.length ? Math.round(Math.min(...validos)) : null,
            maxEle: validos.length ? Math.round(Math.max(...validos)) : null,
          };
        })()
      : undefined;
    const r = await publicarRuta({
      nombre: ruta.nombre,
      descripcion: ruta.descripcion ?? null,
      modalidad: ruta.modalidad === "mtb" ? "montana" : "urbana",
      coords: prot.coords,
      attrs: ruta.attrs ?? [],
      dificultadFisica: ruta.dificultadFisica,
      dificultadTecnica: ruta.dificultadTecnica,
      proteccion: prot.registro as unknown as Record<string, unknown>,
      ele,
      eleFuente: ele ? (ruta.eleFuente ?? "gpx") : undefined,
      pois: (ruta.pois ?? []).map((p) => ({ lat: p.lat, lon: p.lon, tipo: p.tipo, nombre: p.nombre, nota: p.nota })),
    });
    setEnviando(false);
    if (r.ok) {
      borradores.actualizarBorrador(ruta.id, { ultimaRevisionAt: new Date().toISOString() });
      const lista = rutasStore.get();
      const idx = lista.findIndex((x) => x.id === ruta.id);
      if (idx >= 0) rutasStore.update(ruta.id, { serverId: r.id, publicadaAt: new Date().toISOString() });
      setResultado(t("pub.exito", String(r.version)));
    } else if (r.error === "encolada") {
      setResultado(t("pub.encolada"));
    } else {
      setResultado(r.error);
    }
  };

  const nivelLabel = (nivel: "A" | "B" | "C") => nivel === "A" ? t("pub.nivelA") : nivel === "B" ? t("pub.nivelB") : t("pub.nivelC");

  return (
    <div className="fixed inset-0 z-[910] flex flex-col bg-background/98 backdrop-blur" data-testid="publicar-overlay">
      <div className="flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2.5">
        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{t("pub.titulo")}</p>
        <button onClick={onClose} aria-label={t("pub.cerrar")} className="rounded-lg border border-border px-2 py-1 text-muted-foreground hover:border-red-400">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 pb-8">
        {/* Mapa de vista previa */}
        <div className="relative overflow-hidden rounded-xl border border-border" data-testid="pub-mapa">
          <div ref={mapaRef} className="h-56 w-full" />
          <label className="absolute left-2 top-2 z-[500] flex items-center gap-1.5 rounded-lg bg-card/95 px-2 py-1 text-[11px] font-bold text-foreground shadow">
            <input type="checkbox" checked={verOriginal} onChange={(e) => setVerOriginal(e.target.checked)} data-testid="pub-ver-original" />
            {t("pub.verOriginal")}
          </label>
        </div>

        {/* Recortes por extremo */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5" data-testid="pub-recortes">
          <div className="rounded-lg border border-border bg-card px-2 py-1.5">
            <p className="text-[9px] font-bold text-muted-foreground">{t("pub.recorteIni")}</p>
            <p className="text-xs font-bold text-foreground">−{prot.registro.ini.recorteM} m · {nivelLabel(prot.registro.ini.nivel)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-2 py-1.5">
            <p className="text-[9px] font-bold text-muted-foreground">{t("pub.recorteFin")}</p>
            <p className="text-xs font-bold text-foreground">−{prot.registro.fin.recorteM} m · {nivelLabel(prot.registro.fin.nivel)}</p>
          </div>
        </div>
        {topeExcedido && (
          <div className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300" data-testid="pub-tope-excedido">
            <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />{t("pub.topeExcedido")}
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <input type="checkbox" checked={aceptaTope} onChange={(e) => setAceptaTope(e.target.checked)} data-testid="pub-acepta-tope" />
              {t("pub.aceptaTope")}
            </label>
          </div>
        )}

        {/* Qué sale y qué no sale del dispositivo */}
        <div className="mt-2.5 rounded-lg border border-border bg-card p-2.5" data-testid="pub-datos">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t("pub.saleTitulo")}</p>
          <ul className="mt-1 grid gap-0.5 text-[11px] text-foreground/90">
            <li>· {t("pub.saleGeometria", String(prot.coords.length), String(ruta.coords.length))}</li>
            <li>· {t("pub.saleExtremos")}</li>
            <li>· {t("pub.saleMeta")}</li>
            <li>· {t("pub.saleDif")}</li>
            <li>· {t("pub.salePois", String(ruta.pois?.length ?? 0))}</li>
            <li>· {t("pub.saleElev")}</li>
          </ul>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("pub.noSaleTitulo")}</p>
          <ul className="mt-1 grid gap-0.5 text-[11px] text-muted-foreground">
            <li>· {t("pub.noSaleOriginal")}</li>
            <li>· {t("pub.noSaleExtremos")}</li>
          </ul>
        </div>

        {/* Confirmación obligatoria */}
        <label className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-2.5 py-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-200" data-testid="pub-revisada-wrap">
          <input type="checkbox" className="mt-0.5" checked={revisada} onChange={(e) => setRevisada(e.target.checked)} data-testid="pub-revisada" />
          {t("pub.revisada")}
        </label>

        <button
          onClick={publicar}
          disabled={!puedePublicar}
          className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white ${puedePublicar ? "bg-emerald-600 hover:bg-emerald-500" : "bg-muted-foreground/40"}`}
          data-testid="pub-confirmar"
        >
          <Send className="mr-1 inline h-4 w-4" />{enviando ? t("pub.publicando") : t("pub.publicar")}
        </button>
        {resultado && <p className="mt-2 rounded-lg bg-card px-2.5 py-2 text-[11px] text-foreground" data-testid="pub-resultado">{resultado}</p>}
      </div>
    </div>
  );
}

// Tipo exportado para la integración del mapa (bbox del viewport no se
// usa aquí, pero la ficha pública del catálogo sí lo necesita).
export type { BboxMapa };
