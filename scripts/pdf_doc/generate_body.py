# -*- coding: utf-8 -*-
"""
Cuerpo del PDF técnico "Motor GPS, Minimapa y Pipeline de Producción" (Cumbre30).
Pipeline Report brief: ReportLab (body) + portada HTML/Playwright separada (merge después).

Plan de numeración (Step 3.5 — la portada y el índice NO son capítulos):
| Outline | Tipo    | Capítulo | Título                                    |
| 1       | cover   | —        | Portada (PDF aparte, se fusiona)          |
| 2       | toc     | —        | Contenido                                 |
| 3       | content | 1        | Arquitectura general                      |
| 4       | content | 2        | Motor GPS de rides                        |
| 5       | content | 3        | Ruteo y navegación                        |
| 6       | content | 4        | Minimapa                                  |
| 7       | content | 5        | Pipeline de datos locales                 |
| 8       | content | 6        | Backend: base de datos y autenticación    |
| 9       | content | 7        | Integraciones de API                      |
| 10      | content | 8        | Doble compilación web y APK               |
| 11      | content | 9        | Despliegue en Vercel                      |
| 12      | content | 10       | Checklist de réplica                      |
"""
import hashlib
import html
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
PDF_SKILL = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL, "scripts"))
sys.path.insert(0, BASE)

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (CondPageBreak, HRFlowable, Image, KeepTogether,
                                PageBreak, Paragraph, SimpleDocTemplate, Spacer,
                                Table, TableStyle, XPreformatted)
from reportlab.platypus.tableofcontents import TableOfContents
from PIL import Image as PILImage

from frag_code import FRAGS

# ── Fuentes (solo las permitidas por el brief) ─────────────────────────────
FONT_DIR = "/usr/share/fonts"
pdfmetrics.registerFont(TTFont("NotoSerifSC", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC-Bold", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif", f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans", f"{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf"))
registerFontFamily("NotoSerifSC", normal="NotoSerifSC", bold="NotoSerifSC-Bold")
registerFontFamily("FreeSerif", normal="FreeSerif", bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")
registerFontFamily("DejaVuSans", normal="DejaVuSans", bold="DejaVuSans")

from pdf import install_font_fallback  # noqa: E402  (skill helper)
install_font_fallback()

# ── Paleta fija del Template 07 "Crystal Blue" (cuerpo claro, misma familia) ──
PAGE_BG      = colors.HexColor("#f5f8fc")   # XL
SECTION_BG   = colors.HexColor("#edf2f9")   # XL
CARD_BG      = colors.HexColor("#e4ecf5")   # L
TABLE_STRIPE = colors.HexColor("#eef3fa")   # L
HEADER_FILL  = colors.HexColor("#1a4a7a")   # M
BORDER       = colors.HexColor("#c0d0e2")   # S
ACCENT       = colors.HexColor("#2d7ab3")   # XS (= glow de la portada)
TEXT_PRIMARY = colors.HexColor("#142840")
TEXT_MUTED   = colors.HexColor("#5a7a96")

MARGIN = 0.85 * inch                      # simétrico
PAGE_W, PAGE_H = A4
AVAIL = PAGE_W - 2 * MARGIN               # ≈ 465 pt
AVAIL_H = PAGE_H - 2 * MARGIN
MAX_KEEP = PAGE_H * 0.4

DOC_TITLE = "Motor GPS, Minimapa y Pipeline de Producción — Cumbre30"
OUT_PDF = os.path.join(BASE, "assets", "body.pdf")

# ── Estilos ────────────────────────────────────────────────────────────────
S = {}
S["body"] = ParagraphStyle("Body", fontName="FreeSerif", fontSize=10.2, leading=14.6,
                           alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6)
S["bullet"] = ParagraphStyle("Bullet", parent=S["body"], leftIndent=16, bulletIndent=4,
                             spaceAfter=4, alignment=TA_LEFT)
S["h1"] = ParagraphStyle("H1", fontName="FreeSerif-Bold", fontSize=16.5, leading=20,
                         textColor=HEADER_FILL, spaceBefore=13, spaceAfter=2)
S["h2"] = ParagraphStyle("H2", fontName="FreeSerif-Bold", fontSize=12.6, leading=16,
                         textColor=HEADER_FILL, spaceBefore=10, spaceAfter=4)
S["h3"] = ParagraphStyle("H3", fontName="FreeSerif-Bold", fontSize=11, leading=14.5,
                         textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=3)
S["caption"] = ParagraphStyle("Caption", fontName="FreeSerif-Italic", fontSize=8.5, leading=11.5,
                              alignment=TA_CENTER, textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6)
S["code"] = ParagraphStyle("Code", fontName="DejaVuSans", fontSize=7.0, leading=9.0,
                           textColor=TEXT_PRIMARY, alignment=TA_LEFT)
S["codesrc"] = ParagraphStyle("CodeSrc", fontName="FreeSerif-Italic", fontSize=8, leading=10.5,
                              textColor=TEXT_MUTED, spaceBefore=0, spaceAfter=3)
S["th"] = ParagraphStyle("TH", fontName="FreeSerif-Bold", fontSize=9.3, leading=12,
                         textColor=colors.white, alignment=TA_LEFT)
S["td"] = ParagraphStyle("TD", fontName="FreeSerif", fontSize=8.7, leading=11.6,
                         textColor=TEXT_PRIMARY, alignment=TA_LEFT)
S["tdc"] = ParagraphStyle("TDC", parent=S["td"], alignment=TA_CENTER)
S["stat"] = ParagraphStyle("Stat", fontName="FreeSerif-Bold", fontSize=19, leading=22,
                           textColor=ACCENT, alignment=TA_CENTER)
S["statlbl"] = ParagraphStyle("StatLbl", fontName="FreeSerif", fontSize=8.2, leading=10.5,
                              textColor=TEXT_MUTED, alignment=TA_CENTER)
S["toc0"] = ParagraphStyle("TOC0", fontName="FreeSerif-Bold", fontSize=10.2, leading=13.4,
                           textColor=TEXT_PRIMARY, leftIndent=6)
S["toc1"] = ParagraphStyle("TOC1", fontName="FreeSerif", fontSize=8.8, leading=10.7,
                           textColor=TEXT_MUTED, leftIndent=24)
S["toctitle"] = ParagraphStyle("TocTitle", fontName="FreeSerif-Bold", fontSize=16, leading=20,
                               textColor=HEADER_FILL, spaceAfter=6)

# ── Documento con TOC y numeración ajustada (página 1 = índice → "i") ──────
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            self.notify("TOCEntry", (level, text, max(1, self.page - 1), key))

    def beforePage(self):
        c = self.canv
        c.saveState()
        # Fondo de página (familia azul clara del Template 07)
        c.setFillColor(PAGE_BG)
        c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        # Cabecera: título + regla acento
        c.setFont("FreeSerif", 7.5)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN, PAGE_H - 40, "Cumbre30 · Documentación técnica interna")
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1.2)
        c.line(MARGIN, PAGE_H - 46, PAGE_W - MARGIN, PAGE_H - 46)
        # Pie: autor + número de página (romano en el índice, arábigo en el cuerpo)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.6)
        c.line(MARGIN, 42, PAGE_W - MARGIN, 42)
        c.setFont("FreeSerif", 7.5)
        c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN, 30, "Cumbre GEO · nov. 2026")
        num = "i" if self.page == 1 else str(self.page - 1)
        c.drawRightString(PAGE_W - MARGIN, 30, num)
        c.restoreState()


def safe_keep(elements):
    total = 0
    for el in elements:
        w, h = el.wrap(AVAIL, PAGE_H)
        total += h
    if total <= MAX_KEEP:
        return [KeepTogether(elements)]
    if len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)


