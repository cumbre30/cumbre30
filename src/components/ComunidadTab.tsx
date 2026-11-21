"use client";

// ============================================================
// Sección COMUNIDAD de la ficha pública (fase E, v2.1 §6-§7.4):
// favorito (toggle), valoración 1-5 (comodidad — no ranking),
// comentarios con soft-delete propio, experiencias con condiciones
// tipificadas (máx 3, una por día) y reporte con motivo cerrado.
// El contenido comunitario va etiquetado y NUNCA toca los datos
// oficiales de la ruta. Sin sesión: mensajes honestos.
// ============================================================

import { useRef, useState } from "react";
import { Heart, Star, MessageSquare, Flag, Trash2, Send, ImagePlus, X } from "lucide-react";
import {
  toggleFavorito, valorarRuta, comentarRuta, borrarComentario,
  reportarRuta, registrarExperiencia, agregarFotoExperiencia,
  type MotivoReporteCli,
} from "@/lib/rutasApi";
import { escalarFoto } from "@/lib/fotoExperiencia";
import { useProLicense } from "@/lib/proLicense";
import { t, useLang } from "@/lib/i18n";

export type DatosComunidad = {
  comentarios: { id: string; body: string; createdAt: string; username: string }[];
  experiencias: { id: string; fechaRealizacion: string; comentario: string | null; observacion: string | null; condiciones: string[]; username: string; pro?: boolean; fotos?: string[] }[];
  valoracionPromedio: number | null;
  valoracionVotos: number;
  favoritos: number;
  miFavorito: boolean;
  miValoracion: number | null;
};

const MOTIVOS_CLI: { id: MotivoReporteCli; clave: string }[] = [
  { id: "cierre", clave: "com.motivo.cierre" },
  { id: "peligro", clave: "com.motivo.peligro" },
  { id: "error_geografico", clave: "com.motivo.error" },
  { id: "spam", clave: "com.motivo.spam" },
  { id: "contenido_inapropiado", clave: "com.motivo.inapropiado" },
];

// Condiciones tipificadas de las experiencias (§6) con su etiqueta
// i18n. Fuente ÚNICA compartida: la usa el formulario de la ficha y
// el muro de experiencias de Explorar (mismo enumerado cerrado).
export const CONDICIONES = [
  { id: "camino_ok", clave: "com.cond.camino_ok" }, { id: "tramo_cerrado", clave: "com.cond.tramo_cerrado" },
  { id: "barro", clave: "com.cond.barro" }, { id: "mucho_trafico", clave: "com.cond.trafico" },
  { id: "sombra", clave: "com.cond.sombra" }, { id: "agua", clave: "com.cond.agua" },
  { id: "otro", clave: "com.cond.otro" },
];

