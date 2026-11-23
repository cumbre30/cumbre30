#!/usr/bin/env python3
# Entregables de revisión editorial de la OLEADA ES (fichas verificadas):
#   · download/lote-oleada-es-fichas.csv        (lote completo)
#   · download/informe-oleada-es-fichas.md      (informe de revisión)
import json, csv
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
DL = Path("/home/z/my-project/download")
lote = json.loads((BASE / "lote-es-fichas-final.json").read_text())

# ---------- CSV ----------
cols = ["titulo", "autor", "anio", "editorial", "categorias", "pais", "url_ficha_buscalibre", "portada", "estado"]
with (DL / "lote-oleada-es-fichas.csv").open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(cols)
    for l in lote:
        w.writerow([l["titulo"], l["autor"], l["anio"] if l["anio"] else "",
                    (l["extra"].split("· Editorial ")[-1] if "· Editorial " in l["extra"] else ""),
                    " / ".join(l["categorias"]), l["pais"] or "",
                    l["urlExterna"], l["portada"], "BORRADOR (publicado=false)"])

# ---------- informe ----------
n = len(lote)
con_anio = sum(1 for l in lote if l["anio"])
con_portada = sum(1 for l in lote if l["portada"])
fuentes = {}
for l in lote:
    ed = l["extra"].split("· Editorial ")[-1] if "· Editorial " in l["extra"] else "?"
    fuentes[ed] = fuentes.get(ed, 0) + 1