def heading(text, level):
    key = "h_" + hashlib.md5(text.encode()).hexdigest()[:8]
    style = S["h1"] if level == 0 else (S["h2"] if level == 1 else S["h3"])
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


def h1(story, text):
    story.append(CondPageBreak(AVAIL_H * 0.25))
    story.extend(safe_keep([
        heading(text, 0),
        HRFlowable(width="100%", color=ACCENT, thickness=1.2, spaceBefore=3, spaceAfter=10),
    ]))


def h2(story, text, toc=False):
    """H2 de sección. El índice es solo de capítulos: nunca se indexa."""
    story.append(CondPageBreak(70))
    p = heading(text, 1)
    for attr in ("bookmark_name", "bookmark_level", "bookmark_text", "bookmark_key"):
        if hasattr(p, attr):
            delattr(p, attr)
    story.append(p)


def h2_plain(story, text):
    """H2 sin entrada en el índice (usado cuando el TOC es solo de capítulos)."""
    h2(story, text, toc=False)


def h3(story, text):
    story.append(CondPageBreak(55))
    story.append(heading(text, 2))


def body(story, text):
    story.append(Paragraph(text, S["body"]))


def bullets(story, items):
    for it in items:
        story.append(Paragraph(it, S["bullet"], bulletText="•"))
    story.append(Spacer(1, 5))


def wrap_code_line(line, max_chars=96):
    out = []
    while len(line) > max_chars:
        cut = line.rfind(" ", 40, max_chars)
        if cut == -1:
            cut = max_chars
        out.append(line[:cut])
        line = "        " + line[cut:].lstrip()
    out.append(line)
    return out


def code_block(story, frag_key):
    src, code = FRAGS[frag_key]
    code = re.sub(r"[\u200b-\u200f\u2028-\u202f\u2060\ufeff\ufffd]", "", code)
    lines = []
    for ln in code.split("\n"):
        lines.extend(wrap_code_line(ln.rstrip()))
    pre = XPreformatted(html.escape("\n".join(lines)), S["code"])
    tbl = Table([[pre]], colWidths=[AVAIL])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 4))
    story.extend(safe_keep([Paragraph("Fuente: " + src, S["codesrc"]), tbl]))
    story.append(Spacer(1, 6))


def make_table(header, rows, ratios, header_bg=HEADER_FILL):
    widths = [r * AVAIL for r in ratios]
    assert sum(widths) <= AVAIL + 0.5
    data = [[Paragraph("<b>%s</b>" % htext, S["th"]) for htext in header]]
    for row in rows:
        data.append([Paragraph(cell, S["td"]) for cell in row])
    tbl = Table(data, colWidths=widths, repeatRows=1, hAlign="CENTER")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        style.append(("BACKGROUND", (0, i), (-1, i), colors.white if i % 2 else TABLE_STRIPE))
    tbl.setStyle(TableStyle(style))
    return tbl


def add_table(story, caption, header, rows, ratios):
    tbl = make_table(header, rows, ratios)
    story.append(Spacer(1, 9))
    if len(rows) <= 12:
        story.extend(safe_keep([tbl, Paragraph(caption, S["caption"])]))
    else:
        story.append(tbl)
        story.append(Paragraph(caption, S["caption"]))
    story.append(Spacer(1, 7))


def figure(story, path, caption, max_h=300):
    img = PILImage.open(path)
    ow, oh = img.size
    ratio = min(AVAIL / ow, max_h / oh, 1.0)
    flow = Image(path, width=ow * ratio, height=oh * ratio)
    flow.hAlign = "CENTER"
    story.append(Spacer(1, 10))
    story.extend(safe_keep([flow, Paragraph(caption, S["caption"])]))
    story.append(Spacer(1, 8))


def callout_row(story, stats):
    """Fila de 3 métricas destacadas (data sculpture)."""
    cells, widths = [], []
    gap = 10
    w = (AVAIL - 2 * gap) / 3
    for i, (num, lbl) in enumerate(stats):
        inner = Table([[Paragraph("<b>%s</b>" % num, S["stat"])], [Paragraph(lbl, S["statlbl"])]],
                      colWidths=[w])
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("BOX", (0, 0), (-1, -1), 1, ACCENT),
            ("TOPPADDING", (0, 0), (-1, 0), 9),
            ("BOTTOMPADDING", (0, -1), (-1, -1), 9),
            ("TOPPADDING", (0, -1), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
        ]))
        cells.append(inner)
        widths.append(w)
        if i < 2:
            cells.append("")
            widths.append(gap)
    outer = Table([cells], colWidths=widths, hAlign="CENTER")
    outer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(Spacer(1, 8))
    story.append(outer)
    story.append(Spacer(1, 9))


# ═══════════════════════════ STORY ═════════════════════════════════════════
story = []

# ── Índice ──
story.append(Paragraph("Contenido", S["toctitle"]))
toc = TableOfContents()
toc.levelStyles = [S["toc0"], S["toc1"]]
toc.dotsMinLevel = 100  # sin puntos leaders: cada entrada ocupa una sola línea
story.append(toc)
story.append(PageBreak())

