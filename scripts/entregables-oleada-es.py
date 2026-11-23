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

## Delta 3 — export completo (gemini-code-1795433122194.json): +4 borradores

Nuevo export del usuario con **105 fichas** (URL limpia de ficha en cada registro). Diff contra todo lo procesado: 76 conocidos + 29 nuevos por ISBN → 24 descartados por política v4 (Mariana Correa/CréateSpace ×13, Independently Published ×3, EAE y vanity ×7, Palibrio) y «En bicicleta por los puertos» (9788496349414) reconocido como OTRA EDICIÓN del borrador existente (9788496349544) → no duplicado. **4 incorporadas**:

1. **Ciclismo** — Ashley Gish, Creative Company/Paperbacks (OL exacto, 2024) → [aventura, personas]
2. **Ciclismo en carretera. Test de valoración del umbral anaeróbico** — José Ramón Abad Culebras, Wanceulen (casadellibro/popularlibros/librerialuces) → [entrenamiento]
3. **Ciclismo de precisión** — Edmund R. Burke, Dorleta, Biblioteca Polar Pulsómetro (agapea; la ficha trae el typo «Burker») → [entrenamiento]
4. **Ciclismo para señoras** — Maria E. Ward, Bravas Literatas, «El deporte en femenino» (llibreriacoma/BRAVAS LITERATAS; clásico original de 1896) → [historia, personas]

Portadas: 33/33 verificadas HTTP. Años null para Ward/Dorleta/Abad (no verificables — regla v4).

## Pendientes para el equipo editorial

1. Revisar los {n} borradores y publicar por oleadas (igual que el lote ciclismo anterior).
2. 4 borradores del lote anterior siguen sin ficha en Buscalibre.cl («Bicicleta: salud y ejercicio», «Desde Monterrey en bicicleta», «La bicicleta de Katmandú», «Navarra en Bicicleta») — decidir si se enlazan a otro proveedor o se retiran.
3. Las portadas se resolvieron por búsqueda de imágenes con verificación HTTP; conviene ojo humano rápido sobre las {con_portada} antes de publicar (que la portada corresponde a la edición ES).
4. Con el export completo (105 fichas) el barrido Buscalibre queda **cubierto**: ya no faltan páginas. El universo de 106 = 76 fichas ya procesadas + 24 autoeditadas descartadas + 1 edición duplicada; no quedan títulos legítimos sin procesar.
5. Sin ficha no ingesta: «Ciclismo en carretera. Test de valoración» aparecía truncado en el PDF del 23-11 — resuelto con el export completo (ficha 9788498230727).

## Publicación COMPLETADA (23-11 tarde): 33/33 públicos en producción

Tras la siembra, el usuario aprobó el lote completo: **los 29 borradores ES quedaron PUBLICADOS** (`publica-borradores-lote-es.mjs`: UPDATE solo para títulos del lote con `publicado=false`; los 10 borradores es de oleadas anteriores siguen ocultos sin aprobación). Estado final de Neon: en → 89 publicados · **es → 43 publicados** (lote 33/33) + 10 borradores pendientes de decisión · pt → 4 borradores · destacado=0 · 0 enlaces `/libros/search` · 33/33 con portada.

**E2E en producción (sesión desechable creada y eliminada):** sin filtro → 132 · `?idioma=es` → **43** (todos buscalibre.cl) · `?idioma=en` → 89 · `?idioma=pt` → 0 · `q=krabbé` → 1.

**Incidente reportado por el usuario («no me cargan en la app») — diagnóstico: el servidor está sano.** Se reprodujo el flujo EXACTO del cliente (`CulturaView` llama sin filtros): HTTP 200 · 103 recursos en el momento del test · los 4 nuevos presentes con todas las claves · la UI es null-safe con `anio` (10 es lo tienen null y el render lo tolera: `rec.anio ? … : ""`) · 21 sesiones en la base, 0 vencidas · 33/33 portadas verificadas HTTP. Conclusión: el bloqueo es de estado de sesión/sync en el cliente (la vista solo llama a la API si `hasSession`: en el APK modo offline exige token de servidor o sync OK — sin eso se queda cargando, sin mensaje de error). Solución: cerrar y abrir la app / iniciar sesión de nuevo; en el APK, completar un sync con conexión.

**Infraestructura de conexión restaurada** (tras el reciclaje del sandbox): clave de API de Neon (`.env.neon`) + org_id (`org-broad-cloud-28449650`, `.env.neon.org`) → `scripts/deriva-uri-neon.py` deriva el URI vía API v2 (`/projects?org_id=` → `/connection_uri?branch_id=&database_name=neondb&role_name=neondb_owner`) → `.env.neon.uri`. Todo chmod 600 fuera de git. La vía Vercel (`DATABASE_URL`) no aplica: la variable es *sensitive* (no legible por API). La semilla corre contra el endpoint pooled (pgbouncer) con resolución IPv4+SNI propia.
"""
(DL / "informe-oleada-es-fichas.md").write_text(md, encoding="utf-8")
print(f"CSV: {DL/'lote-oleada-es-fichas.csv'} ({n} filas)")
print(f"informe: {DL/'informe-oleada-es-fichas.md'}")
print("portadas:", con_portada, "· con año:", con_anio)
