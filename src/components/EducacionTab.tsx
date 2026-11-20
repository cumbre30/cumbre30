"use client";

// ============================================================
// Centro de Educación Ciclista (CEC) - pantalla del menú lateral
// (zona «Aprende»). 14 módulos del mockup aprobado (datos en
// lib/educacionData.ts): chips de categoría + búsqueda, ficha
// con cuerpo/recomendaciones/fuentes/quiz y progreso persistente
// en el teléfono (localStorage c30.educacion). El contenido de
// los módulos es en español (normativa chilena citada verbatim);
// los textos de interfaz vía i18n (claves edu.* y cat.*).
// ============================================================

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  BookOpen,
  Compass,
  GraduationCap,
  Mountain,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CEC_CATS, CEC_MODULOS, type ModuloCEC } from "@/lib/educacionData";
import { t, useLang } from "@/lib/i18n";

/** Progreso del centro en el teléfono (c30.educacion). */
type EduState = { done: string[]; quiz: string[] };
const LS_EDU = "c30.educacion";
/** Snapshot del servidor / sin datos (referencia estable). */
const EDU_VACIO: EduState = { done: [], quiz: [] };
/** Módulos que activan cada insignia temática. */
const INS_NORMATIVA = ["CEC-003", "CEC-004", "CEC-013", "CEC-014"];
const INS_MONTANA = ["CEC-009", "CEC-010"];

// ---- store externo del progreso (mismo patrón que historyStore):
// lectura desde localStorage con caché y notificación a suscriptores ----
let eduCache: EduState | null = null;
const eduListeners = new Set<() => void>();

function leeEstado(): EduState {
  try {
    const raw = window.localStorage.getItem(LS_EDU);
    if (raw) {
      const p = JSON.parse(raw) as Partial<EduState>;
      if (Array.isArray(p.done) && Array.isArray(p.quiz)) {
        return {
          done: p.done.filter((x): x is string => typeof x === "string"),
          quiz: p.quiz.filter((x): x is string => typeof x === "string"),
        };
      }
    }
  } catch {
    // sin localStorage (SSR / privado): empieza de cero
  }
  return EDU_VACIO;
}

function eduGet(): EduState {
  if (!eduCache) eduCache = leeEstado();
  return eduCache;
}

function eduSuscribir(fn: () => void): () => void {
  eduListeners.add(fn);
  return () => eduListeners.delete(fn);
}

function eduGuardar(nuevo: EduState): void {
  eduCache = nuevo;
  try {
    window.localStorage.setItem(LS_EDU, JSON.stringify(nuevo));
  } catch {
    // sin persistencia disponible: solo estado en memoria
  }
  for (const fn of eduListeners) fn();
}