A = os.path.join(BASE, "assets")

# ═══ 1 · Arquitectura general ═══
h1(story, "1. Arquitectura general")
body(story, "Cumbre30 es una sola base de código Next.js 15 que se compila en dos productos: la web con "
     "backend (Vercel + Prisma + PostgreSQL) y el APK estático empaquetado con Capacitor 8. Todo el "
     "sistema de ride — el motor GPS, el ruteo y el minimapa — vive en el cliente y funciona sin "
     "conexión; el servidor solo recibe agregados cuando hay sesión y red. Esta separación es la "
     "decisión arquitectónica central: el teléfono nunca depende de la nube para pedalear, y la nube "
     "nunca necesita la pista GPS cruda para operar.")
body(story, "El flujo de datos del ride tiene tres capas. Las fuentes de fix (la API de geolocalización "
     "del WebView, un Foreground Service nativo a 1 Hz en el APK, o el simulador para demos) alimentan "
     "el pipeline processFix() del hook useRideEngine, que calcula velocidad filtrada, distancia, "
     "desnivel, geocercas y la máquina de estados del límite de 30 km/h. Desde ahí, los datos llegan a "
     "tres consumidores en paralelo: el motor de alertas, el par MiniMap + useNavEngine (ruta y cámara) "
     "y la capa de persistencia (localStorage, sincronización con /api/rides, exportación GPX y "
     "segmentos Pro).")
callout_row(story, [
    ("50.648", "nodos en el grafo OSM local (red-ciclista.json)"),
    ("58.468", "aristas con clase de vía y bandera de ciclovía"),
    ("2,4 MB", "peso del grafo empaquetado en el bundle del APK"),
])
figure(story, os.path.join(A, "diagrama1-gps.png"),
       "Figura 1. Flujo del fix GPS: fuentes, pipeline processFix() y consumidores.", max_h=260)
add_table(story, "Tabla 1. Archivos centrales del motor de ride (rutas relativas a src/).",
    ["Archivo", "Líneas", "Rol"],
    [
        ["hooks/useRideEngine.ts", "605", "Pipeline de fixes, métricas, geocercas, estado 30 km/h y guardado"],
        ["hooks/useNavEngine.ts", "214", "Destino, ruta vigente, reroute y re-anclaje"],
        ["lib/routing.ts", "700", "A* sobre el grafo, proyecciones, attachOrigin, progreso"],
        ["lib/routingService.ts", "333", "computeRoute: motor local A* vs OSRM + banderas Overpass"],
        ["lib/geo.ts", "128", "Haversine, SpeedKalman, EMA, bearing, courseHeading"],
        ["lib/alertEngine.ts", "309", "Pitidos WebAudio, voz TTS, vibración, wake lock"],
        ["lib/park.ts", "198", "Límite 30, polígono del parque, accesos, zonas, destinos"],
        ["components/MiniMap.tsx", "1.031", "Minimapa (MapLibre GL / Leaflet / nativo) + capa UI Waze"],
    ], [0.30, 0.10, 0.60])

# ═══ 2 · Motor GPS ═══
h1(story, "2. Motor GPS de rides")
h2(story, "2.1 Fuentes de fix")
body(story, "En web, el hook arranca navigator.geolocation.watchPosition con enableHighAccuracy, "
     "maximumAge 0 y timeout de 15 s; si el navegador entrega speed (velocidad Doppler), se usa "
     "directa, y si no, se computa por delta de posición entre fixes consecutivos. En el APK ese feed "
     "se reemplaza por el plugin nativo RideNative: RideLocationService.kt es un Foreground Service de "
     "tipo location que consulta LocationManager.GPS_PROVIDER a 1000 ms exactos — el hardware directo, "
     "sin pasar por Play Services — y reenvía cada fix al WebView como evento gpsfix (un speed negativo "
     "significa Doppler inválido). Si el plugin falla, el arranque nativo cae automáticamente al feed "
     "web. Para demos existe un tercer origen, RideSimulator, que recorre SIM_ROUTE con tick de 500 ms.")
h2(story, "2.2 Pipeline processFix: velocidad y distancia")
body(story, "Todo fix — real, nativo o simulado — pasa por el mismo pipeline de nueve pasos dentro de "
     "processFix(). La velocidad fiscalizada no es la cruda del GPS: primero pasa por el filtro de "
     "Kalman y luego por una micro-predicción de 400 ms que extrapola con la aceleración implícita, "
     "clampeada a ±3 m/s<super>2</super>. Esto evita alertar por ruido del Doppler en los cambios de pendiente. La "
     "distancia se acumula con Haversine entre fixes consecutivos, descartando saltos de 100 m o más y "
     "fixes con precisión peor a 60 m (anti-teletransporte). El desnivel usa la altitud GPS suavizada "
     "con una media exponencial (alfa 0,3) y solo suma desnivel positivo si hubo avance horizontal "
     "mayor a 3 m; la pendiente se clamp a ±35 % y se suaviza con otra EMA (alfa 0,22).")
code_block(story, "kalman_dist")
body(story, "El filtro escalar de velocidad incluye una compuerta de outliers en dos niveles: si la "
     "medición implica una aceleración imposible (más de 8 m/s<super>2</super> sube la varianza de medida 25 veces; "
     "más de 25 m/s<super>2</super>, unas 60), el filtro desconfía del fix en vez de saltar. El acelerómetro se "
     "retiró deliberadamente: el WebView no entrega devicemotion de forma fiable en los dispositivos "
     "objetivo, así que todo el filtrado descansa en el Doppler del GPS.")
code_block(story, "speedkalman")
h2(story, "2.3 Geofence y máquina de estados del límite 30 km/h")
body(story, "src/lib/park.ts contiene el polígono real del Parque Metropolitano (147 vértices "
     "simplificados del way OSM 168227059), los tres accesos vehiculares, las zonas de riesgo con su "
     "frase de voz y los destinos de navegación. La pertenencia al parque se evalúa por ray casting "
     "con pointInPolygon en cada fix. Solo dentro del parque corre la máquina de estados de velocidad "
     "— ok, caution y over — con histéresis de 0,6 km/h para que el borde de 27/30 km/h no parpadee. "
     "Las transiciones disparan las alertas y los segundos en exceso se acumulan en overLimitSec, la "
     "métrica que después usan los desafíos.")
