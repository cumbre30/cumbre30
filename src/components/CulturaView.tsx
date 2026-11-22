"use client";

// ============================================================
// CulturaView - módulo «Cultura Ciclista» (2026-11-22, mockup del
// cliente): biblioteca multimedia de libros, películas y
// documentales del ciclismo, con la identidad visual de Cumbre30.
//
//   · Hero + buscador + filtros por tipo y categoría + favoritos.
//   · Contenido destacado y carruseles horizontales por categoría
//     (scroll-snap con gestos táctiles, igual que el mockup).
//   · Ficha individual con portada, reseña editorial y ENLACE
//     EXTERNO legítimo (la app jamás simula reproducción/compra).
//   · Favoritos por usuario vía /api/cultura/favoritos.
//   · «Para tu perfil»: sugerencia complementaria según el
//     arquetipo del Perfil Ciclista (nunca restringe el catálogo).
//
// La fuente es SIEMPRE la base propia (/api/cultura/recursos):
// sin llamada a Google Books/TMDB/Open Library en línea — el módulo
// funciona aunque los proveedores externos estén caídos. Portadas:
// Open Library cuando existe (uso permitido con atribución, nota al
// pie) y portada procedural (paleta determinista por recurso) como
// respaldo, sin hotlink ni dependencia de terceros.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BookOpen, Clapperboard, Film, Heart, Search, Star, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang, t } from "@/lib/i18n";
import { apiUrl } from "@/lib/backend";
import { isOfflineMode } from "@/lib/offlineAuth";
import { serverToken, syncStore } from "@/lib/cloudSync";

export type CulturaRecursoCli = {
  id: string;
  titulo: string;
  resena: string;
  tipo: "libro" | "pelicula" | "documental";
  categorias: string[];
  portadaUrl: string | null;
  anio: string | null;
  autor: string;
  extra: string | null;
  pais: string | null;
  urlExterna: string;
  destacado: boolean;
};

const TIPOS = ["libro", "pelicula", "documental"] as const;
const CATEGORIAS = ["mtb", "aventura", "historia", "ruta", "entrenamiento", "personas"] as const;

const CAT_LABEL: Record<string, string> = {
  mtb: "cu.catMtb",
  aventura: "cu.catAventura",
  historia: "cu.catHistoria",
  ruta: "cu.catRuta",
  entrenamiento: "cu.catEntrenamiento",
  personas: "cu.catPersonas",
};

const TIPO_LABEL: Record<string, string> = {
  libro: "cu.chipLibros",
  pelicula: "cu.chipPeliculas",
  documental: "cu.chipDocumentales",
};

const TIPO_ICONO: Record<string, typeof BookOpen> = {
  libro: BookOpen,
  pelicula: Film,
  documental: Clapperboard,
};

// Paletas procedurales (mismo espíritu que las imágenes para
// compartir): gradiente por hash del id + tipo, sin terceros.
const PALETAS: Array<[string, string]> = [
  ["#052e22", "#0b3d2e"],
  ["#0f2e3d", "#0b4f4a"],
  ["#25301a", "#3d5320"],
  ["#301f2e", "#4a2b46"],
  ["#33260e", "#5a4318"],
  ["#1d2130", "#2e3a5c"],
];

const hashId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Portada: imagen de Open Library si existe; bajo ella, siempre,
 *  la portada procedural como respaldo (offline / sin licencia). */