export default function ComunidadTab({ rutaId, datos }: { rutaId: string; datos: DatosComunidad }) {
  useLang();
  const { pro } = useProLicense();
  const MAX_FOTOS = pro.active ? 6 : 1;
  const [favorito, setFavorito] = useState(datos.miFavorito);
  const [favoritos, setFavoritos] = useState(datos.favoritos);
  const [miNota, setMiNota] = useState<number | null>(datos.miValoracion);
  const [promedio, setPromedio] = useState(datos.valoracionPromedio);
  const [votos, setVotos] = useState(datos.valoracionVotos);
  const [comentarios, setComentarios] = useState(datos.comentarios);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [experiencias, setExperiencias] = useState(datos.experiencias);
  const [expComentario, setExpComentario] = useState("");
  const [expCondiciones, setExpCondiciones] = useState<string[]>([]);
  const [expFecha, setExpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [fotosPendientes, setFotosPendientes] = useState<string[]>([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const [reporteAbierto, setReporteAbierto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoReporteCli>("cierre");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const avisar = (m: string) => { setMensaje(m); setTimeout(() => setMensaje(null), 3500); };

  /** Escala la foto elegida y la encola si hay cupo (FREE 1 · PRO 6). */
  const onElegirFoto = async (file: File | undefined) => {
    if (!file) return;
    if (inputFotoRef.current) inputFotoRef.current.value = "";
    if (fotosPendientes.length >= MAX_FOTOS) {
      avisar(pro.active ? t("com.fotoLimite") : t("com.fotoSoloUna"));
      return;
    }
    try {
      const dataUrl = await escalarFoto(file);
      setFotosPendientes((l) => (l.length < MAX_FOTOS ? [...l, dataUrl] : l));
    } catch {
      avisar(t("com.fotoError"));
    }
  };

  const onFavorito = async () => {
    const r = await toggleFavorito(rutaId);
    if (r.ok) { setFavorito(!!r.favorito); setFavoritos((v) => v + (r.favorito ? 1 : -1)); }
    else avisar(r.error ?? "");
  };
  const onValorar = async (valor: number) => {
    const r = await valorarRuta(rutaId, valor);
    if (r.ok) { setMiNota(valor); setPromedio(r.promedio ?? null); setVotos(r.votos ?? votos); }
    else avisar(r.error ?? "");
  };
  const onComentar = async () => {
    if (!nuevoComentario.trim()) return;
    const r = await comentarRuta(rutaId, nuevoComentario.trim());
    if (r.ok) {
      setComentarios((l) => [{ id: r.id ?? "", body: nuevoComentario.trim(), createdAt: new Date().toISOString(), username: "" }, ...l]);
      setNuevoComentario("");
    } else avisar(r.error ?? "");
  };
  const onBorrarComentario = async (cid: string) => {
    const r = await borrarComentario(rutaId, cid);
    if (r.ok) setComentarios((l) => l.filter((c) => c.id !== cid));
    else avisar(r.error ?? "");
  };
  const onExperiencia = async () => {
    const r = await registrarExperiencia(rutaId, {
      fechaRealizacion: expFecha,
      comentario: expComentario.trim() || undefined,
      condiciones: expCondiciones,
    });
    if (r.ok) {
      const idNueva = r.id ?? "";
      setExperiencias((l) => [{ id: idNueva, fechaRealizacion: expFecha, comentario: expComentario.trim() || null, observacion: null, condiciones: expCondiciones, username: "", fotos: [] }, ...l]);
      setExpComentario(""); setExpCondiciones([]);
      // Fotos (Grupo A): se suben DESPUÉS de crear la experiencia; el
      // límite real lo decide el servidor (registro de compras).
      if (fotosPendientes.length > 0 && idNueva) {
        setSubiendoFotos(true);
        const urls: string[] = [];
        for (const f of fotosPendientes) {
          const fr = await agregarFotoExperiencia(rutaId, idNueva, f);
          if (fr.ok) urls.push(f);
          else avisar(fr.error ?? t("com.fotoError"));
        }
        setSubiendoFotos(false);
        setFotosPendientes([]);
        if (urls.length > 0) {
          setExperiencias((l) => l.map((e) => (e.id === idNueva ? { ...e, fotos: urls } : e)));
        }
      }
      avisar(t("com.expGuardada"));
    } else avisar(r.error ?? "");
  };
  const onReportar = async () => {
    const r = await reportarRuta(rutaId, motivo);
    setReporteAbierto(false);
    if (r.ok) {
      if (r.ocultada) avisar(t("com.ocultada"));
      else if (r.loteSospechoso) avisar(t("com.aCola"));
      else avisar(t("com.reporteOk"));
    } else avisar(r.error ?? "");
  };

  return (
    <div className="mt-3 border-t border-border/60 pt-2.5" data-testid="comunidad">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("com.titulo")}</p>

      {/* Favorito + valoración */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          onClick={onFavorito}
          className={`rounded-xl px-2.5 py-1.5 text-xs font-bold ${favorito ? "bg-rose-600 text-white" : "border border-border bg-card text-foreground hover:border-rose-400"}`}
          data-testid="com-favorito"
        >
          <Heart className={`mr-1 inline h-3.5 w-3.5 ${favorito ? "fill-current" : ""}`} />{favoritos}
        </button>
        <span className="text-xs text-muted-foreground">
          {promedio != null ? `★ ${promedio} · ${votos}` : t("com.sinValoraciones")}
        </span>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => onValorar(v)}
            aria-label={`${t("com.valorar")} ${v}`}
            className="text-base leading-none"
            data-testid={`com-estrella-${v}`}
          >
            <Star className={`h-4 w-4 ${(miNota ?? 0) >= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>

      {/* Reporte */}
      <div className="mt-2">
        {!reporteAbierto ? (
          <button onClick={() => setReporteAbierto(true)} className="text-[11px] text-muted-foreground underline hover:text-amber-600" data-testid="com-abrir-reporte">
            <Flag className="mr-1 inline h-3 w-3" />{t("com.reportar")}
          </button>
        ) : (
          <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-2" data-testid="com-reporte-box">
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{t("com.reportarInfo")}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {MOTIVOS_CLI.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMotivo(m.id)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${motivo === m.id ? "bg-amber-600 text-white" : "border border-border bg-card text-foreground"}`}
                >
                  {t(m.clave)}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <button onClick={onReportar} className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white" data-testid="com-enviar-reporte">{t("com.enviarReporte")}</button>
              <button onClick={() => setReporteAbierto(false)} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{t("bib.cerrar")}</button>
            </div>
          </div>
        )}
      </div>

      {/* Experiencias (contenido comunitario, etiquetado) */}
      <div className="mt-3">
        <p className="text-[10px] font-bold text-muted-foreground">{t("com.expTitulo")} <span className="font-normal">· {t("com.expEtiqueta")}</span></p>
        <div className="mt-1 rounded-lg border border-border bg-card p-2">
          <input type="date" value={expFecha} onChange={(e) => setExpFecha(e.target.value)} className="rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground" data-testid="com-exp-fecha" />
          <input value={expComentario} onChange={(e) => setExpComentario(e.target.value)} placeholder={t("com.expPlaceholder")} className="mt-1 w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground" data-testid="com-exp-texto" />
          <div className="mt-1 flex flex-wrap gap-1">
            {CONDICIONES.map((c) => (
              <button
                key={c.id}
                onClick={() => setExpCondiciones((l) => l.includes(c.id) ? l.filter((x) => x !== c.id) : l.length < 3 ? [...l, c.id] : l)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${expCondiciones.includes(c.id) ? "bg-emerald-600 text-white" : "border border-border bg-card text-muted-foreground"}`}
              >
                {t(c.clave)}
              </button>
            ))}
          </div>
          {/* Fotos (Grupo A): FREE 1 · PRO hasta 6 — el cliente escala
              (canvas → JPEG) y el servidor decide el límite final. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {fotosPendientes.map((f, i) => (
              <span key={`foto-${i}`} className="relative inline-block" data-testid="com-foto-preview">
                <img src={f} alt={t("com.fotoAlt")} className="h-12 w-16 rounded-md object-cover" />
                <button
                  onClick={() => setFotosPendientes((l) => l.filter((_, j) => j !== i))}
                  aria-label={t("com.fotoQuitar")}
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-foreground text-background"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {fotosPendientes.length < MAX_FOTOS && (
              <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-bold text-muted-foreground hover:border-emerald-500 hover:text-foreground" data-testid="com-foto-agregar">
                <ImagePlus className="h-3 w-3" />
                {t("com.fotoAgregar")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void onElegirFoto(e.target.files?.[0])} ref={inputFotoRef} />
              </label>
            )}
            <span className="text-[9px] text-muted-foreground">{t("com.fotoProNota")}</span>
          </div>
          <button onClick={onExperiencia} disabled={subiendoFotos} className="mt-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-60" data-testid="com-exp-guardar">
            <Send className="mr-1 inline h-3 w-3" />{subiendoFotos ? t("com.fotoSubiendo") : t("com.expGuardar")}
          </button>
        </div>
        <ul className="mt-1.5 grid gap-1">
          {experiencias.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-card/60 px-2 py-1.5" data-testid="com-experiencia">
              <p className="text-[10px] font-bold text-foreground">
                {e.username || t("com.usuario")}
                {e.pro && <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t("ex.muroPro")}</span>}
                <span className="font-normal"> · {e.fechaRealizacion}</span>
              </p>
              {e.comentario && <p className="text-[11px] text-foreground/90">{e.comentario}</p>}
              {e.condiciones.length > 0 && (
                <p className="mt-0.5 flex flex-wrap gap-1">
                  {e.condiciones.map((c) => (
                    <span key={c} className="rounded-full bg-emerald-600/10 px-1.5 py-px text-[9px] font-bold text-emerald-700 dark:text-emerald-300">{t(`com.cond.${c}`)}</span>
                  ))}
                </p>
              )}
              {e.fotos && e.fotos.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {e.fotos.map((u, i) => (
                    <img key={`f${i}`} src={u} alt={t("com.fotoAlt")} loading="lazy" className="h-14 w-20 rounded-md object-cover" />
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Comentarios */}
      <div className="mt-3">
        <p className="text-[10px] font-bold text-muted-foreground"><MessageSquare className="mr-1 inline h-3 w-3" />{t("com.comentarios")} ({comentarios.length})</p>
        <div className="mt-1 flex gap-1.5">
          <input
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void onComentar(); }}
            placeholder={t("com.comentarioPlaceholder")}
            maxLength={1000}
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"
            data-testid="com-input"
          />
          <button onClick={onComentar} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white" data-testid="com-enviar">{t("com.enviar")}</button>
        </div>
        <ul className="mt-1.5 grid gap-1">
          {comentarios.map((c) => (
            <li key={c.id} className="flex items-start gap-1.5 rounded-lg border border-border bg-card/60 px-2 py-1.5" data-testid="com-comentario">
              <span className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-foreground">{c.username || t("com.usuario")}</span>
                <span className="block text-[11px] text-foreground/90">{c.body}</span>
              </span>
              <button onClick={() => onBorrarComentario(c.id)} aria-label={t("com.borrar")} className="shrink-0 text-muted-foreground hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {mensaje && <p className="mt-2 rounded-lg bg-card px-2 py-1.5 text-[11px] text-foreground" data-testid="com-mensaje">{mensaje}</p>}
    </div>
  );
}