code_block(story, "estados30")
body(story, "El singleton alertEngine implementa la capa de salida con doble vía nativa/web: pitidos "
     "con WebAudio (oscilador cuadrado de 880 Hz en precaución, sirena continua modulada por un LFO de "
     "6 Hz en exceso), voz con speechSynthesis en es-CL o el plugin nativo text-to-speech con fallback "
     "es-CL a es-ES, y vibración progresiva en tres tiers (pulso corto a 25 km/h, doble pulso a 28, "
     "bucle continuo a 30). Mantiene además un wake lock para que la pantalla no se apague durante el "
     "ride. Cada mensaje lleva antirrepetición por clave con intervalo mínimo.")
h2(story, "2.4 Detección de vehículo motorizado")
body(story, "Para que las estadísticas reflejen solo pedaleos, vehicleDetect.ts clasifica el ride al "
     "guardarlo con una heurística de cuatro reglas sobre velocidad máxima, racha sostenida sobre 45 "
     "km/h, tiempo acumulado sobre el umbral y ritmo urbano sostenido. Es deliberadamente conservador: "
     "una bici de montaña solo toca puntas de 45 km/h en bajadas breves, así que el umbral duro está "
     "en 90 km/h y la decisión híbrida siempre permite confirmación del usuario (PATCH /api/rides "
     "corrige la marca motorized por clientId).")
code_block(story, "vehiculo")
h2(story, "2.5 Persistencia: local primero, servidor después")
body(story, "Un ride es un RideSummary: agregados más una pista opcional de puntos. La pista de la UI "
     "guarda un punto cada 2 metros (tope 6.000); la pista de GPX muestrea 1 punto cada 5 segundos con "
     "tope 600 y, si se llena, se adelgaza a la mitad duplicando el intervalo — unos 21 KB por ride. "
     "El guardado es en cascada: primero localStorage (clave cumbre30-history-v1, con tope freemium de "
     "20 rides y store reactivo via useSyncExternalStore), luego POST /api/rides si hay sesión y red; "
     "la pista GPS nunca sale del dispositivo, el servidor solo recibe agregados clampeados. Sobre la "
     "pista local se calculan además los segmentos Pro (geocercas de inicio/meta con récord personal) "
     "y el archivo GPX 1.1 exportable.")
code_block(story, "ridesummary")

# ═══ 3 · Ruteo y navegación ═══
h1(story, "3. Ruteo y navegación")
h2(story, "3.1 El grafo local")
body(story, "public/red-ciclista.json es un grafo OSM comprimido: un diccionario de 15 clases de vía, "
     "1.399 nombres de vía como índices de string, 50.648 nodos como pares [lat, lon] con 6 decimales y "
     "58.468 aristas como quintetos [a, b, classIdx, nameIdx, ciclovia], más 337 polilíneas de ciclovía "
     "para dibujar. loadNetwork() lo descarga una única vez (promesa cacheada) y construye en memoria "
     "la lista de adyacencia con peso w = distancia × penalización de clase: ciclovia 0,65, path 0,9, "
     "residential 0,95, tertiary 1,15, secondary 1,5 y primary 2,4. Así el A* prefiere ciclovías y "
     "calles tranquilas sin reglas ad hoc.")
h2(story, "3.2 A* con heurística admisible")
body(story, "El origen no se busca como nodo: se ancla a la arista más cercana mediante proyección "
     "punto-segmento y se crea un nodo virtual en esa posición, con dos aristas virtuales hacia los "
     "extremos (heredando clase, nombre y bandera de ciclovía). Si el pin queda a más de 250 m del "
     "grafo, findRoute devuelve null y el servicio cae a OSRM. La heurística es 0,65 × Haversine al "
     "destino — admisible porque el coste mínimo por metro es 0,65 (ciclovía) — y el bucle guarda el "
     "mejor nodo asentado por si el destino es inalcanzable; si el grafo explora menos de 500 nodos o "
     "la ruta no progresa 50 m hacia el destino, se asume origen en una isla del grafo y también se "
     "delega a OSRM.")
code_block(story, "astar")
h2(story, "3.3 Proyección punto-segmento")
body(story, "nearestEdge() escanea las 58.468 aristas en coordenadas equirectangulares (x = lon × cos(lat), "
     "1 grado = 111.320 m) y devuelve la proyección con su distancia en metros. Se ejecuta una sola vez "
     "por cálculo de ruta — coste trivial frente al A* — y también alimenta la decisión de cobertura: "
     "si el origen o el destino están demasiado lejos del grafo, computeRoute delega en el router "
     "público de OSRM (routed-bike) con radiuses=200 para forzar que el origen se ancle a una calle "
     "ciclable real.")
code_block(story, "nearest_edge")
h2(story, "3.4 attachOrigin: tu pin es siempre el punto de partida")
body(story, "La corrección de origen tiene una regla dura: coords[0] es SIEMPRE la posición GPS del "
     "usuario, nunca el primer nodo del grafo. Si la proyección del pin cae dentro de los primeros "
     "150 m de la ruta calculada (TRIM_WINDOW_M), se recorta ese arranque y se antepone el chaflán "
     "pin → calle proyectada; si cae más lejos, se conserva la ruta íntegra y el pin se antepone con "
     "un conector recto. Los pasos de maniobra se re-mapean a los nuevos índices para que las "
     "instrucciones sigan cuadrando.")
code_block(story, "attach_origin")
h2(story, "3.5 Navegación viva")
body(story, "useNavEngine gestiona la ruta vigente: si no hay GPS al fijar destino hace dos disparos "
     "one-shot (6 y 8 segundos) antes de caer al acceso Pío Nono por defecto marcando la ruta como "
     "provisional; recalcula cada 30 s durante la marcha, inmediatamente cuando te desvías más de "
     "140 m (con mínimo de 15 s entre recálculos), y re-ancla la ruta si se calculó desde un fix viejo "
     "a más de 75 m de la posición fresca. Los resultados viejos se descartan por número de secuencia, "
     "de modo que una respuesta lenta de OSRM nunca pisa una ruta más reciente.")

