"use client";

// ============================================================
// ComentariosProducto (v1.29.5): casilla de evaluación + comentarios
// dentro del modal «Ver detalles» de /geo (Cumbre30 y RAPIQO).
//   · Evaluación obligatoria (1-5 estrellas) + comentario.
//   · Nombre opcional (→ «Anónimo»); honeypot anti-bots.
//   · Listado recientes primero (GET /api/comentarios).
// Los estilos viven en el CSS de GeoSite (#geo-root .comentario-…).
// ============================================================
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send, Star } from "lucide-react";

type Comentario = {
  id: string;
  evaluacion: number;
  comentario: string;
  nombre: string;
  createdAt: string;
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

function Estrellas({ n }: { n: number }) {
  return (
    <span className="comentario-estrellas" aria-label={`Evaluación: ${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: 14, height: 14, color: i <= n ? "var(--acento)" : "var(--borde)" }}
          fill={i <= n ? "currentColor" : "none"}
          aria-hidden
        />
      ))}
    </span>
  );
}

export default function ComentariosProducto({ producto }: { producto: "cumbre30" | "rapiqo" }) {
  const [lista, setLista] = useState<Comentario[]>([]);
  const [carga, setCarga] = useState(true);
  const [fallo, setFallo] = useState(false);
  const [form, setForm] = useState({ evaluacion: 0, nombre: "", comentario: "", web: "" });
  const [envio, setEnvio] = useState<"idle" | "enviando" | "ok" | "error" | "invalido">("idle");

  useEffect(() => {
    let vivo = true;
    setCarga(true);
    setFallo(false);
    fetch(`/api/comentarios?producto=${producto}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (vivo) setLista((j.comentarios ?? []) as Comentario[]);
      })
      .catch(() => {
        if (vivo) setFallo(true);
      })
      .finally(() => {
        if (vivo) setCarga(false);
      });
    return () => {
      vivo = false;
    };
  }, [producto]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (envio === "enviando") return;
    // Evaluación obligatoria: sin estrellas o sin comentario no se envía.
    if (form.evaluacion < 1 || form.comentario.trim().length < 4) {
      setEnvio("invalido");
      return;
    }
    setEnvio("enviando");
    try {
      const r = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto, ...form }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; comentario?: Comentario };
      if (r.ok && j.ok) {
        // Recientes primero: el nuevo queda primero en la lista.
        if (j.comentario) setLista((l) => [j.comentario as Comentario, ...l]);
        setForm({ evaluacion: 0, nombre: "", comentario: "", web: "" });
        setEnvio("ok");
      } else {
        setEnvio("error");
      }
    } catch {
      setEnvio("error");
    }
  };

  const promedio = lista.length
    ? (lista.reduce((a, c) => a + c.evaluacion, 0) / lista.length).toFixed(1)
    : null;

  return (
    <section className="comentarios">
      <h4 className="comentario-titulo">
        Evaluaciones y comentarios
        {promedio && (
          <span className="comentario-promedio">
            <Star style={{ width: 13, height: 13, color: "var(--acento)" }} fill="currentColor" aria-hidden />
            {promedio} · {lista.length} {lista.length === 1 ? "evaluación" : "evaluaciones"}
          </span>
        )}
      </h4>

      <form className="comentario-forma" onSubmit={enviar}>
        <div role="radiogroup" aria-label="Tu evaluación (obligatoria)">
          <span className="campo-etiqueta">Tu evaluación *</span>
          <div className="estrellas-elegir">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={form.evaluacion === i}
                aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
                className="estrella-btn"
                onClick={() => {
                  setForm((f) => ({ ...f, evaluacion: i }));
                  setEnvio("idle");
                }}
              >
                <Star style={{ width: 22, height: 22 }} fill={i <= form.evaluacion ? "currentColor" : "none"} aria-hidden />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor={`cm-nombre-${producto}`}>Nombre (opcional)</label>
          <input
            id={`cm-nombre-${producto}`}
            value={form.nombre}
            maxLength={60}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Anónimo"
          />
        </div>
        <div>
          <label htmlFor={`cm-texto-${producto}`}>Comentario *</label>
          <textarea
            id={`cm-texto-${producto}`}
            rows={3}
            value={form.comentario}
            maxLength={1000}
            required
            minLength={4}
            onChange={(e) => setForm({ ...form, comentario: e.target.value })}
            placeholder="¿Qué te parece este producto?"
          />
        </div>
        {/* Honeypot: invisible para personas, tentador para bots */}
        <div className="hp" aria-hidden="true">
          <label htmlFor={`cm-web-${producto}`}>Web (no completar este campo)</label>
          <input
            id={`cm-web-${producto}`}
            tabIndex={-1}
            autoComplete="off"
            value={form.web}
            onChange={(e) => setForm({ ...form, web: e.target.value })}
          />
        </div>
        <button className="btn btn-fantasma comentario-enviar" type="submit" disabled={envio === "enviando"}>
          {envio === "enviando" ? (
            <Loader2 style={{ width: 15, height: 15 }} className="geo-girando" aria-hidden />
          ) : (
            <Send style={{ width: 15, height: 15 }} aria-hidden />
          )}
          Enviar evaluación
        </button>
        {envio === "invalido" && (
          <p className="comentario-aviso error" role="alert">
            <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden /> Elige una evaluación con
            estrellas y escribe tu comentario.
          </p>
        )}
        {envio === "ok" && (
          <p className="comentario-aviso ok" role="status">
            <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden /> ¡Gracias! Tu evaluación
            quedó publicada.
          </p>
        )}
        {envio === "error" && (
          <p className="comentario-aviso error" role="alert">
            <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden /> No se pudo enviar. Intenta
            de nuevo.
          </p>
        )}
      </form>

      <div className="comentario-lista">
        {carga ? (
          <p className="comentario-vacio">Cargando evaluaciones…</p>
        ) : fallo ? (
          <p className="comentario-vacio">No se pudieron cargar los comentarios.</p>
        ) : lista.length === 0 ? (
          <p className="comentario-vacio">Aún no hay evaluaciones — sé la primera persona en opinar.</p>
        ) : (
          lista.map((c) => (
            <article key={c.id} className="comentario-item">
              <div className="comentario-cab">
                <Estrellas n={c.evaluacion} />
                <b>{c.nombre}</b>
                <time dateTime={c.createdAt}>{fecha(c.createdAt)}</time>
              </div>
              <p>{c.comentario}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
