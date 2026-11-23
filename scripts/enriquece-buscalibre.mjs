#!/usr/bin/env node
// Enriquece la cosecha de Buscalibre con Open Library (por ISBN del
// listado): autores, año, editorial, descripción (material para
// reseña propia) y portada. Open Library queda como fuente de
// METADATOS Y PORTADAS según la política v4.2 — nunca como enlace
// de compra.
import fs from "node:fs";
const base = "/home/z/my-project/scripts/data/buscalibre";

const get = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

(async () => {
  const items = JSON.parse(fs.readFileSync(base + "/cosecha-bruta.json", "utf8"));
  const out = [];
  for (const it of items) {
    let gb = null;
    if (/^\d{9,13}$/.test(it.isbn)) {
      const edi = await get(`https://openlibrary.org/isbn/${it.isbn}.json`);
      const work = edi?.works?.[0]?.key ? await get(`https://openlibrary.org${edi.works[0].key}.json`) : null;
      const autores = edi?.authors?.length
        ? (await Promise.all(edi.authors.slice(0, 3).map(async a => (a.key ? (await get(`https://openlibrary.org${a.key}.json`))?.name : null)))).filter(Boolean)
        : [];
      const desc = typeof work?.description === "string" ? work.description : work?.description?.value || "";
      gb = {
        titulo: edi?.title || work?.title,
        autores, anio: (edi?.publish_date || work?.first_publish_date || "").slice(0, 4),
        editoriales: edi?.publishers || [], paginas: edi?.number_of_pages || null,
        descripcion: (desc || "").replace(/\s+/g, " ").slice(0, 900),
        portada: `https://covers.openlibrary.org/isbn/${it.isbn}-L.jpg`,
      };
    } else {
      const q = await get(`https://openlibrary.org/search.json?q=${encodeURIComponent(it.slug.replace(/-/g, " ").slice(0, 60))}&limit=3&fields=title,author_name,first_publish_year,publisher,number_of_pages_median`);
      const h = q?.docs?.[0];
      gb = h ? {
        titulo: h.title, autores: h.author_name || [], anio: String(h.first_publish_year || ""),
        editoriales: h.publisher || [], paginas: h.number_of_pages_median || null,
        descripcion: "", portada: "",
      } : null;
    }
    out.push({ ...it, gb });
    console.log("•", (gb?.titulo || "—").slice(0, 42), "|", (gb?.autores || []).join(",").slice(0, 30), "|", gb?.anio || "?", "| desc:", (gb?.descripcion || "").length);
    await new Promise(r => setTimeout(r, 400));
  }
  fs.writeFileSync(base + "/cosecha-enriquecida.json", JSON.stringify(out, null, 1));
  console.log("\nenriquecidos:", out.filter(x => x.gb).length, "/", out.length);
})();