# ═══ 4 · Minimapa ═══
h1(story, "4. Minimapa")
h2(story, "4.1 Tres lienzos, una decisión por plataforma")
body(story, "MiniMap.tsx no dibuja él mismo la proyección: elige lienzo según la plataforma. En "
     "navegadores con WebGL usa MapLibre GL JS v6 (el 3D no depende de la fuente de tiles sino de la "
     "cámara: pitch 50 + bearing). En el WebView del APK — donde el WebGL cae — y en navegadores sin "
     "WebGL, corre un fallback react-leaflet con tiles ráster de OSM, sin rotación de mapa: el pin "
     "rota según el rumbo. Existe además un puente a MapLibre Native Android que quedó dormido "
     "(NATIVE_MAPS_ENABLED = false) tras comprobar que el WebView del dispositivo no renderizaba "
     "ninguna de las dos vías con aceleración. Tres lienzos comparten el mismo contrato de props y la "
     "misma lógica de cámara en navCanvasLogic.ts.")
add_table(story, "Tabla 2. Lienzos del minimapa y criterio de selección.",
    ["Lienzo", "Tecnología", "Cuándo se usa"],
    [
        ["NavCanvas", "MapLibre GL JS v6 (WebGL)", "Web con webgl2/webgl disponible y no es app nativa"],
        ["LeafletNav", "react-leaflet + tiles OSM", "APK (WebView sin WebGL) y navegadores sin WebGL"],
        ["NativeMapCanvas", "MapLibre Native vía puente", "Dormido: NATIVE_MAPS_ENABLED = false"],
    ], [0.22, 0.33, 0.45])
h2(story, "4.2 Estilo, capas y worker")
body(story, "El estilo MapLibre (navStyle.ts) define una única fuente ráster base con tiles de "
     "openstreetmap.org y fondo #dfe2e6; si la fuente acumula 5 errores de red, cambia a CyclOSM de "
     "OSM-France. Sobre esa base se montan capas GeoJSON propias en memoria: polígono del parque, "
     "círculos de riesgo (polígonos de 32 lados, porque las circle-layers usan píxeles y no metros), "
     "accesos, recorrido del ciclista en lima, ruta recorrida atenuada y ruta restante con cinco capas "
     "ordenadas (casing oscuro, ciclovía violeta, vía compartida blanca y chevrons de dirección "
     "generados con canvas 2D). El worker WebGL de MapLibre se sirve localmente "
     "(/maplibre-gl-worker.mjs) porque el bundler rompe la resolución automática por import.meta.url. "
     "Todo lo vectorial es GeoJSON propio: no hay fondo pregenerado ni SVGs del parque.")
h2(story, "4.3 Cámara estilo Waze")
body(story, "La cámara clava el pin abajo y centrado: el centro de proyección es la posición del "
     "ciclista y el padding superior mueve el punto de ancla al 30 % del alto. El bearing sigue el "
     "curso del GPS, o la dirección del próximo tramo si no hay curso, y gira siempre por el camino "
     "corto para evitar vueltas de 340 grados. El zoom sube de 16,5 a 17,4 en los últimos 150 m de "
     "llegada; tras el primer fix, la cámara transita con easeTo de 680 ms.")
code_block(story, "camara_waze")
h2(story, "4.4 La ruta dibujada nace en tu posición")
body(story, "buildRouteFeatures reconstruye en cada fix los features de ruta recorrida y restante "
     "proyectando la posición viva sobre la polilínea. Si la proyección dista más de 2 m pero menos de "
     "40 m (CONNECTOR_MAX_M), se antepone un chaflán posición → punto proyectado; jamás un cordón recto "
     "que corte la manzana. Los segmentos se agrupan por bandera de ciclovía para colorear el trazo.")
code_block(story, "route_features")
h2(story, "4.5 Capa UI y lecciones aprendidas")
bullets(story, [
    "<b>Orden [lon, lat].</b> MapLibre espera longitud primero; el bug v1.3.2 ponía la cámara en el Atlántico Sur. Hoy PARK_CENTER = [-70.636, -33.408] con comentarios en el código.",
    "<b>Marcadores DOM.</b> El puck del ciclista, la bandera de destino y las insignias de giro son marcadores HTML rotados a mano (hdg - map.getBearing()), no símbolos GL.",
    "<b>Interacción apagada.</b> dragPan y scrollZoom están en false: es un minimapa de navegación, no un explorador; el mapa grande (MapView.tsx, react-leaflet) sí permite explorar con buscador Pro.",
    "<b>ETA viva.</b> La barra inferior calcula la hora de llegada con la velocidad actual (o 15 km/h si estás detenido) y la píldora de calle actual usa streetAt() sobre la ruta.",
])

# ═══ 5 · Pipeline de datos locales ═══
h1(story, "5. Pipeline de datos locales")
h2(story, "5.1 Del OSM crudo al grafo")
body(story, "El callejero nace en scripts/build-red-ciclista.mjs: descarga la API 0.6 oficial de "
     "OpenStreetMap en una malla 3×3 con bbox S=-33.44, W=-70.65, N=-33.38, E=-70.59 (cerro, "
     "Bellavista y Providencia), filtra los ways con highway dentro de las 15 clases, marca ciclovía "
     "cuando highway=cycleway, cycleway=lane|track|shared_lane, cycleway:right/left=lane|track o hay "
     "path con bicycle=designated / segregated=yes, y deduplica nodos y aristas antes de escribir el "
     "JSON final. El resultado es determinista y reproducible: re-ejecutar el script regenera el grafo "
     "con la misma estructura.")
h2(story, "5.2 Geocercas calibradas")
body(story, "El perímetro del parque se calibró con calibrate.js (en navegador): baja el way "
     "168227059 completo (536 puntos), lo simplifica con Douglas-Peucker con epsilon de 0,00012 grados "
     "(unos 13 m) dividendo el anillo en dos cadenas, y geocodifica los POIs con Nominatim; la salida "
     "es scripts/osm-calibrated.json. De ahí scripts/gen-park.py genera src/lib/park.ts con el "
     "polígono, accesos y POIs. Advertencia del propio script: park.ts tiene secciones mantenidas a "
     "mano (NAV_DESTINATIONS, la meta de Plaza México, la cumbre corregida) que una re-ejecución "
     "pisaría. route-dist.py completa el ciclo midiendo con Dijkstra en Python las distancias reales "
     "de los segmentos Pro sobre el mismo grafo.")
figure(story, os.path.join(A, "diagrama2-pipeline.png"),
       "Figura 2. Pipeline completo: datos del terreno, doble compilación, backend Vercel y distribución.", max_h=330)