/** Insignia del centro: icono lucide + etiqueta i18n + condición. */
function Insignia({
  icono,
  clave,
  on,
}: {
  icono: React.ReactNode;
  clave: string;
  on: boolean;
}) {
  return (
    <span
      aria-label={t(clave)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
        on
          ? "border-emerald-600/60 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
          : "border-border text-muted-foreground/70"
      }`}
    >
      {icono} {t(clave)}
    </span>
  );
}

/** Ficha de un módulo (overlay inferior, mismo patrón del modal vehicular). */
function FichaModulo({
  mod,
  done,
  quizHecho,
  onToggleDone,
  onQuizOk,
  onClose,
}: {
  mod: ModuloCEC;
  done: boolean;
  quizHecho: boolean;
  onToggleDone: () => void;
  onQuizOk: (id: string) => void;
  onClose: () => void;
}) {
  useLang();
  // Elección del quiz del módulo abierto: null = sin responder
  const [elegida, setElegida] = useState<number | null>(null);
  const quizOk = quizHecho || (elegida !== null && elegida === mod.quiz?.ok);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-label={mod.titulo}
    >
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Encabezado fijo */}
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[20px]">
            {mod.icono}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-snug tracking-tight text-foreground">{mod.titulo}</h3>
            <p className="text-[11px] text-muted-foreground">
              {mod.id} · {t(`edu.nivel.${mod.nivel}`)} · {t(`cat.${mod.cat}`)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("edu.cerrar")}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{mod.desc}</p>

          <ul className="mt-3 space-y-2">
            {mod.cuerpo.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-foreground">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          {mod.recos.length > 0 && (
            <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-600/40 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-foreground/90">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
              <span>
                <b className="block text-[12px] text-amber-700 dark:text-amber-300">{t("edu.recos")}</b>
                {mod.recos.map((r, i) => (
                  <span key={i} className="block">
                    · {r}
                  </span>
                ))}
              </span>
            </div>
          )}

          {mod.quiz && (
            <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {t("edu.quizTitulo")}
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground">{mod.quiz.q}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {mod.quiz.alt.map((a, i) => {
                  const correcta = i === mod.quiz!.ok;
                  const eleccion = elegida === i;
                  const estilos = quizOk && correcta
                    ? "border-emerald-600 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                    : eleccion
                      ? "border-red-600/70 bg-red-600/10 text-foreground"
                      : "border-border text-foreground hover:bg-accent";
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setElegida(i);
                        if (correcta) onQuizOk(mod.id);
                      }}
                      aria-pressed={eleccion}
                      className={`rounded-lg border px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${estilos}`}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
              {elegida !== null && (
                <div className="mt-2 text-[12px] leading-relaxed">
                  <b className={quizOk ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}>
                    {quizOk ? t("edu.quizOk") : t("edu.quizMal")}
                  </b>
                  <span className="block text-muted-foreground">{mod.quiz.exp}</span>
                </div>
              )}
            </div>
          )}

          {mod.refs.length > 0 && (
            <div className="mt-3">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted-foreground">
                {t("edu.refs")}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {mod.refs.map((ref, i) => (
                  <li key={i} className="rounded-lg border border-border bg-muted/30 p-2.5 text-[12px] leading-relaxed">
                    <b className="text-foreground">{ref.t}</b>
                    <span className="block text-muted-foreground">{ref.f}</span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {t("edu.revision")}: {ref.r}
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/50 bg-emerald-600/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="h-3 w-3" aria-hidden /> {ref.v}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pie: marcar completado */}
        <div className="border-t border-border px-4 py-3">
          <Button
            onClick={onToggleDone}
            variant={done ? "outline" : "default"}
            className={`h-11 w-full rounded-xl text-[14px] font-bold ${
              done
                ? "border-emerald-600/60 bg-card text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/10"
                : "bg-emerald-600 text-(--c30-on-accent) hover:bg-emerald-500"
            }`}
          >
            <BadgeCheck className="h-5 w-5" aria-hidden /> {done ? t("edu.marcado") : t("edu.marcar")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EducacionTab() {
  useLang();
  const estado = useSyncExternalStore(eduSuscribir, eduGet, () => EDU_VACIO);
  const [cat, setCat] = useState<string>("todas");
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<ModuloCEC | null>(null);

  const toggleDone = (id: string) =>
    eduGuardar({
      ...estado,
      done: estado.done.includes(id) ? estado.done.filter((x) => x !== id) : [...estado.done, id],
    });

  const marcarQuiz = (id: string) =>
    estado.quiz.includes(id) ? undefined : eduGuardar({ ...estado, quiz: [...estado.quiz, id] });

  const lista = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return CEC_MODULOS.filter((m) => {
      if (cat !== "todas" && m.cat !== cat) return false;
      if (!qn) return true;
      return (
        m.titulo.toLowerCase().includes(qn) ||
        m.desc.toLowerCase().includes(qn) ||
        m.cuerpo.some((p) => p.toLowerCase().includes(qn)) ||
        m.id.toLowerCase().includes(qn)
      );
    });
  }, [cat, q]);

  const total = CEC_MODULOS.length;
  const hechos = estado.done.length;
  const completa = hechos === total;

  return (
    <div className="space-y-3">
      {/* Progreso e insignias */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-end gap-3">
          <div>
            <p className="text-2xl font-extrabold leading-none tabular-nums text-foreground">
              {hechos}/{total}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("edu.progreso")}</p>
          </div>
          <div className="mb-1 h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-500 transition-[width] duration-300"
              style={{ width: `${total ? (hechos / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Insignia icono={<GraduationCap className="h-3.5 w-3.5" />} clave="edu.ins1" on={hechos >= 1} />
          <Insignia icono={<ShieldCheck className="h-3.5 w-3.5" />} clave="edu.ins2" on={INS_NORMATIVA.some((id) => estado.done.includes(id))} />
          <Insignia icono={<Mountain className="h-3.5 w-3.5" />} clave="edu.ins3" on={INS_MONTANA.some((id) => estado.done.includes(id))} />
          <Insignia icono={<Compass className="h-3.5 w-3.5" />} clave="edu.ins4" on={completa} />
        </div>
      </Card>

      {/* Búsqueda */}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("edu.searchPh")}
          aria-label={t("edu.searchAria")}
          className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground"
        />
      </label>

      {/* Chips de categoría */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={t("edu.chipsAria")}>
        {["todas", ...CEC_CATS].map((c) => {
          const on = c === cat;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={on}
              onClick={() => setCat(c)}
              className={`h-9 flex-1 whitespace-nowrap rounded-lg border px-3 text-[12px] font-semibold transition-colors ${
                on
                  ? "border-emerald-700 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {c === "todas" ? t("edu.todas") : t(`cat.${c}`)}
            </button>
          );
        })}
      </div>

      {/* Tarjetas de módulos */}
      {lista.length === 0 ? (
        <Card className="border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          {t("edu.sinResultados")}
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {lista.map((m) => (
            <button
              key={m.id}
              onClick={() => setAbierta(m)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                estado.done.includes(m.id)
                  ? "border-emerald-600/50 bg-emerald-600/10 hover:bg-emerald-600/15"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[19px]">
                {m.icono}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tabular-nums tracking-wide text-muted-foreground">{m.id}</span>
                  {estado.done.includes(m.id) && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
                  )}
                </span>
                <span className="block text-[14px] font-bold leading-snug text-foreground">{m.titulo}</span>
                <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-muted-foreground">
                  {m.desc}
                </span>
                <span className="mt-1 block text-[10.5px] font-semibold text-muted-foreground/80">
                  {t(`cat.${m.cat}`)} · {t(`edu.nivel.${m.nivel}`)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">{t("edu.nota")}</p>

      {abierta && (
        <FichaModulo
          mod={abierta}
          done={estado.done.includes(abierta.id)}
          quizHecho={estado.quiz.includes(abierta.id)}
          onToggleDone={() => toggleDone(abierta.id)}
          onQuizOk={marcarQuiz}
          onClose={() => setAbierta(null)}
        />
      )}
    </div>
  );
}