function Portada({ rec, alto }: { rec: CulturaRecursoCli; alto: string }) {
  const [imgOk, setImgOk] = useState(true);
  const Icono = TIPO_ICONO[rec.tipo] ?? BookOpen;
  const [c1, c2] = PALETAS[hashId(rec.id) % PALETAS.length];
  return (
    <div className={`relative overflow-hidden ${alto}`} style={{ background: `linear-gradient(140deg, ${c1}, ${c2})` }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center">
        <Icono className="h-6 w-6 text-emerald-300/80" aria-hidden />
        <span className="line-clamp-3 text-[10px] font-bold leading-tight text-emerald-50/90">{rec.titulo}</span>
      </div>
      {rec.portadaUrl && imgOk && (
        // Portada de Open Library (uso permitido con atribución — nota al pie del módulo).
        <img
          src={rec.portadaUrl}
          alt={t("cu.portadaAlt", rec.titulo)}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** Fila de carrusel: scroll horizontal con snap (gestos táctiles).
 *  `accion` opcional: «Ver colección» filtra por esa categoría. */
function Rail({ titulo, sub, accion, children }: { titulo: string; sub?: string; accion?: { label: string; onClick: () => void }; children: ReactNode }) {
  return (
    <section className="mt-5" data-testid="cu-rail">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">{titulo}</h2>
          {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        {accion && (
          <button onClick={accion.onClick} className="shrink-0 text-[11px] font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400">
            {accion.label} →
          </button>
        )}
      </div>
      <div className="mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2">
        {children}
      </div>
    </section>
  );
}

function Tarjeta({ rec, guardado, onAbrir, onFav }: {
  rec: CulturaRecursoCli;
  guardado: boolean;
  onAbrir: () => void;
  onFav: () => void;
}) {
  const catLabel = rec.categorias[0] ? t(CAT_LABEL[rec.categorias[0]] ?? "") : "";
  return (
    // Div clicable (no <button> anidados): portada y corazón son botones propios.
    <div
      className="w-[148px] shrink-0 snap-start cursor-pointer"
      onClick={onAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onAbrir(); }}
      data-testid={`cu-card-${rec.tipo}`}
    >
        <div className="relative">
          <Portada rec={rec} alto="h-52 w-full rounded-xl border border-border" />
          <span className="absolute left-1.5 top-1.5 rounded-md border border-white/15 bg-background/80 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-foreground">
            {t(TIPO_LABEL[rec.tipo])}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onFav(); }}
            className={`absolute right-1.5 top-1.5 rounded-full border border-border bg-background/85 p-1.5 transition-colors ${guardado ? "text-emerald-500" : "text-foreground hover:border-emerald-500"}`}
            aria-label={guardado ? t("cu.fichaGuardado") : t("cu.fichaGuardar")}
            data-testid={`cu-fav-${rec.id}`}
          >
            <Heart className={`h-3.5 w-3.5 ${guardado ? "fill-current" : ""}`} aria-hidden />
          </button>
        </div>
        <h3 className="mt-1.5 truncate text-xs font-semibold text-foreground">{rec.titulo}</h3>
        <p className="truncate text-[10px] text-muted-foreground">
          {rec.anio ? `${rec.anio} · ` : ""}{catLabel}
        </p>
    </div>
  );
}

export function CulturaView() {
  useLang();
  const offline = isOfflineMode();
  const url = apiUrl("/api/cultura/recursos");
  const noBackend = url === null;
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.getServer);
  const hasSession = offline ? (!!serverToken() || sync.phase === "ok") : true;

  const [recursos, setRecursos] = useState<CulturaRecursoCli[] | null>(null);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tipoF, setTipoF] = useState<string | null>(null);
  const [catF, setCatF] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [ficha, setFicha] = useState<CulturaRecursoCli | null>(null);
  const [paraTi, setParaTi] = useState<string[] | null>(null);
  const catalogoRef = useRef<HTMLDivElement | null>(null);

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (offline) {
      const tok = serverToken();
      if (tok) h.Authorization = `Bearer ${tok}`;
    }
    return h;
  }, [offline]);

  const cargar = useCallback(async () => {
    if (url === null) { setCargando(false); return; }
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(url, { headers: headers() });
      if (!r.ok) {
        setError(`${r.status}`);
        setRecursos((p) => p ?? []);
        return;
      }
      const d = (await r.json()) as { recursos?: CulturaRecursoCli[]; favoritos?: string[] };
      setRecursos(d.recursos ?? []);
      setFavoritos(new Set(d.favoritos ?? []));
    } catch {
      setError("red");
      setRecursos((p) => p ?? []);
    } finally {
      setCargando(false);
    }
  }, [url, headers]);

  useEffect(() => { if (hasSession) void cargar(); }, [hasSession, cargar]);

  // Personalización complementaria: arquetipo → categorías sugeridas.
  // Falla en silencio: nunca restringe el acceso al catálogo completo.
  useEffect(() => {
    const urlPerfil = apiUrl("/api/profile");
    if (urlPerfil === null) return;
    (async () => {
      try {
        const r = await fetch(urlPerfil, { headers: headers() });
        if (!r.ok) return;
        const d = (await r.json()) as { perfil?: { archetype?: string; calibrating?: boolean; scores?: { explorer?: number | null } } };
        const a = d.perfil?.archetype;
        const scores = d.perfil?.scores;
        if (!a || d.perfil?.calibrating || a === "CALIBRATING") return;
        const mapa: Record<string, string[]> = {
          CLIMBER: ["ruta", "mtb"],
          ENDURANCE: ["aventura", "ruta"],
          EXPLORER: ["aventura", "mtb"],
          URBAN: ["historia", "personas"],
          TIME_TRIALIST: ["ruta", "historia"],
          SPRINTER: ["ruta", "historia"],
        };
        const cats = new Set(mapa[a] ?? []);
        if ((scores?.explorer ?? 0) >= 70) cats.add("aventura");
        if (cats.size > 0) setParaTi([...cats]);
      } catch {
        // sin sugerencia: el catálogo completo sigue intacto
      }
    })();
  }, [headers]);

  const toggleFav = useCallback(async (rec: CulturaRecursoCli) => {
    if (url === null) return;
    const yaGuardado = favoritos.has(rec.id);
    setFavoritos((p) => {
      const n = new Set(p);
      if (yaGuardado) n.delete(rec.id); else n.add(rec.id);
      return n;
    });
    try {
      const urlFav = apiUrl("/api/cultura/favoritos");
      if (urlFav === null) throw new Error("sin backend");
      const r = yaGuardado
        ? await fetch(`${urlFav}?recursoId=${encodeURIComponent(rec.id)}`, { method: "DELETE", headers: headers() })
        : await fetch(urlFav, { method: "POST", headers: headers(), body: JSON.stringify({ recursoId: rec.id }) });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      // revertir el corazón si el servidor no confirmó
      setFavoritos((p) => {
        const n = new Set(p);
        if (yaGuardado) n.add(rec.id); else n.delete(rec.id);
        return n;
      });
    }
  }, [favoritos, url, headers]);

  // Escape cierra la ficha (igual que el mockup).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFicha(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    if (!recursos) return [];
    const ql = q.trim().toLowerCase();
    return recursos.filter((r) => {
      if (favOnly && !favoritos.has(r.id)) return false;
      if (tipoF && r.tipo !== tipoF) return false;
      if (catF && !r.categorias.includes(catF)) return false;
      if (ql && !(`${r.titulo} ${r.autor}`.toLowerCase().includes(ql))) return false;
      return true;
    });
  }, [recursos, q, tipoF, catF, favOnly, favoritos]);

  const filtradoActivo = q.trim() !== "" || tipoF !== null || catF !== null || favOnly;

  const destacados = useMemo(() => (recursos ?? []).filter((r) => r.destacado).slice(0, 2), [recursos]);
  const paraTiRecs = useMemo(() => {
    if (!recursos || !paraTi) return [];
    return recursos.filter((r) => r.categorias.some((c) => paraTi.includes(c))).slice(0, 10);
  }, [recursos, paraTi]);

  const abrirColeccion = (filtro: { tipo?: string; cat?: string }) => {
    setTipoF(filtro.tipo ?? null);
    setCatF(filtro.cat ?? null);
    setFavOnly(false);
    setQ("");
    catalogoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (noBackend) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="mt-2 text-sm font-bold text-foreground">{t("menu.cultura")}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-snug text-muted-foreground">{t("cu.noBackend")}</p>
        </div>
      </div>
    );
  }

  const favSet = favoritos;

  return (
    <div className="flex flex-col pb-6">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-950 via-emerald-900/60 to-card p-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-emerald-500/20" aria-hidden />
        <div className="absolute -right-4 top-16 h-28 w-28 rounded-full border border-emerald-500/10" aria-hidden />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">{t("cu.heroEyebrow")}</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-foreground">{t("cu.heroTitulo")}</h1>
        <p className="mt-2 max-w-md text-[13px] leading-snug text-muted-foreground">{t("cu.heroCuerpo")}</p>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => catalogoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="h-9 rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-500"
            data-testid="cu-cta-explorar"
          >
            {t("cu.heroCta")}
          </Button>
          <Button
            onClick={() => { setFavOnly(true); setTipoF(null); setCatF(null); setQ(""); catalogoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            variant="outline"
            className={`h-9 rounded-full font-bold ${favOnly ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : ""}`}
          >
            <Heart className={`mr-1.5 h-4 w-4 ${favOnly ? "fill-current" : ""}`} aria-hidden />
            {t("cu.favoritosCta")}
          </Button>
        </div>
      </section>

      {/* ---------- Buscador + filtros ---------- */}
      <div ref={catalogoRef} className="mt-4 flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("cu.buscarPh")}
            className="border-border bg-card pl-9"
            aria-label={t("cu.buscarPh")}
            data-testid="cu-buscador"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("cu.filtroTipoAria")}>
          <button onClick={() => { setTipoF(null); setFavOnly(false); }} className={chip(tipoF === null && !favOnly)}>{t("cu.chipTodo")}</button>
          {TIPOS.map((tp) => (
            <button key={tp} onClick={() => { setTipoF(tp); setFavOnly(false); }} className={chip(tipoF === tp)}>{t(TIPO_LABEL[tp])}</button>
          ))}
          <button onClick={() => { setFavOnly(true); setTipoF(null); setCatF(null); setQ(""); }} className={chip(favOnly)}>
            <Heart className={`inline h-3 w-3 ${favOnly ? "fill-current" : ""}`} aria-hidden /> {t("cu.favoritosCta")}
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("cu.filtroCatAria")}>
          <button onClick={() => setCatF(null)} className={chip(catF === null)}>{t("cu.catTodas")}</button>
          {CATEGORIAS.map((c) => (
            <button key={c} onClick={() => setCatF(c)} className={chip(catF === c)}>{t(CAT_LABEL[c])}</button>
          ))}
        </div>
      </div>

      {/* ---------- Estados: carga / error ---------- */}
      {cargando && (
        <div className="mt-5 grid grid-cols-3 gap-2.5" data-testid="cu-cargando">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-muted/40">
              <div className="h-40 rounded-t-xl" />
              <div className="h-3 w-3/4 m-2 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      )}
      {!cargando && error && (
        <div className="mt-5 rounded-2xl border border-red-500/40 bg-card p-5 text-center" data-testid="cu-error">
          <p className="text-sm font-bold text-foreground">{t("cu.errorTitulo")}</p>
          <Button onClick={() => void cargar()} className="mt-3 h-9 bg-emerald-600 font-bold text-white hover:bg-emerald-500">
            {t("cfg.reintentar")}
          </Button>
        </div>
      )}

      {/* ---------- Contenido ---------- */}
      {!cargando && !error && recursos !== null && (
        <>
          {filtradoActivo ? (
            <section className="mt-5" data-testid="cu-resultados">
              <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">
                {favOnly ? t("cu.favoritosTitulo") : t("cu.resultadosTitulo")}
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t("cu.resultadosSub", matches.length)}</p>
              {matches.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{t("cu.sinResultados")}</p>
              ) : (
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {matches.map((rec) => (
                    <div key={rec.id} className="min-w-0">
                      <button onClick={() => setFicha(rec)} className="block w-full text-left">
                        <div className="relative">
                          <Portada rec={rec} alto="h-36 w-full rounded-lg border border-border" />
                          <span className="absolute left-1 top-1 rounded-md border border-white/15 bg-background/80 px-1 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-foreground">
                            {t(TIPO_LABEL[rec.tipo])}
                          </span>
                        </div>
                        <h3 className="mt-1 truncate text-[11px] font-semibold text-foreground">{rec.titulo}</h3>
                      </button>
                      <button
                        onClick={() => void toggleFav(rec)}
                        className={`mt-0.5 ${favoritos.has(rec.id) ? "text-emerald-500" : "text-muted-foreground"}`}
                        aria-label={favoritos.has(rec.id) ? t("cu.fichaGuardado") : t("cu.fichaGuardar")}
                      >
                        <Heart className={`h-3.5 w-3.5 ${favoritos.has(rec.id) ? "fill-current" : ""}`} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {favOnly && matches.length === 0 && (
                <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{t("cu.favoritosVacio")}</p>
              )}
            </section>
          ) : (
            <>
              {/* Destacados */}
              {destacados.length === 2 && (
                <section className="mt-5" data-testid="cu-destacados">
                  <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">{t("cu.destacadosTitulo")}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t("cu.destacadosSub")}</p>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                    {destacados.map((rec) => (
                      <div key={rec.id} className="flex overflow-hidden rounded-2xl border border-border bg-card">
                        <button onClick={() => setFicha(rec)} className="w-[104px] shrink-0" aria-label={rec.titulo}>
                          <Portada rec={rec} alto="h-full min-h-[132px]" />
                        </button>
                        <div className="min-w-0 flex-1 p-3.5">
                          <p className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.13em] text-emerald-600 dark:text-emerald-400">
                            <Star className="h-3 w-3 fill-current" aria-hidden /> {t("cu.destacadoTag")} · {t(TIPO_LABEL[rec.tipo])}
                          </p>
                          <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-foreground">{rec.titulo}</h3>
                          <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-muted-foreground">{rec.resena}</p>
                          <button onClick={() => setFicha(rec)} className="mt-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400">
                            {t("cu.conocerMas")} →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Para tu perfil (complementario) */}
              {paraTiRecs.length > 0 && (
                <Rail titulo={t("cu.paraTi")} sub={t("cu.paraTiSub")}>
                  {paraTiRecs.map((rec) => (
                    <Tarjeta key={rec.id} rec={rec} guardado={favSet.has(rec.id)} onAbrir={() => setFicha(rec)} onFav={() => void toggleFav(rec)} />
                  ))}
                </Rail>
              )}

              {/* Carruseles por categoría (tipo y temática) */}
              <Rail titulo={t("cu.chipLibros")} sub={t("cu.railLibrosSub")} accion={{ label: t("cu.verColeccion"), onClick: () => abrirColeccion({ tipo: "libro" }) }}>
                {(recursos ?? []).filter((r) => r.tipo === "libro").map((rec) => (
                  <Tarjeta key={rec.id} rec={rec} guardado={favSet.has(rec.id)} onAbrir={() => setFicha(rec)} onFav={() => void toggleFav(rec)} />
                ))}
              </Rail>
              <Rail titulo={t("cu.chipPeliculas")} sub={t("cu.railPeliculasSub")} accion={{ label: t("cu.verColeccion"), onClick: () => abrirColeccion({ tipo: "pelicula" }) }}>
                {(recursos ?? []).filter((r) => r.tipo === "pelicula").map((rec) => (
                  <Tarjeta key={rec.id} rec={rec} guardado={favSet.has(rec.id)} onAbrir={() => setFicha(rec)} onFav={() => void toggleFav(rec)} />
                ))}
              </Rail>
              <Rail titulo={t("cu.chipDocumentales")} sub={t("cu.railDocumentalesSub")} accion={{ label: t("cu.verColeccion"), onClick: () => abrirColeccion({ tipo: "documental" }) }}>
                {(recursos ?? []).filter((r) => r.tipo === "documental").map((rec) => (
                  <Tarjeta key={rec.id} rec={rec} guardado={favSet.has(rec.id)} onAbrir={() => setFicha(rec)} onFav={() => void toggleFav(rec)} />
                ))}
              </Rail>
              {([
                { cat: "mtb" as const, sub: "cu.railMtbSub" },
                { cat: "aventura" as const, sub: "cu.railAventuraSub" },
                { cat: "historia" as const, sub: "cu.railHistoriaSub" },
              ]).map(({ cat, sub }) => (
                <Rail key={cat} titulo={t(CAT_LABEL[cat])} sub={t(sub)} accion={{ label: t("cu.verColeccion"), onClick: () => abrirColeccion({ cat }) }}>
                  {(recursos ?? []).filter((r) => r.categorias.includes(cat)).map((rec) => (
                    <Tarjeta key={rec.id} rec={rec} guardado={favSet.has(rec.id)} onAbrir={() => setFicha(rec)} onFav={() => void toggleFav(rec)} />
                  ))}
                </Rail>
              ))}

              <p className="mt-5 text-center text-[10px] leading-relaxed text-muted-foreground">{t("cu.footNota")}</p>
            </>
          )}
        </>
      )}

      {/* ---------- Ficha individual ---------- */}
      {ficha && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFicha(null); }}
          role="dialog"
          aria-modal="true"
          aria-label={ficha.titulo}
          data-testid="cu-ficha"
        >
          <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card">
            <button
              onClick={() => setFicha(null)}
              className="absolute right-2.5 top-2.5 z-10 rounded-full border border-border bg-background/90 p-2 text-foreground"
              aria-label={t("edu.cerrar")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <div className="relative">
              <Portada rec={ficha} alto="h-56 w-full rounded-t-2xl" />
              <span className="absolute left-2.5 top-2.5 rounded-md border border-white/15 bg-background/80 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-foreground">
                {t(TIPO_LABEL[ficha.tipo])}
              </span>
            </div>
            <div className="p-5">
              <h2 className="text-xl font-extrabold leading-tight tracking-tight text-foreground">{ficha.titulo}</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ficha.anio ? `${ficha.anio} · ` : ""}{ficha.autor}{ficha.pais ? ` · ${ficha.pais}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ficha.categorias.map((c) => (
                  <span key={c} className="rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {t(CAT_LABEL[c] ?? "")}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-foreground/90">{ficha.resena}</p>
              {ficha.extra && <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{ficha.extra}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={ficha.urlExterna}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-500"
                >
                  {t("cu.fichaConsultar")} ↗
                </a>
                <Button
                  onClick={() => void toggleFav(ficha)}
                  variant="outline"
                  className="h-9 rounded-full font-bold"
                >
                  <Heart className={`mr-1.5 h-4 w-4 ${favSet.has(ficha.id) ? "fill-current text-emerald-500" : ""}`} aria-hidden />
                  {favSet.has(ficha.id) ? t("cu.fichaGuardado") : t("cu.fichaGuardar")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function chip(activo: string | boolean): string {
  return `shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
    activo
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-border bg-card text-muted-foreground hover:border-emerald-500"
  }`;
}