# ═══ 6 · Backend ═══
h1(story, "6. Backend: base de datos y autenticación")
h2(story, "6.1 Prisma + PostgreSQL")
body(story, "El datasource es PostgreSQL con URL desde entorno. El detalle que más dolores de cabeza "
     "evita es binaryTargets: sin el runtime rhel-openssl-3.0.x el build de Vercel pasa verde pero "
     "login, rides y pagos fallan en las funciones serverless (Amazon Linux 2023) porque el Query "
     "Engine no existe para ese runtime. En desarrollo corre un Postgres 17 embebido sin root "
     "(scripts/setup-postgres-dev.sh, binarios de @embedded-postgres, puerto 5433, base cumbre30) y en "
     "producción la base la crea Vercel desde su integración de Storage (Neon); las tablas se empujan "
     "con prisma db push contra la URL de Neon desde el computador.")
code_block(story, "prisma_gen")
add_table(story, "Tabla 3. Modelos de prisma/schema.prisma (8) y su papel.",
    ["Modelo", "Papel y claves"],
    [
        ["User", "email/username únicos, passwordHash, datos de bici; raíz de todas las relaciones con onDelete: Cascade"],
        ["Session", "Sesiones opacas en DB (token único, expiresAt) — no hay JWT"],
        ["PasswordReset", "Código de 6 dígitos con intentos y TTL; entrega por soporte, no por SMTP"],
        ["ProDelivery", "paymentId único: idempotencia de ventas (1 pago MP = 1 código)"],
        ["Ride", "Agregados del ride + clientId; índice (userId, dateISO); sin pista GPS"],
        ["Incident", "Reportes comunitarios con soft-delete (active)"],
        ["Friendship", "Autorelación User bidireccional (2 filas por amistad), única por par"],
        ["Achievement", "Logros desbloqueados, únicos por (userId, code), upsert desde el cliente"],
    ], [0.20, 0.80])
h2(story, "6.2 Autenticación propia: scrypt + sesiones opacas")
body(story, "La web no usa JWT ni next-auth (la dependencia está instalada pero sin uso): hashing con "
     "scrypt nativo de Node (64 bytes, salt de 16, comparación timingSafeEqual), sesión en la tabla "
     "Session con token opaco de 32 bytes y cookie httpOnly cumbre30_session con sameSite lax y 30 "
     "días de vida. Cada ruta API resuelve la sesión con getSessionUser(); no existe middleware "
     "central. El reset de contraseña usa un código de 6 dígitos con 5 intentos y TTL de 30 minutos "
     "que el soporte entrega tras verificar identidad — deliberadamente sin correo automático — y al "
     "acertar borra todas las sesiones activas en la misma transacción.")
code_block(story, "auth_hash")
h2(story, "6.3 Google Sign-In: solo nativo, sin servidor")
body(story, "No hay OAuth de Google en la web ni en el backend: ni callback, ni client secret, ni "
     "verificación de idToken en servidor. El botón Continuar con Google existe solo en el APK y está "
     "implementado a mano: GoogleAuthPlugin.java usa el SDK clásico de Play Services "
     "(GoogleSignIn con requestIdToken + requestEmail, sin Firebase), devuelve sub/email/name al "
     "WebView, y offlineAuth.ts guarda la cuenta en localStorage con PBKDF2 de 100.000 iteraciones "
     "(fallback SHA-256 en WebViews sin WebCrypto). Si el correo ya existía como cuenta local, se "
     "enlaza conservando km y logros. Requiere dos Client IDs OAuth en el mismo proyecto de Google "
     "Cloud: uno Android (paquete cl.cumbre30.app + SHA-1 del keystore) y uno Web cuyo ID viaja en el "
     "código. Para una réplica web con OAuth real habría que añadir el callback de Google y verificar "
     "el idToken server-side; el flujo actual elige deliberadamente cero dependencia de red.")
h2(story, "6.4 Eliminación de cuenta")
body(story, "El borrado es un único DELETE /api/auth/account con sesión válida: db.user.delete dispara "
     "el onDelete: Cascade del schema y elimina sesiones, rides, incidentes, logros y amistades en una "
     "sola operación; después se limpia la cookie. La puerta web (/eliminar-cuenta) confirma la "
     "irreversibilidad y, si no hay sesión, guía al usuario a entrar primero o a pedir el borrado por "
     "WhatsApp; en el APK offline se limpian las claves de localStorage del usuario.")
code_block(story, "borrar_cuenta")

# ═══ 7 · Integraciones de API ═══
h1(story, "7. Integraciones de API")
h2(story, "7.1 Mercado Pago: pago único con entrega automática")
body(story, "La app nunca contiene links de pago (requisito de Google Play); la venta vive en la web. "
     "El flujo: el comprador paga 6.500 CLP en el link de cobro único de Mercado Pago desde "
     "/cumbre30pro; MP notifica al webhook y además queda consultable en su API. El webhook acepta el "
     "formato v2 y el IPN legacy, pero nunca confía en el cuerpo del mensaje: siempre verifica el pago "
     "contra GET /v1/payments/{id} con MP_ACCESS_TOKEN. isProPayment exige status approved, moneda "
     "CLP, monto exacto y que la descripción no mencione aporte (el link de donaciones comparte "
     "cuenta).")
code_block(story, "ispro")
body(story, "La entrega es idempotente por paymentId único en la tabla ProDelivery: se genera el código "
     "HMAC del correo, se envía por Gmail y solo entonces se graba el registro — si el SMTP falla, el "
     "sync reintenta sin duplicar. Como red de seguridad, /api/mp/sync (protegido con MP_SYNC_TOKEN, "
     "disparado por cron-job.org cada 15 minutos) busca pagos aprobados de las últimas 48 horas y "
     "entrega los que no tengan registro; como respaldo manual existe /api/pro/send-code con secreto. "
     "El código es determinista: reenviar produce el mismo código.")
code_block(story, "deliver")
h2(story, "7.2 Correo: Gmail SMTP")
body(story, "El envío usa nodemailer contra smtp.gmail.com puerto 465 (SSL implícito) con una "
     "contraseña de aplicación de 16 caracteres (se limpian espacios al pegarla). La plantilla lleva "
     "la marca, el código y los pasos de activación. Gmail permite unos 500 correos diarios gratis; "
     "el plan documentado de migración es Resend si el volumen crece. Este SMTP se usa solo para "
     "códigos Pro.")
