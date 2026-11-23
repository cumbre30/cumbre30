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

## Pendientes para el equipo editorial

1. Revisar los {n} borradores y publicar por oleadas (igual que el lote ciclismo anterior).
2. 4 borradores del lote anterior siguen sin ficha en Buscalibre.cl («Bicicleta: salud y ejercicio», «Desde Monterrey en bicicleta», «La bicicleta de Katmandú», «Navarra en Bicicleta») — decidir si se enlazan a otro proveedor o se retiran.
3. Las portadas se resolvieron por búsqueda de imágenes con verificación HTTP; conviene ojo humano rápido sobre las {con_portada} antes de publicar (que la portada corresponde a la edición ES).
4. 40 fichas del JSON del usuario no entraron (páginas 2-3 del export truncadas cubren ~106 resultados): si el usuario exporta las páginas completas, puede sumarse un segundo lote ES.
"""
(DL / "informe-oleada-es-fichas.md").write_text(md, encoding="utf-8")
print(f"CSV: {DL/'lote-oleada-es-fichas.csv'} ({n} filas)")
print(f"informe: {DL/'informe-oleada-es-fichas.md'}")
print("portadas:", con_portada, "· con año:", con_anio)