md = f"""# Oleada ES por fichas verificadas — {n} borradores (estado: BORRADOR, pendiente revisión editorial)

**Fecha:** 2026-11-23 · **Fuente:** los 3 JSON de Buscalibre «ciclismo» aportados por el usuario (106 resultados reportados, 66 fichas extraídas, 63 no presentes en catálogo) · **Destino:** `cultura_recursos` en Neon, `publicado=false`

## Resumen

| Métrica | Valor |
| --- | --- |
| Registros creados | {n} |
| Con año de edición | {con_anio}/{n} (null cuando no verificable — regla v4) |
| Con portada verificada (HTTP 200, imagen) | {con_portada}/{n} |
| Enlaces de ficha real de Buscalibre | {n}/{n} (cero enlaces de búsqueda) |
| Publicados / destacados | 0 / 0 (borradores) |
| API pública `?idioma=es` | sigue en 10 — los {n} quedan ocultos hasta publicar |

## Reglas v4 aplicadas

1. **Solo obras reales** con autor verificado por el listado de origen (ficha Buscalibre) y Open Library cuando la ficha no traía año («Medicina del ciclismo» → Paidotribo, 2002).
2. **Reseñas propias de Cumbre30** en español (idioma de la edición), 2-3 frases, sin texto de proveedores.
3. **Enlace por ficha real** (`/libro-<slug>/<isbn>/p/<id>`), nunca `/libros/search` (el WAF de Buscalibre devuelve 405 "Human Verification" a los enlaces de búsqueda — causa del bug reportado y corregido esta misma sesión).
4. **Borradores**: `publicado=false`, `destacado=false`; la semilla es idempotente (re-run: 0 creados · 25 actualizados, no toca estado editorial).

## Selección editorial (25 de 63)

Descartados: 12 autoeditados/CreatedSpace (serie Mariana Correa, «Cuánto sabes de…», VC Brothers), libros-cuaderno sin autor, POD vanidoso (Editorial Académica Española, Club Universitario, Autor-Editor), y duplicados print/digital del mismo título (se eligió la ficha de papel cuando existe: Arriva Italia, El secreto del ciclismo, La etapa decimocuarta, Una dura carrera; quedaron como listado «digital» solo Dios ha muerto y Niebla en el Mont Ventoux, sin edición física en Buscalibre.cl).

**Distribución por editorial:** {" · ".join(f"{k} ({v})" for k, v in sorted(fuentes.items(), key=lambda x: -x[1]))}

**Bloques temáticos:** crónica e historia (Libros De Ruta ×9, Geoplaneta, Lince, Almuzara, Experimenta), entrenamiento y salud (Paidotribo ×3, Tutor ×2, Hispano Europea), territorio y ciudadanía (Desnivel, Cep i la Nansa, UniAndes, Formación Alcalá, Kairós, Libsa).

## Delta 1 — pegado página 1/3 (22-11): +1 borrador

De los 32 fichas visibles, 30 ya estaban procesadas. Nuevas: **Ciclismo. Entrenamiento avanzado** (Hunter Allen, Tutor 2013 — edición española de *Cutting-Edge Cycling*; nota de prensa Tutor 24-04-2013 y Amazon/biblio lo confirman) → sembrado como borrador.

**Incidente de colisión y reparación:** «Ciclismo para niños» (Iván Libreros, Ediciones JC) YA estaba en el catálogo como registro publicado (lote anterior). La semilla lo actualizó y sobrescribió campos editoriales. Reparado: se restauraron resena/extra/categorías originales (fuentes: `lote-ciclismo-final.json`); se conservaron tres mejoras objetivas (enlace de ficha real en lugar del `/libros/search` roto, portada verificada HTTP —la de OL daba 404—, y año 2021 confirmado por OL). La semilla ahora **omite cualquier registro publicado** (guardia «SKIP (publicado en producción)») y el título salió del lote canonical para que ningún re-run lo toque.

## Delta 2 — PDF export (DOC-20261123-WA0000.pdf): +3 borradores

Validación del PDF (30 págs. A2, impreso desde Chrome): contiene **tres fragmentos** — export página 1/3 (truncado en «ciclismo todo terreno»), pegado WhatsApp con página 2/3 (truncado en «121 CONSEJOS…») y pegado WhatsApp con página 3/3 (solo 6 fichas). Unión: **66 fichas únicas de las 106 reportadas** → faltan ~39. Parser tolerante a artefactos de pdftotext (`scripts/valida-pdf-export.py`): un guion perdido en wrap se reconstruyó («ciclismoguia» → «ciclismo-guia»).

De las 18 fichas nuevas del PDF: 13 descartadas por política v4 (serie Mariana Correa ×6 Createspace, Independently Published ×2, Editorial Académica Española y otras vanity ×3, Palibrio, Círculo Rojo); «Ciclismo para niños» ya publicada; **3 incorporadas** (verificadas por Open Library/web):

1. **Atlas ilustrado de ciclismo épico** — Susaeta (OL exacto, 2006) → [historia, ruta]
2. **El placer del ciclismo** — Louis Chauvet Urquidi, Trillas (OL exacto, 2001) → [personas, aventura]
3. **Ciclismo. Science of Cycling** — David Bailey, DK 2027 — edición española anunciada del original DK (13-01-2026) → [entrenamiento]

Portadas: 29/29 verificadas HTTP (image-search; las de OL para Atlas y Placer daban vacías). Nota: la ficha de «El placer del ciclismo» tiene el slug reconstruido — comprobar el enlace al revisar.

## Pendientes para el equipo editorial

1. Revisar los {n} borradores y publicar por oleadas (igual que el lote ciclismo anterior).
2. 4 borradores del lote anterior siguen sin ficha en Buscalibre.cl («Bicicleta: salud y ejercicio», «Desde Monterrey en bicicleta», «La bicicleta de Katmandú», «Navarra en Bicicleta») — decidir si se enlazan a otro proveedor o se retiran.
3. Las portadas se resolvieron por búsqueda de imágenes con verificación HTTP; conviene ojo humano rápido sobre las {con_portada} antes de publicar (que la portada corresponde a la edición ES).
4. **Faltan ~39 fichas del listado Buscalibre (106 reportadas, 66 en los fragmentos)**: el PDF trae las 3 páginas pero cada una llega truncada al final. Para completar el barrido, exportar/copiar cada página completa (o hacer capturas de las páginas 2 y 3 del sitio); lo pendiente es sobre todo la página 3 (6 de ~34) y el tramo final de las páginas 1-2.
5. Sin ficha no ingesta: «Ciclismo en carretera. Test de valoración» (José Ramón Abad Culebras, Wanceulen) aparece en el PDF sin enlace — candidato legítimo cuando se tenga su ficha.
"""
(DL / "informe-oleada-es-fichas.md").write_text(md, encoding="utf-8")
print(f"CSV: {DL/'lote-oleada-es-fichas.csv'} ({n} filas)")
print(f"informe: {DL/'informe-oleada-es-fichas.md'}")
print("portadas:", con_portada, "· con año:", con_anio)