code_block(story, "gmail")
figure(story, os.path.join(A, "diagrama3-pro.png"),
       "Figura 3. Flujo de compra Pro end-to-end: de mpago.la a la activación offline en la app.", max_h=280)
h2(story, "7.3 Licencias Pro offline")
body(story, "El código C30P-XXXX-XXXX-XXXX-XXXX es base32 (RFC 4648 sin padding) de los primeros 10 "
     "bytes de HMAC-SHA256(secreto, email normalizado): determinista, verificable 100 % offline en la "
     "app recalculando el HMAC y comparando en tiempo constante (XOR acumulado). El secreto compartido "
     "vive en el APK y en el servidor (y en scripts/gen-license.mjs, el generador manual); el propio "
     "código documenta el límite: detiene la copia casual, no la ingeniería inversa. La activación "
     "queda en localStorage (cumbre30-pro-v1) y desbloquea GPX, segmentos, buscador e historial "
     "ilimitado. Para una réplica, este modelo evita servidores de licencias; si se requiere revocación, "
     "habría que migrar a códigos aleatorios con tabla server-side.")
code_block(story, "licencia")
h2(story, "7.4 Otras rutas del backend")
body(story, "El resto de la API mantiene el mismo patrón: todas las rutas declaran "
     "dynamic = force-dynamic con el comentario de la exportación estática, validan y clampean cada "
     "campo numérico antes de tocar Prisma, y devuelven errores genéricos en español. /api/me agrega "
     "perfil, estadísticas (solo rides GPS, excluye motorizados), logros, pines y amigos; /api/rides "
     "lista los últimos 100 y acepta PATCH para corregir la marca motorized por clientId; logros, "
     "amistades e incidencias siguen el patrón upsert/soft-delete descrito en la tabla de modelos. "
     "Para una réplica basta con portar este conjunto de rutas y su helper getSessionUser().")

# ═══ 8 · Doble compilación ═══
h1(story, "8. Doble compilación web y APK")
h2(story, "8.1 Un código, dos modos")
body(story, "El mismo árbol Next.js compila a dos artefactos. En Vercel: build estándar con API routes "
     "y Prisma contra Neon. En el APK: export-web.sh mueve src/app/api fuera del árbol, compila con "
     "NEXT_PUBLIC_STATIC=1 y STATIC_EXPORT=1 (output export, distDir build-static, imágenes "
     "unoptimized) y restaura la API al salir; el resultado es un sitio 100 % estático que Capacitor "
     "empaqueta. En modo estático, auth, licencias Pro, logros y amistades viven en localStorage con "
     "PBKDF2, y las rutas de datos dejan de existir. El interruptor de entorno es la única diferencia "
     "de comportamiento: el resto del código no se bifurca.")
add_table(story, "Tabla 5. Diferencias entre modos de compilación.",
    ["Aspecto", "Web (Vercel)", "APK (estático)"],
    [
        ["Backend", "API routes + Prisma + Neon", "Ninguno (src/app/api fuera del export)"],
        ["Auth", "Sesiones en DB + cookie httpOnly", "Cuentas locales PBKDF2 + Google Sign-In nativo"],
        ["Pro", "Código C30P validado offline igual", "Play Billing (build PLAY) o código C30P"],
        ["Rides", "localStorage + POST /api/rides", "Solo localStorage"],
        ["GPS", "watchPosition del WebView", "FGS nativo 1 Hz vía plugin RideNative"],
        ["Mapa", "MapLibre GL JS (WebGL)", "Leaflet con tiles ráster (WebGL cae)"],
    ], [0.16, 0.42, 0.42])
h2(story, "8.2 Capacitor y plugins nativos propios")
body(story, "capacitor.config.ts define appId cl.cumbre30.app y webDir build-static. Los plugins npm "
     "usados son @capacitor/browser (Custom Tabs, único canal para enlaces externos y jamás para "
     "pagos), filesystem, share, keep-awake y text-to-speech, más cordova-plugin-purchase para Play "
     "Billing. No existe @capacitor/geolocation: el GPS lo da el plugin propio RideNativePlugin.kt "
     "(permisos, FGS y hápticos) con RideLocationService.kt a 1 Hz y notificación persistente en el "
     "canal cumbre30_ride. Los plugins se registran en MainActivity.java antes de super.onCreate() — "
     "peculiaridad de Capacitor 8. Hay además un NativeMapPlugin (MapLibre Native bajo el WebView) hoy "
     "dormido y el GoogleAuthPlugin del capítulo 6.")
h2(story, "8.3 Build Android, firma y distribución")
body(story, "build.gradle fija versionCode 28 y versionName 1.8.2 (fuente única en src/lib/appVersion.ts "
     "para el catálogo web y la ficha de Play), minSdk 24 y compile/target 36. La firma debug usa un "
     "keystore committeado (SHA-1 registrado en Google Cloud para el Sign-In nativo) y la release usa "
     "android/keystore.properties con su keystore binario también committeado — decisión consciente "
     "para que la firma sea estable durante toda la vida de la app en Play. El flujo: export-web.sh → "
     "npx cap sync android → gradlew assembleDebug (APK directo) o bundleRelease (AAB para Play). Un "
     "workflow de GitHub Actions (build-apk.yml) repite el pipeline con Temurin 21 y sube el APK como "
     "artefacto en cada tag v*. El APK público se distribuye fuera de Play vía Google Drive con "
     "descarga directa (URL usercontent + confirm=t) y /api/apk como ruta estable.")

# ═══ 9 · Vercel ═══
h1(story, "9. Despliegue en Vercel")
h2(story, "9.1 vercel.json")
body(story, "El build lo manda vercel.json (no npm run build local, que es para el modo standalone del "
     "sandbox): prisma generate && next build. La región es gru1 (São Paulo) porque Vercel retiró "
     "Santiago/scl1 y el CLI la rechaza con Invalid region selector — vale la pena verificar la "
     "vigencia de regiones en cada réplica. Los redirects por host llevan la raíz de cumbregeo.cl y "
     "www al sitio público /geo, y el header X-Content-Type-Options nosniff aplica a todo.")
code_block(story, "verceljson")
h2(story, "9.2 Variables de producción")
add_table(story, "Tabla 6. Variables de entorno de producción y su función.",
    ["Variable", "Función"],
    [
        ["DATABASE_URL", "Postgres de Neon (sslmode=require); la conecta Vercel Storage"],
        ["MP_ACCESS_TOKEN", "Token de producción MP (APP_USR-…) para verificar pagos server-side"],
        ["GMAIL_USER / GMAIL_APP_PASSWORD", "SMTP emisor de códigos Pro (contraseña de aplicación de 16 caracteres)"],
        ["MP_SYNC_TOKEN", "Secreto que protege /api/mp/sync y /api/pro/send-code"],
        ["MP_PRO_AMOUNT", "Monto esperado de la venta Pro en CLP (6500)"],
        ["APK_DOWNLOAD_URL", "Destino del 302 de /api/apk; se lee en build, exige re-desplegar al cambiarla"],
        ["ADMIN_KEY", "Protege /api/licencia (documentada en código, falta en .env.example)"],
    ], [0.34, 0.66])
body(story, "No hay NEXT_PUBLIC_* necesarias en la web de producción: STATIC_EXPORT y PLAY_BUILD son "
     "interruptores de empaquetado del APK. Las tablas se crean desde el computador con prisma db "
     "push contra la URL de Neon, no hay migraciones pendientes en el pipeline de Vercel.")
h2(story, "9.3 Flujo real de despliegue por CLI", toc=False)
bullets(story, [
    "<b>1. Link:</b> npx vercel link --project cumbre30 --scope cumbre-geo (verificar .vercel/project.json: el link automático detecta el nombre de la carpeta y puede apuntar a un proyecto equivocado; además pisa .env.local con VERCEL_OIDC_TOKEN).",
    "<b>2. Deploy:</b> npx vercel deploy --prod --yes — build remota y alias a cumbregeo.cl.",
    "<b>3. Verificación viva:</b> / 307 a /geo · /geo 200 con marcadores de la build · /cumbre30pro y /pro 307 a /geo?vista=planes&app=cumbre30 · /privacidad y /eliminar-cuenta 200 · /api/apk 302 al APK.",
    "<b>4. Env vars por CLI:</b> vercel env add NOMBRE production (y redeploy si la variable se lee en build).",
])
body(story, "El dominio propio se apunta con un registro A 76.76.21.21 y CNAME cname.vercel-dns.com. "
     "El coste completo del pipeline es cero en el plan Hobby: Vercel Hobby, Neon free (0,5 GB), "
     "GitHub Releases para el APK y cron-job.org para el sync de pagos.")

# ═══ 10 · Checklist ═══
h1(story, "10. Checklist de réplica")
body(story, "La tabla siguiente ordena la réplica del modelo completo en otra app, con el criterio de "
     "verificación de cada fase. Los pasos son acumulativos: cada fase depende de la anterior.")
add_table(story, "Tabla 7. Checklist de réplica por fases.",
    ["Fase", "Acción", "Verificación"],
    [
        ["1. Datos", "Delimitar bbox del sector; adaptar build-red-ciclista.mjs y correrlo", "red-ciclista.json con nodos/aristas y ciclovías del nuevo sector"],
        ["2. Geocercas", "Calibrar polígono (calibrate.js) y generar el park.ts equivalente", "pointInPolygon correcto en puntos de prueba dentro/fuera"],
        ["3. DB", "Schema Prisma con binaryTargets; Postgres embebido local; Neon en Vercel", "setup-postgres-dev.sh levanta PG 5433; db push contra Neon OK"],
        ["4. Auth", "Portar auth.ts (scrypt + sesiones) y rutas auth/*; decidir OAuth web aparte", "Registro/login/logout/reset y DELETE account con cascade"],
        ["5. Pagos", "Link único MP; webhook + sync con verificación server-side; plantilla Gmail", "Pago de prueba entrega 1 código; sync re-entrega sin duplicar"],
        ["6. Licencia", "PRO_LICENSE_SECRET propio en app + servidor + generador CLI", "validateProCode offline OK; código distinto por correo"],
        ["7. Web", "vercel.json (buildCommand + región vigente + redirects por host); env vars", "Deploy verde; rutas 200/307 esperadas; dominio DNS apuntado"],
        ["8. APK", "export-web.sh + cap sync + gradle; keystore estable; CI de tags", "APK instala y ride completo funciona sin conexión"],
        ["9. Play", "Ficha con política de privacidad y eliminación de cuenta accesibles", "Accesos visibles en el detalle de la app (modal) y web"],
        ["10. Ops", "cron-job.org 15 min al sync; GitHub Releases del APK; APK_DOWNLOAD_URL", "Código llega incluso si el webhook falla; /api/apk 302 correcto"],
    ], [0.13, 0.44, 0.43])
h2(story, "10.1 Qué se reutiliza tal cual y qué es específico", toc=False)
bullets(story, [
    "<b>Reutilizable sin cambios:</b> motor GPS (useRideEngine, geo.ts, alertEngine, vehicleDetect), ruteo (routing.ts, routingService, useNavEngine), minimapa (MiniMap, navStyle, navCanvasLogic, LeafletNav), backend (auth, MP, Gmail, licencias), vercel.json y el pipeline de doble compilación.",
    "<b>Específico del proyecto a reemplazar:</b> park.ts (polígono, accesos, zonas y destinos del cerro San Cristóbal), la bbox del grafo, los umbrales de dominio (LIMIT_KMH 30, radios de geofence, VEH_*) y la marca (iconos, colores, appId, textos Play).",
    "<b>Decisiones conscientes a revisar en la réplica:</b> secrets de firma Android y secreto HMAC committeados (estabilidad de firma vs rotación), ADMIN_KEY documentada solo en código, idToken de Google sin verificación server-side (flujo offline deliberado) y tope freemium de 20 rides hardcodeado.",
])
body(story, "Con las diez fases verificadas, la réplica queda operando con el mismo modelo completo: "
     "datos propios offline, un código que compila a web y APK, backend serverless barato, pagos con "
     "entrega automática y distribución dual (Play + APK directo).")

# ── Build ──
doc = TocDocTemplate(
    OUT_PDF, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    title=DOC_TITLE, author="Z.ai", creator="Z.ai",
    subject="Documentación técnica interna: motor GPS, minimapa y pipeline de producción de Cumbre30",
)
doc.multiBuild(story)
print("OK body ->", OUT_PDF)
