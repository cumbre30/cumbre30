# -*- coding: utf-8 -*-
"""INFORME_AUDITORIA_INTEGRAL_CUMBRE30.pdf — cuerpo (ReportLab, ruta Report del skill pdf).
Portada Template 07 Crystal Blue (HTML/Playwright, merge con pypdf).
Paleta fija del Template 07 (familia azul ~215°). Numeración: TOC romano, cuerpo arábigo.
"""
import sys, os, hashlib

PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))
sys.path.insert(0, "/home/z/my-project/scripts")

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, KeepTogether, CondPageBreak,
                                NextPageTemplate, PageTemplate, Frame)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ─── Fuentes (solo las 6 permitidas por el brief) ───
FONT_DIR = "/usr/share/fonts"
pdfmetrics.registerFont(TTFont("NotoSerifSC", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC-Bold", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Noto Sans SC", f"{FONT_DIR}/truetype/chinese/NotoSansSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Noto Sans SC Bold", f"{FONT_DIR}/truetype/chinese/NotoSansSC-Bold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif", f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans", f"{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf"))
registerFontFamily("NotoSerifSC", normal="NotoSerifSC", bold="NotoSerifSC-Bold")
registerFontFamily("Noto Sans SC", normal="Noto Sans SC", bold="Noto Sans SC Bold")
registerFontFamily("FreeSerif", normal="FreeSerif", bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")
registerFontFamily("DejaVuSans", normal="DejaVuSans", bold="DejaVuSans")

from pdf import install_font_fallback
install_font_fallback()

# ─── Paleta fija Template 07 Crystal Blue (cuerpo claro, familia azul 215°) ───
PAGE_BG      = colors.HexColor("#f5f8fc")   # XL
SECTION_BG   = colors.HexColor("#edf2f9")   # XL
CARD_BG      = colors.HexColor("#e4ecf5")   # L
TABLE_STRIPE = colors.HexColor("#eef3fa")   # L
HEADER_FILL  = colors.HexColor("#1a4a7a")   # M
BORDER       = colors.HexColor("#c0d0e2")   # S
ACCENT       = colors.HexColor("#2d7ab3")   # XS
ACCENT_2     = colors.HexColor("#4da8da")   # XS (portada)
TEXT_PRIMARY = colors.HexColor("#142840")
TEXT_MUTED   = colors.HexColor("#5a7a96")
TABLE_HEADER_COLOR = HEADER_FILL
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD  = TABLE_STRIPE
SEM_NEG = colors.HexColor("#8a3033")  # semántico bajo (crítico), misma familia apagada
SEM_WARN = colors.HexColor("#8a6d30")  # semántico medio/alto

# ─── Documento ───
OUT_BODY = "/tmp/informe_cuerpo.pdf"
MARGIN = 0.9 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - 2 * MARGIN
H1_THRESHOLD = AVAIL_H * 0.25

DOC_TITLE = "Auditoría integral de cumplimiento legal, privacidad y seguridad — Cumbre30"

# ─── Estilos ───
S = {}
S["h1"] = ParagraphStyle("H1", fontName="FreeSerif", fontSize=19, leading=25,
                         textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10)
S["h2"] = ParagraphStyle("H2", fontName="FreeSerif", fontSize=14, leading=19,
                         textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8)
S["h3"] = ParagraphStyle("H3", fontName="FreeSerif", fontSize=11.5, leading=16,
                         textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6)
S["body"] = ParagraphStyle("Body", fontName="FreeSerif", fontSize=10.5, leading=16.5,
                           textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=8)
S["bullet"] = ParagraphStyle("Bullet", parent=S["body"], leftIndent=16, bulletIndent=4,
                             spaceAfter=4, alignment=TA_LEFT)
S["quote"] = ParagraphStyle("Quote", parent=S["body"], fontName="FreeSerif-Italic",
                            leftIndent=24, textColor=TEXT_MUTED)
S["caption"] = ParagraphStyle("Caption", fontName="FreeSerif", fontSize=8.5, leading=12,
                              textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)
S["cell"] = ParagraphStyle("Cell", fontName="FreeSerif", fontSize=8.5, leading=11.5,
                           textColor=TEXT_PRIMARY, alignment=TA_LEFT)
S["cellc"] = ParagraphStyle("CellC", parent=S["cell"], alignment=TA_CENTER)
S["th"] = ParagraphStyle("TH", fontName="FreeSerif", fontSize=9, leading=12,
                         textColor=colors.white, alignment=TA_CENTER)
S["callout_num"] = ParagraphStyle("CallN", fontName="FreeSerif", fontSize=20, leading=24,
                                  textColor=ACCENT, alignment=TA_CENTER)
S["callout_lbl"] = ParagraphStyle("CallL", fontName="FreeSerif", fontSize=8.5, leading=11,
                                  textColor=TEXT_MUTED, alignment=TA_CENTER)
S["toc0"] = ParagraphStyle("TOC0", fontName="FreeSerif", fontSize=11.5, leading=20, textColor=TEXT_PRIMARY)
S["toc1"] = ParagraphStyle("TOC1", fontName="FreeSerif", fontSize=10, leading=16,
                           leftIndent=18, textColor=TEXT_MUTED)
S["toc_title"] = ParagraphStyle("TOCT", fontName="FreeSerif", fontSize=18, leading=24,
                                textColor=HEADER_FILL, spaceAfter=14)
S["anexo"] = ParagraphStyle("Anexo", parent=S["body"], fontSize=10, leading=15.5)

# ─── Plantilla con TOC + numeración en dos zonas ───
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._front_pages = 0  # páginas de índice (numeradas en romano)

    def afterFlowable(self, flowable):
        if hasattr(flowable, "front_end_marker"):
            self._front_pages = self.page - 1
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            page_disp = self.page - self._front_pages if self._front_pages else self.page
            self.notify("TOCEntry", (level, text, page_disp, key))

ROMAN = {1: "i", 2: "ii", 3: "iii", 4: "iv", 5: "v", 6: "vi", 7: "vii", 8: "viii"}

def _chrome(canv, doc, num_roman):
    """Fondo, cabecera y pie (el número solo; nunca 'página X de Y')."""
    canv.saveState()
    canv.setFillColor(PAGE_BG)
    canv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # cabecera
    canv.setFont("FreeSerif", 7.5)
    canv.setFillColor(TEXT_MUTED)
    canv.drawString(MARGIN, PAGE_H - 0.55 * inch, "CUMBRE30 · Auditoría integral — diagnóstico")
    canv.setStrokeColor(ACCENT)
    canv.setLineWidth(1.2)
    canv.line(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - MARGIN, PAGE_H - 0.62 * inch)
    # pie
    canv.setStrokeColor(BORDER)
    canv.setLineWidth(0.6)
    canv.line(MARGIN, 0.62 * inch, PAGE_W - MARGIN, 0.62 * inch)
    canv.setFont("FreeSerif", 7.5)
    canv.setFillColor(TEXT_MUTED)
    canv.drawString(MARGIN, 0.42 * inch, "Informe de auditoría pre-lanzamiento Chile · 2026-11-18")
    if num_roman:
        n = ROMAN.get(doc.page, str(doc.page))
    else:
        n = str(doc.page - doc._front_pages) if doc._front_pages else str(doc.page)
    canv.drawRightString(PAGE_W - MARGIN, 0.42 * inch, n)
    canv.restoreState()

def on_front(canv, doc):
    _chrome(canv, doc, num_roman=True)

def on_body(canv, doc):
    _chrome(canv, doc, num_roman=False)

# ─── Helpers de contenido ───
story = []

def h1(text, level=0):
    key = "h_" + hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', S["h1"])
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def sec(num, text):
    """H1 con protección de huérfano (umbral 25 %)."""
    story.append(CondPageBreak(H1_THRESHOLD))
    story.append(h1(f"{num}. {text}"))

def anexo(num, text):
    story.append(CondPageBreak(H1_THRESHOLD))
    story.append(h1(f"{num} — {text}"))

def h2(text):
    story.append(Paragraph(f"<b>{text}</b>", S["h2"]))

def h3(text):
    story.append(Paragraph(f"<b>{text}</b>", S["h3"]))

def body(text):
    story.append(Paragraph(text, S["body"]))

def bullets(items):
    for it in items:
        story.append(Paragraph(it, S["bullet"], bulletText="•"))
    story.append(Spacer(1, 6))

def nb(t):
    """Evita puntuación al inicio de línea: guiones largos pegados a la palabra
    anterior y celdas cuyo único contenido es un guión."""
    t = str(t).replace(" — ", "\u00a0— ").replace(" —", "\u00a0—")
    if t.strip() == "—":
        return "n/a"
    return t

def tabla(headers, rows, ratios, caption=None, font=8.5, num_color_col=None, color_map=None):
    """Tabla estándar: celdas siempre Paragraph, anchos proporcionales, centrada."""
    assert abs(sum(ratios) - 1.0) < 0.01, "ratios deben sumar 1"
    widths = [r * AVAIL_W for r in ratios]
    assert sum(widths) <= AVAIL_W + 0.5
    cell = ParagraphStyle("c2", parent=S["cell"], fontSize=font, leading=font + 3)
    cellc = ParagraphStyle("cc2", parent=cell, alignment=TA_CENTER)
    data = [[Paragraph(f"<b>{h}</b>", S["th"]) for h in headers]]
    style_i = [0]
    for row in rows:
        pr = []
        for j, v in enumerate(row):
            es_centro = (num_color_col is not None and j == num_color_col)
            st = cellc if es_centro else cell
            if isinstance(v, Paragraph):
                pr.append(v)
            elif num_color_col is not None and j == num_color_col and color_map and str(v).upper() in color_map:
                fcol = color_map[str(v).upper()]
                style_i[0] += 1
                st2 = ParagraphStyle(f"csem{style_i[0]}", parent=cellc, textColor=fcol)
                pr.append(Paragraph(f"<b>{v}</b>", st2))
            else:
                pr.append(Paragraph(nb(v), st))
        data.append(pr)
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="CENTER")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        style.append(("BACKGROUND", (0, i), (-1, i), TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD))
    t.setStyle(TableStyle(style))
    story.append(Spacer(1, 10))
    story.append(t)
    if caption:
        story.append(Paragraph(caption, S["caption"]))
    story.append(Spacer(1, 10))

def callouts(items):
    """Fila de métricas destacadas (Data-to-Ink)."""
    cells, widths = [], []
    for num, lbl in items:
        inner = Table([[Paragraph(f"<b>{num}</b>", S["callout_num"])],
                       [Paragraph(lbl, S["callout_lbl"])]], colWidths=[AVAIL_W / len(items) - 12])
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("BOX", (0, 0), (-1, -1), 0.8, ACCENT),
            ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
            ("TOPPADDING", (0, -1), (-1, -1), 2),
        ]))
        cells.append(inner)
        widths.append(AVAIL_W / len(items))
    wrap = Table([cells], colWidths=widths, hAlign="CENTER")
    wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 3),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    story.append(Spacer(1, 8))
    story.append(wrap)
    story.append(Spacer(1, 10))

def callout_text(text):
    t = Table([[Paragraph(text, S["body"])]], colWidths=[AVAIL_W - 8])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SECTION_BG),
        ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 6))
    story.append(t)
    story.append(Spacer(1, 8))

class FrontEndMarker(Spacer):
    """Marcador invisible: registra cuántas páginas ocupa el índice."""
    def __init__(self):
        super().__init__(1, 0.01)
        self.front_end_marker = True

# ═══════════════════════════════════════════════════════════════════
# CONTENIDO (fuente única de verdad: scripts/aud_*.py)
# ═══════════════════════════════════════════════════════════════════
from aud_riesgos import RIESGOS, MODULOS
from aud_legal import CUMPLIMIENTO, DATOS, GEOCERCAS, LICENCIAS
from aud_plan import REMEDIACION, CHECKLIST

NIVEL_MAP = {"CRÍTICO": SEM_NEG, "ALTO": SEM_WARN, "MEDIO": TEXT_PRIMARY, "BAJO": TEXT_MUTED}
ESTADO_MAP = {"CUMPLE": colors.HexColor("#2f6d43"), "PARCIAL": SEM_WARN,
              "FALTA": SEM_NEG, "NO APLICA": TEXT_MUTED,
              "PENDIENTE": TEXT_MUTED, "NO VERIFICADO": TEXT_MUTED}
conteo = {}
for r in RIESGOS:
    conteo[r[7]] = conteo.get(r[7], 0) + 1

# ─── Índice (front matter, numeración romana) ───
toc = TableOfContents()
toc.levelStyles = [S["toc0"], S["toc1"]]
story.append(Paragraph("<b>Índice</b>", S["toc_title"]))
story.append(toc)
story.append(NextPageTemplate("body"))
story.append(PageBreak())
story.append(FrontEndMarker())

# ═══ 1. Resumen ejecutivo ═══
sec(1, "Resumen ejecutivo")
body("Cumbre30 es un ciclocomputador GPS para el Cerro San Cristóbal construido sobre "
     "Next.js 16 con envoltorio Capacitor 8 (identificador cl.cumbre30.app), backend propio en "
     "Vercel con base de datos Postgres en Neon, autenticación con Google Sign-In validada en el "
     "servidor, pagos Pro con Mercado Pago y Google Play Billing, y distribución actual del APK "
     "fuera de Google Play. El titular es una persona natural y la primera versión es gratuita. "
     "Esta auditoría, de carácter diagnóstico, revisó el repositorio completo y la normativa "
     "chilena aplicable con fecha de referencia 18 de noviembre de 2026, sin modificar una sola "
     "línea de código.")
callouts([(str(conteo.get("CRÍTICO", 0)), "Riesgos CRÍTICOS"),
          (str(conteo.get("ALTO", 0)), "Riesgos ALTOS"),
          (str(conteo.get("MEDIO", 0)), "Riesgos MEDIOS"),
          (str(conteo.get("BAJO", 0)), "Riesgos BAJOS"),
          (str(len(REMEDIACION)), "Correcciones planificadas")])
body("La conclusión central es doble. Primero, la base técnica es sólida y supera con holgura lo "
     "habitual en apps de nicho: contraseñas con scrypt y tokens opacos, verificación del webhook "
     "de Mercado Pago contra la API oficial, comprobaciones de titularidad en los endpoints de "
     "datos, pista GPS que nunca abandona el dispositivo y trazabilidad documentada de cada "
     "geocerca. Segundo, el lanzamiento público en Chile tiene bloqueantes serios de naturaleza "
     "documental y regulatoria: no existen Términos y Condiciones ni Política de Privacidad "
     "publicados (R-01), el programa de la Ley 21.719 no está implementado (R-02), y el marco del "
     "parque cambia el 15 de diciembre de 2026 con el plan Pedalea Seguro (R-09). Además, el "
     "secreto que genera los códigos Pro viaja dentro del APK (R-03), lo que permite emitir "
     "licencias pagadas de forma ilimitada y gratuita.")
body("Dos hitos normativos recientes condicionan el calendario. El Congreso aprobó el 17 de "
     "noviembre de 2026 posponer la entrada en vigencia de la Ley 21.719 desde el 1 de diciembre "
     "de 2026 al 15 de octubre de 2027 (pendiente de publicación oficial; durante la transición "
     "sigue rigiendo la Ley 19.628). Y Google Play fijó para el 27 de enero de 2027 la "
     "obligatoriedad de su nueva política de permisos de ubicación. Ninguno de los dos hitos "
     "elimina trabajo: desplazan y reordenan el calendario de cumplimiento. La recomendación es "
     "ejecutar las Fases A y B del plan de remediación antes de cualquier publicación, mantener "
     "el lanzamiento gratuito sin promesas de emergencia que el sistema no cumple, y posponer la "
     "comercialización Pro hasta rotar el secreto de licencias y validar el régimen tributario.")

# ═══ 2. Alcance y metodología ═══
sec(2, "Alcance y metodología")
body("El encargo definió diez fases: inventario técnico, auditoría jurídica chilena, análisis por "
     "módulo, privacidad y Ley 21.719, seguridad cloud, propiedad intelectual, regulación de "
     "Parquemet, documentación necesaria, matriz de riesgos y plan de remediación. Todas las "
     "fases se ejecutaron en modo diagnóstico. Se inspeccionaron los módulos clave del código "
     "(autenticación, sincronización, geocercas, detección de caídas, contactos ICE, sensores "
     "Bluetooth, licencias Pro, pagos y notificaciones), el manifiesto Android, el esquema de "
     "base de datos y la documentación interna del proyecto. No se modificó código, no se "
     "alteraron bases de datos ni infraestructura, y no se ejecutaron pruebas intrusivas sobre "
     "servicios en producción.")
body("La investigación normativa se basó en textos oficiales consolidados de la Biblioteca del "
     "Congreso Nacional (Ley Chile) y en fuentes institucionales; las noticias se usaron solo "
     "para dos situaciones que aún no tienen texto publicado: la postergación de la Ley 21.719 "
     "aprobada por el Congreso el 17 de noviembre de 2026 y el plan Pedalea Seguro anunciado por "
     "el MINVU el 6 de noviembre de 2026. En ambos casos el informe distingue explícitamente el "
     "anuncio institucional de la norma formal vigente y recomienda verificar la publicación "
     "oficial antes de depender de ella. Todo lo que no pudo verificarse queda marcado como NO "
     "VERIFICADO en las matrices que acompañan al informe.")
body("Las pruebas de seguridad solicitadas para la Fase 5 se limitaron a revisión estática de "
     "código y de configuración (no destructivas y sin datos de usuarios). El detalle de lo "
     "verificado y lo que queda pendiente de prueba en entorno controlado está en el capítulo 8.")

# ═══ 3. Arquitectura identificada ═══
sec(3, "Arquitectura identificada")
h2("3.1 Pila tecnológica e infraestructura")
body("La aplicación es un híbrido: una web Next.js 16 (React 19, TypeScript, Tailwind 4, Prisma 6) "
     "exportada estáticamente y empaquetada por Capacitor 8 para Android (y con carpeta iOS "
     "preparada pero sin permisos declarados). La API vive en el despliegue web (cumbregeo.cl) y "
     "el APK la consume por HTTPS con token Bearer; las rutas API no viajan dentro del APK. La "
     "base de datos es Postgres en Neon accedida por Prisma desde funciones serverless de Vercel "
     "con el binario para rhel-openssl-3.0.x. El APK se distribuye vía GitHub Release y el "
     "endpoint /api/apk lo redirige.")
tabla(["Componente", "Tecnología", "Rol y evidencia"],
      [("App móvil", "Capacitor 8 + WebView (cl.cumbre30.app)", "capacitor.config.ts; android/ con Gradle"),
       ("Web/API", "Next.js 16, React 19, TypeScript", "package.json; export estático para el APK"),
       ("Base de datos", "PostgreSQL (Neon) + Prisma 6", "prisma/schema.prisma; binaryTargets rhel-openssl"),
       ("Autenticación", "Propia (scrypt) + Google Sign-In nativo", "src/lib/auth.ts; /api/auth/google valida tokeninfo"),
       ("Pagos Pro", "Mercado Pago (web) + Play Billing (APK)", "/api/mp/webhook; src/lib/playBilling.ts"),
       ("Mapas", "Leaflet + MapLibre GL + grafo OSM propio (~58k aristas)", "public/red-ciclista.json; attribution ODbL"),
       ("Sensores", "BLE nativo (HRM/CSC) + Web Bluetooth", "src/lib/sensors.ts; @capacitor-community/bluetooth-le"),
       ("Notificaciones", "Locales + Web Push VAPID (web)", "@capacitor/local-notifications; prisma PushSub"),
       ("Distribución", "GitHub Release + /api/apk", ".env.example APK_DOWNLOAD_URL")],
      [0.16, 0.36, 0.48], caption="Tabla 3.1 — Pila tecnológica verificada en el repositorio.")
h2("3.2 Permisos Android y servicios")
body("El manifiesto declara un conjunto acotado y bien justificado: INTERNET, ACCESS_FINE_LOCATION "
     "y ACCESS_COARSE_LOCATION para el ciclocomputador, FOREGROUND_SERVICE y "
     "FOREGROUND_SERVICE_LOCATION para el servicio RideLocationService a 1 Hz con pantalla "
     "bloqueada, POST_NOTIFICATIONS, VIBRATE y WAKE_LOCK, y BLUETOOTH_SCAN con la bandera "
     "neverForLocation. No se declara ACCESS_BACKGROUND_LOCATION, lo que simplifica enormemente "
     "la evaluación de Play y la legitimidad del tratamiento. Dos elementos requieren atención: "
     "allowBackup=\"true\" sin dataExtractionRules (R-04) y el MediaListenerService con "
     "BIND_NOTIFICATION_LISTENER_SERVICE, que existe solo para controlar la música de otras apps "
     "y exige el consentimiento explícito del usuario en ajustes de Android.")
h2("3.3 Modelo de datos")
body("El esquema Prisma define once modelos: User, Session, PasswordReset, ProDelivery, Ride, "
     "Incident, Friendship, Achievement, Constancia, PushSub y RideShare. El dato relevante para "
     "privacidad es estructural: la tabla Ride guarda únicamente estadísticas agregadas (fecha, "
     "distancia, velocidades, desnivel, segundos sobre el límite, kilómetros dentro del parque), "
     "sin coordenadas. La pista GPS completa de cada recorrido vive en IndexedDB dentro del "
     "dispositivo y solo sale de él cuando el titular exporta GPX o PDF. Los reportes de "
     "incidencias sí publican latitud y longitud del punto reportado, y las constancias exponen "
     "un hash SHA-256 con payload consultable públicamente (R-11).")

# ═══ 4. Análisis por módulo ═══
sec(4, "Análisis por módulo (A–M)")
body("El inventario funcional completo, con la distinción implementado/parcial/proyectado y sus "
     "observaciones, está en la Tabla 4.1 y en la hoja «Inventario funcional» de "
     "INVENTARIO_DATOS_Y_PRIVACIDAD_CUMBRE30.xlsx. A continuación se resumen los módulos con "
     "hallazgos relevantes; el resto mantiene un estado satisfactorio para una primera versión "
     "gratuita.")
tabla(["Módulo", "Implementado", "Parcial", "Proyectado", "Observaciones"],
      [(m[0].split(". ", 1)[1], m[1], m[2], m[3], (m[4][:150] + "…") if len(m[4]) > 150 else m[4])
       for m in MODULOS],
      [0.17, 0.10, 0.08, 0.11, 0.54], caption="Tabla 4.1 — Inventario funcional (Fase 1).", font=7.5)
h2("4.1 Cuenta y autenticación (A)")
body("El registro propio pide correo, usuario y contraseña (mínimo 6 caracteres, scrypt con salt "
     "en servidor y PBKDF2 100k en modo local). Las sesiones son tokens opacos de 32 bytes en "
     "base de datos con expiración a 30 días, entregados por cookie httpOnly en web y por "
     "Authorization: Bearer en el APK. El flujo Google valida el idToken contra tokeninfo "
     "comprobando audiencia, correo verificado y vigencia. Existe eliminación de cuenta con "
     "borrado en cascada. Los huecos son de endurecimiento: sin limitación de tasa en login y "
     "registro (R-12), sin revocación global de sesiones (R-17) y sin verificación de edad "
     "(R-08).")
h2("4.2 GPS, mapas y geocercas (B y C)")
body("La ubicación se captura en primer plano a 1 Hz durante el ride mediante un servicio en "
     "primer plano con notificación persistente. Las geocercas están clasificadas en "
     "INFORMATIVE, SAFETY y OFFICIAL_RESTRICTION, con siete campos de trazabilidad por id y una "
     "regla dura verificada por regresión: lo que provenga únicamente de OpenStreetMap nunca "
     "puede clasificarse como restricción oficial. La atribución ODbL está implementada con "
     "enlaces en ambos mapas y en una tarjeta de fuentes dentro de la app. El riesgo abierto no "
     "es técnico sino de fuente: las restricciones «oficiales» citan a la administración del "
     "parque sin resolución pública (R-09) y el plan Pedalea Seguro cambia el marco el 15 de "
     "diciembre de 2026.")
h2("4.3 Velocidad, caídas y emergencias (E, F y G)")
body("El límite de 30 km/h es una norma administrativa de Parquemet dentro del parque; la app lo "
     "trata correctamente como límite orientativo del sistema propio, diferencia parque y "
     "ciudad, y su flag motorized evita premiar tramos en vehículo. La detección de caídas es "
     "100 % GPS (el acelerómetro se retiró por fiabilidad del WebView), opera solo dentro del "
     "parque con anti-falsos-positivos documentados y nunca actúa sola: abre una cuenta "
     "regresiva «¿Estás bien?» y, si expira, prepara el aviso a los contactos ICE configurados "
     "por el usuario (máximo 3, solo en localStorage) mediante un mensaje con ubicación que sale "
     "por la app de mensajería del sistema. Los límites de este circuito — falsos negativos de "
     "caídas lentas, dependencia de batería y red, ausencia de llamada automática a ambulancias — "
     "deben comunicarse explícitamente (R-10) para no crear una expectativa de asistencia que la "
     "app no cumple.")
h2("4.4 QR, comunidad, Spotify y Pro (H–L)")
body("No existe un QR identificador propio de usuario: el QR de la app va en las constancias de "
     "trayecto (verificación pública por hash) y la credencial QR «Pedalea Seguro» que la app "
     "guarda es la imagen emitida por Parquemet para el propio ciclista, diferenciada del QR de "
     "verificación (R-18). La integración con Spotify no es una integración: es control de "
     "reproducción vía MediaSessionManager de Android, sin OAuth, sin API de Spotify y sin "
     "transferencia de datos hacia Spotify; solo requiere el permiso de acceso a notificaciones "
     "que Android impone a cualquier controlador de media. La comunidad actual es de bajo riesgo "
     "(amistad mutua, ranking entre amigos, incidencias con moderación por frescura de 30 días) "
     "y el plan Pro ya tiene ambos canales de cobro preparados, con el secreto de licencias "
     "comprometido como hallazgo principal (R-03).")

# ═══ 5. Normativa aplicable ═══
sec(5, "Normativa aplicable")
body("La Tabla 5.1 resume el estado de cumplimiento por norma, con la fuente oficial y la "
     "evidencia correspondiente; la matriz completa con acciones y prioridades está en "
     "MATRIZ_CUMPLIMIENTO_LEGAL_CUMBRE30.xlsx. Tres apreciaciones generales. Primera: durante la "
     "transición sigue rigiendo la Ley 19.628, cuyas exigencias de transparencia la app ya "
     "satisface parcialmente dentro de la propia interfaz, pero no en documentos formales. "
     "Segunda: la Ley 21.663 de Ciberseguridad no aplica a Cumbre30 porque la app no es un "
     "servicio esencial ni operador de importancia vital; su relevancia es de buenas prácticas. "
     "Tercera: la Ley de Tránsito clasifica la bicicleta como vehículo y fija velocidades por "
     "señalización (20 km/h en ciclovías según la guía CONASET, 30 km/h en ciclocalles), pero el "
     "límite de 30 km/h del parque es de origen administrativo (Parquemet), y así debe "
     "comunicarlo la app.")
tabla(["Norma / fuente", "Obligación central", "Estado", "Acción prioritaria"],
      [(c[0], (c[1][:160] + "…") if len(c[1]) > 160 else c[1], c[3],
        (c[5][:120] + "…") if len(c[5]) > 120 else c[5]) for c in CUMPLIMIENTO],
      [0.22, 0.40, 0.12, 0.26], caption="Tabla 5.1 — Cumplimiento por norma (detalle en xlsx).",
      font=7.5, num_color_col=2, color_map=ESTADO_MAP)

# ═══ 6. Hallazgos y evidencias ═══
sec(6, "Hallazgos y evidencias")
body("Los veinte riesgos del registro se construyeron con evidencia de repositorio en cada caso; "
     "ninguno es especulativo. Los dos críticos comparten raíz: la app funciona mejor de lo que "
     "documenta. R-01: las tarjetas de Ayuda describen con honestidad lo que el código hace, "
     "pero no existen los documentos legales formales que Play Store, la Ley 19.496 y la ley de "
     "datos exigen (sin rutas /terminos ni /privacidad en el sitio). R-02: no hay registro de "
     "actividades de tratamiento, consentimientos granulares, procedimientos de derechos ni "
     "contratos de encargado documentados; la buena base técnica (datos mínimos, borrado de "
     "cuenta completo) reduce el costo de remediarlo pero no lo sustituye.")
body("Entre los altos, R-03 es el de mayor impacto directo: el secreto HMAC que deriva los "
     "códigos C30P está en proLicenseCore.ts y viaja en el APK público; el propio comentario del "
     "código lo reconoce. La consecuencia es concreta: cualquier persona puede generar licencias "
     "Pro válidas sin pagar y sin posibilidad de revocación, porque la validación es offline. "
     "R-04 (allowBackup sin reglas de exclusión) puede llevar contactos de emergencia y la "
     "credencial del usuario al backup de Google. R-05 y R-06 implican datos sensibles y de "
     "terceros: la frecuencia cardíaca BLE es dato de salud para la ley chilena y exige "
     "consentimiento explícito; los contactos ICE son datos de terceros que la política debe "
     "cubrir. R-07 documenta que la ubicación alimenta consultas a Photon (Komoot), Nominatim "
     "(OSM) y Open-Meteo, transferencias que hoy no están informadas y que además dependen de "
     "políticas de uso de terceros.")
body("Los medios y bajos completan el mapa: menores sin verificación de edad (R-08), geocercas "
     "oficiales sin documento público citable frente al plan Pedalea Seguro (R-09), expectativa "
     "de asistencia en el circuito de caídas (R-10), username visible en la verificación pública "
     "de constancias (R-11), endurecimiento de API de autenticación (R-12), régimen tributario y "
     "condiciones comerciales de la venta Pro (R-13), marca no registrada en INAPI (R-14), "
     "distribución fuera de Play frente a las políticas 2026-2027 (R-15), y mejoras puntuales de "
     "sesiones, claves administrativas, etiquetado de la credencial Parquemet y mensajes SOS "
     "(R-16 a R-20). Cada fila de MATRIZ_RIESGOS_CUMBRE30.xlsx contiene evidencia, consecuencia "
     "posible, control existente, control faltante, recomendación, responsable, prioridad y "
     "criterio de aceptación.")

# ═══ 7. Matriz de riesgos ═══
sec(7, "Matriz de riesgos consolidada")
body("La Tabla 7.1 presenta la matriz en formato condensado. Las escalas de probabilidad e "
     "impacto son cualitativas (alta/media/baja); el nivel combina ambas con el tipo de riesgo "
     "(jurídico, técnico, operativo, comercial o reputacional). La versión completa, filtrable y "
     "con toda la evidencia, es MATRIZ_RIESGOS_CUMBRE30.xlsx.")
tabla(["ID", "Módulo", "Tipo", "Riesgo", "Prob.", "Imp.", "Nivel", "Prioridad"],
      [(r[0], r[1], r[2], (r[3][:110] + "…") if len(r[3]) > 110 else r[3],
        r[5], r[6], r[7], r[14].split(" ")[0]) for r in RIESGOS],
      [0.07, 0.15, 0.10, 0.42, 0.06, 0.06, 0.07, 0.07],
      caption="Tabla 7.1 — Matriz de riesgos (condensada; detalle completo en xlsx).",
      font=7.5, num_color_col=6, color_map=NIVEL_MAP)

# ═══ 8. Seguridad cloud y pruebas ═══
sec(8, "Seguridad cloud y pruebas verificadas")
body("El backend es deliberadamente pequeño: funciones serverless en Vercel, Postgres en Neon, "
     "sin almacenamiento de archivos en la nube y sin FCM. La revisión estática verificó los "
     "controles que la Fase 5 exigía comprobar en lo posible sin entorno de ejecución: los "
     "endpoints de rides, incidencias, amigos y logros filtran siempre por el usuario de la "
     "sesión (ownership checks), el webhook de Mercado Pago verifica el pago contra la API "
     "oficial y es idempotente por paymentId, las rutas administrativas exigen claves presentes "
     "solo en el entorno del servidor (y no viajan en el export estático del APK), los tokens de "
     "sesión son opacos y revocables, y la pista GPS completa no tiene ruta de subida al "
     "servidor.")
body("Los siguientes puntos quedan como pruebas pendientes de ejecutar en un entorno controlado, "
     "porque esta auditoría no ejecutó pruebas dinámicas: intento de lectura del ride de otro "
     "usuario con token propio (esperado: 404/401), manipulación de clientId en PATCH (esperado: "
     "sin efecto sobre terceros), acceso público a archivos privados (no aplica: no hay bucket "
     "público identificado), revocación real de sesiones desde dos dispositivos, y verificación "
     "del contenido efectivo del backup Android tras activar las reglas de la corrección A-03. "
     "La ubicación y el contrato de procesamiento de Neon no pudieron verificarse desde el "
     "repositorio (NO VERIFICADO) y deben documentarse junto con los DPA (corrección D-05).")

# ═══ 9. Condiciones de lanzamiento ═══
sec(9, "Condiciones de lanzamiento")
body("Con la evidencia actual, Cumbre30 no debe publicarse como app pública en Chile hasta cumplir "
     "las siguientes condiciones, todas con solución de bajo costo técnico y de plazo corto si se "
     "autoriza la ejecución:")
bullets([
    "<b>Condición 1.</b> T&C y Política de Privacidad publicados en cumbregeo.cl, enlazados desde la app y desde Play Console, con aceptación explícita al crear cuenta (R-01).",
    "<b>Condición 2.</b> Programa mínimo de la ley de datos: registro de actividades de tratamiento, consentimientos granulares para subida de rides y para sensores, procedimiento de derechos ARCO con portabilidad (export JSON/GPX), y DPA o evidencia contractual con Neon, Vercel, Google y Mercado Pago (R-02, R-05, R-06, D-05).",
    "<b>Condición 3.</b> Backup Android acotado con dataExtractionRules o allowBackup desactivado, probado en dispositivo real (R-04).",
    "<b>Condición 4.</b> Mensajería y marketing sin promesas de emergencia que el sistema no cumple; protocolo de caídas publicado y onboarding que explique el alcance real (R-10).",
    "<b>Condición 5.</b> Revisión de las geocercas oficiales y banner informativo del plan Pedalea Seguro antes del 15 de diciembre de 2026 (R-09).",
    "<b>Condición 6.</b> Para comercializar Pro: rotación del secreto de licencias y validación server-side o Play Billing (R-03), más validación tributaria y condiciones comerciales (R-13).",
])
body("Si estas condiciones se cumplen, los módulos que pueden mantenerse tal como están son: GPS "
     "y ciclocomputador, navegación offline con grafo OSM, geocercas informativas con "
     "trazabilidad, velocidad y alertas, historial local con sync opt-in, constancias, control de "
     "música por MediaSession, notificaciones locales y push web. Los módulos que requieren "
     "cambios son: cuenta (edad, rate limiting, revocación), sensores BLE (consentimiento), ICE "
     "(transparencia), licencias Pro (secreto y validación) y distribución (Play Data Safety y "
     "política de ubicación 2027).")

# ═══ 10. Plan de remediación ═══
sec(10, "Plan de remediación")
body("El plan organiza %d correcciones en cuatro fases: A bloqueantes de lanzamiento (4), B "
     "correcciones de alta prioridad antes de habilitar los módulos relacionados (5), C mejoras "
     "de cumplimiento (7) y D preparación comercial (5). Cada corrección incluye módulo, "
     "archivos involucrados, cambio requerido, impacto en funcionalidades, riesgo de regresión, "
     "prueba de aceptación y dependencias; el detalle operativo está en "
     "PLAN_REMEDIACION_CUMBRE30.md y el seguimiento en CHECKLIST_LANZAMIENTO_CUMBRE30.md. Este "
     "informe no ejecuta ninguna corrección: todas quedan sujetas a autorización expresa del "
     "propietario." % len(REMEDIACION))
tabla(["ID", "Fase", "Corrección", "Prueba de aceptación (resumen)"],
      [(r[0], r[1], (r[2][:130] + "…") if len(r[2]) > 130 else r[2],
        (r[8][:130] + "…") if len(r[8]) > 130 else r[8]) for r in REMEDIACION],
      [0.08, 0.07, 0.45, 0.40],
      caption="Tabla 10.1 — Plan de remediación (condensado; detalle completo en el plan MD).",
      font=7.5)

# ═══ 11. Aspectos que requieren abogado + Conclusión ═══
sec(11, "Aspectos que requieren abogado chileno y conclusión")
h2("11.1 Lista para asesoría legal")
bullets([
    "Validación de los borradores de T&C y Política de Privacidad (Anexo A) y su adaptación al régimen de transición Ley 19.628 → Ley 21.719 con la fecha que finalmente publique el Diario Oficial.",
    "Base jurídica del tratamiento de contactos ICE (datos de terceros) y de la frecuencia cardíaca (dato sensible), y redacción de los consentimientos.",
    "Edad mínima de la app (13 o 14 años) y diseño del consentimiento parental para menores.",
    "Limitación de responsabilidad frente a: alertas incorrectas, detección de caídas con falsos negativos, y constancias emitidas por la app.",
    "Régimen tributario de la venta Pro por persona natural (art. 42 N°2 LIR) y su interacción con Mercado Pago y Play Billing.",
    "Registro de marca en INAPI (clases 9 y 42; evaluar 38 y 41) tras búsqueda de antecedentes.",
    "Uso de la imagen y denominación «Pedalea Seguro» de Parquemet dentro de la app.",
])
h2("11.2 Conclusión")
body("Cumbre30 puede operar como aplicación pública gratuita en Chile si antes del lanzamiento se "
     "cierra la brecha documental y regulatoria identificada, que es amplia pero superficial en "
     "costo técnico: la arquitectura ya respeta el principio de minimización, los datos más "
     "sensibles nunca salen del dispositivo y el código muestra una disciplina de cumplimiento "
     "poco común (trazabilidad de geocercas, atribución ODbL, borrado de cuenta, verificación de "
     "pagos). El riesgo real no está en lo que la app hace, sino en lo que aún no declara ni "
     "controla formalmente. Con las Fases A y B ejecutadas y la autorización del propietario, el "
     "lanzamiento gratuito es razonable; la comercialización Pro exige además la corrección del "
     "secreto de licencias y la validación tributaria. Esta auditoría queda como diagnóstico: "
     "ninguna corrección se implementará sin autorización expresa.")

# ═══ Anexo A — Borradores documentales ═══
anexo("Anexo A", "Borradores técnicos de la documentación faltante")
callout_text("<b>AVISO.</b> Todos los documentos de este anexo son <b>BORRADORES TÉCNICOS "
             "PENDIENTES DE VALIDACIÓN LEGAL</b>. No constituyen asesoría jurídica ni documentos "
             "aprobados. Contienen marcas [POR DEFINIR] donde falta información que solo el "
             "propietario o su abogado pueden aportar (RUT, domicilio, datos de contacto).")

def doc(num, titulo, intro, clausulas):
    h3(f"A.{num} {titulo}")
    body(intro)
    bullets(clausulas)

doc(1, "Términos y Condiciones de uso",
    "Documento de adhesión para el uso de la app y del sitio. Extensión objetivo: 4-6 páginas.",
    ["Objeto y aceptación: describe el servicio (ciclocomputador GPS con alertas orientativas para el Parque Metropolitano), exige aceptación expresa al crear cuenta y registra fecha y versión.",
     "Cuenta del usuario: responsable de credenciales, edad mínima declarada, exactitud de datos; regla de cambio de username 1 vez cada 30 días.",
     "Uso aceptable: prohibido usar la app conduciendo vehículos motorizados para inflated stats; prohibido publicar incidencias falsas; uso bajo responsabilidad del ciclista.",
     "Naturaleza orientativa: las alertas, geocercas y velocidades son de apoyo y NO sustituyen señalización, resoluciones de Parquemet ni el criterio del ciclista.",
     "Servicio de emergencia NO garantizado: la detección de caídas es orientativa, puede no detectar caídas y no llama a servicios de emergencia; la app no es un dispositivo médico ni de socorro.",
     "Limitación de responsabilidad al máximo permitido por la Ley 19.496; ningún caso de responsabilidad por daños derivados del uso en vía pública.",
     "Plan Pro: precios en CLP, vigencia, medios de pago (Mercado Pago y Google Play Billing), derecho de arrepentimiento de 10 días en compras a distancia y política de reembolso.",
     "Propiedad intelectual; cambios de términos con aviso previo; ley aplicable chilena y tribunales de Santiago [POR DEFINIR con abogado]."])
doc(2, "Política de Privacidad",
    "Documento principal para Play Store (Data Safety) y para la Ley 21.719/19.628. Se apoya en el inventario de datos (xlsx) y describe solo lo que el código hace.",
    ["Responsable del tratamiento: persona natural, RUT [POR DEFINIR], correo de contacto publicado.",
     "Datos tratados: inventario completo por campo (ver INVENTARIO_DATOS_Y_PRIVACIDAD_CUMBRE30.xlsx), con la declaración explícita de que la pista GPS completa no sale del dispositivo.",
     "Finalidades y bases jurídicas por tratamiento; consentimiento granular para sincronización de rides, sensores BLE (salud) y comunicaciones.",
     "Destinatarios y encargados: Vercel (hosting), Neon (base de datos), Google (Sign-In), Mercado Pago (pagos Pro), Gmail SMTP (códigos), Open-Meteo, Photon y Nominatim (geocodificación/clima); incluir enlaces a sus políticas.",
     "Derechos: acceso, rectificación, supresión, oposición y portabilidad (export JSON de perfil y rides; GPX local); canales y plazos de respuesta.",
     "Retención: según política de conservación (A.4); eliminación de cuenta con borrado en cascada.",
     "Transferencias internacionales y medidas; datos de menores y edad mínima; contactos de emergencia como datos de terceros con recomendación de informar al contacto.",
     "Actualización de la política con historial de versiones."])
doc(3, "Política de Geolocalización",
    "Documento corto y legible que responde en una página qué hace la app con la ubicación.",
    ["Cuándo se usa la ubicación: solo durante un ride activo, con servicio en primer plano y notificación visible.",
     "Dónde se procesa: en el dispositivo (geocercas, alertas, registro); el servidor recibe únicamente estadísticas agregadas si la cuenta está sincronizada.",
     "Qué sale del dispositivo: consultas puntuales a Photon/Nominatim (nombre de sector) y Open-Meteo (clima); reversa con caché.",
     "Qué se guarda: pista GPS completa solo en el teléfono (borrable por viaje); sin ubicación en segundo plano ni monitoreo cuando la app está cerrada.",
     "Cómo desactivarla: permisos del sistema; la app funciona sin ubicación pero sin ciclocomputador."])
doc(4, "Política de Conservación de Datos",
    "Tabla de retención por tipo de dato, alineada al esquema Prisma.",
    ["Rides sincronizados: hasta 100 por cuenta, conservados hasta borrado individual o eliminación de cuenta.",
     "Historial local: cap automático según plan (20 gratis); la pista GPS vive solo local.",
     "Sesiones: expiración a 30 días; borrado al cerrar sesión; revocación global al cambiar contraseña (corrección C-02).",
     "PasswordReset: expira a 30 minutos con máximo 5 intentos.",
     "ProDelivery (ventas): retención fiscal recomendada por contador; conciliación con Mercado Pago.",
     "Incidentes: activos hasta expirar por frescura (30 días sin confirmaciones); después, sólo histórico según decisión.",
     "PushSub: endpoint eliminado al detectar caducidad (404/410) o al desuscribirse.",
     "Constancias: hash y payload conservados para verificación pública; revisar minimización del username (R-11)."])
h3("A.5 Registro de Actividades de Tratamiento")
body("Documento exigible por la Ley 21.719 desde su vigencia. Versión inicial con las actividades "
     "verificadas en el código; formato de tabla por actividad (ver hoja «Datos personales» del "
     "inventario xlsx como fuente).")
tabla(["Actividad", "Finalidad", "Base jurídica", "Categorías", "Destinatarios", "Plazo"],
      [("Gestión de cuenta", "Registro y acceso", "Contrato", "Identificación y credenciales", "Servidor propio; Google (Sign-In)", "Vida de la cuenta"),
       ("Sincronización de rides", "Historial y desafíos", "Consentimiento", "Stats deportivas (sin coordenadas)", "Servidor propio", "Hasta borrado"),
       ("Detección y alertas GPS", "Seguridad del ciclista", "Consentimiento (en dispositivo)", "Ubicación en tiempo real", "Ninguno (local)", "No persiste"),
       ("Sensores BLE", "Métricas deportivas", "Consentimiento explícito (salud)", "Frecuencia cardíaca", "Ninguno (local)", "No persiste (verificar)"),
       ("Aviso ICE", "Emergencia", "Consentimiento del usuario", "Contactos de terceros + ubicación", "App de mensajería del SO", "Local hasta borrado"),
       ("Ventas Pro", "Facturación y entrega", "Contrato", "Correo, monto, código", "Mercado Pago; Gmail SMTP", "Fiscal (a definir)"),
       ("Push web", "Avisos del parque", "Consentimiento", "Endpoint push", "Servicio push del navegador", "Hasta baja"),
       ("Constancias", "Verificación pública", "Consentimiento al emitir", "Hash + stats + username", "Público con enlace", "A definir (R-11)")],
      [0.17, 0.16, 0.15, 0.18, 0.19, 0.15],
      caption="Tabla A.5 — Registro de actividades (borrador inicial).", font=7.5)
doc(6, "Contratos con proveedores cloud",
    "No se inventan contratos: esta sección es la lista de verificación de lo que debe existir y revisarse.",
    ["Neon: revisar el DPA estándar, región de la base (transferencia internacional) y cifrado en reposo; registrar el resultado en el registro de actividades.",
     "Vercel: revisar condiciones de procesamiento y ubicación de funciones; confirmar que DATABASE_URL no se expone en logs.",
     "Google: configurar el Client ID con restricciones; revisar la Política de Datos de Usuario de las API usadas (Sign-In).",
     "Mercado Pago: aceptar condiciones de comercios; documentar el flujo de devoluciones.",
     "Cada contrato o término aceptado se anota con fecha y versión en el registro de actividades (corrección D-05)."])
doc(7, "Evaluación de Impacto en Privacidad (EIPD) — geolocalización",
    "Resumen ejecutivo de la EIPD recomendada; desarrollo completo antes de la vigencia de la 21.719.",
    ["Tratamiento evaluado: captura GPS a 1 Hz en primer plano, procesamiento local, sincronización de estadísticas opt-in.",
     "Riesgos identificados: inferencia de hábitos desde rides, exposición de punto habitual (domicilio) si se compartieran trazados, respaldo de Google (R-04).",
     "Medidas existentes: minimización estructural (coordenadas fuera del servidor), control por viaje, borrado de cuenta, consentimiento para sync.",
     "Medidas a implementar: reglas de backup, enmascaramiento en constancias públicas (R-11), pruebas dinámicas del capítulo 8.",
     "Riesgo residual tras medidas: bajo; la EIPD se revisa al añadir funciones comunitarias o Pro."])
doc(8, "Protocolo de Incidentes de Seguridad",
    "Procedimiento interno; adopta voluntariamente los plazos de la Ley 21.719 para brechas.",
    ["Detección y registro: monitoreo básico (logs de Vercel), correo de seguridad, registro del incidente con hora y alcance.",
     "Contención: revocación de sesiones (deleteMany), rotación de claves (ADMIN_KEY, PUSH_ADMIN_KEY, MP_SYNC_TOKEN, VAPID), modo mantenimiento si corresponde.",
     "Evaluación: datos afectados, titulares, severidad; decisión de notificación.",
     "Notificación: a titulares y autoridad dentro de los plazos que fije la ley de datos vigente; plantilla de comunicación incluida.",
     "Aprendizaje: post-mortem documentado y actualización de este protocolo; simulacro anual (corrección C-07)."])
doc(9, "Protocolo de Caídas y Emergencias",
    "Describe el circuito real de la app; base para el onboarding y para evitar expectativas indebidas.",
    ["Detección (GPS): frenado brusco desde 12 km/h a 3 km/h en 4 s + inmovilidad 18 s; solo dentro del parque; cooldown 3 minutos; cancelable al reanudar el pedaleo.",
     "Confirmación: cuenta regresiva «¿Estás bien?»; el ciclista puede responder o activar ayuda manualmente.",
     "Aviso: al expirar o al pedir ayuda, la app prepara un mensaje con ubicación para los contactos ICE definidos por el usuario (máximo 3) vía SMS/WhatsApp del sistema; nunca llama a ambulancias ni a Carabineros por su cuenta.",
     "Límites declarados: falsos negativos posibles (caídas lentas), no opera fuera del parque, depende de batería y cobertura; el usuario debe saberlo (onboarding único).",
     "Complemento manual: tarjeta SOS con 133, 131, 132, Parquemet, Providencia y Salud Responde."])
doc(10, "Manual de Seguridad (interno)",
    "Resumen operativo para el propietario/desarrollador.",
    ["Secretos: solo en .env del servidor; jamás en el APK; rotación semestral o tras incidente; el secreto de licencias debe salir del APK (corrección B-03).",
     "Acceso: una cuenta Vercel/Neon del titular; 2FA activo en Google, GitHub y Mercado Pago.",
     "Despliegue: revisión de diffs antes de publicar; el export estático excluye src/app/api (verificado en el flujo actual).",
     "Backups: base de datos con backup de Neon; probar restauración semestral; el backup Android del dispositivo se restringe (corrección A-03).",
     "Gestión de vulnerabilidades: dependencias actualizadas trimestralmente; revisión de avisos de seguridad de Capacitor y Next.js."])
doc(11, "Registro de Geocercas",
    "Matriz oficial de geocercas con fuente, tipo, verificación y vigencia.",
    ["La matriz completa vive en la hoja «Geocercas Parquemet» de MATRIZ_CUMPLIMIENTO_LEGAL_CUMBRE30.xlsx y en TRAZABILIDAD_GEOCERCAS (src/lib/geocercas.ts).",
     "Regla de oro ya implementada: una geocerca cuya única fuente sea OpenStreetMap nunca se clasifica OFFICIAL_RESTRICTION.",
     "Proceso: revisión trimestral; re-verificación obligatoria el 15-dic-2026 (plan Pedalea Seguro) y ante cualquier resolución publicada por Parquemet.",
     "Cada cambio de una restricción oficial exige actualizar source_reference y vigencia antes de publicar versión."])
doc(12, "Inventario de Licencias",
    "Inventario formal con obligaciones por recurso.",
    ["La matriz vive en INVENTARIO_LICENCIAS_CUMBRE30.xlsx (25 recursos verificados contra package.json).",
     "Acción común: generar THIRD-PARTY-NOTICES.md con los avisos y publicarlo desde Ayuda.",
     "ODbL: mantener atribución «© OpenStreetMap contributors» con enlace a copyright y licencia en todos los mapas futuros (incluido 3D).",
     "Código generado con herramientas de IA: documentar origen y titularidad (Anexo A.13)."])
doc(13, "Contratos de desarrollo y cesión de derechos",
    "Modelo mínimo si intervienen terceros o herramientas de IA en el desarrollo.",
    ["Identificación de las partes y del alcance (módulos entregados).",
     "Cesión de derechos patrimoniales de autor al titular (Ley 17.336) con expresión de obras concretas; derechos morales permanecen en el autor.",
     "Declaración sobre código generado con IA: quién lo produjo, sin garantías de originalidad de terceros y obligación de revisión de licencias.",
     "Confidencialidad y no uso de secretos del proyecto (incluido el secreto de licencias).",
     "Entrega de fuentes y aceptación de que el repositorio queda bajo control del titular."])
doc(14, "Política de Comunidad",
    "Reglas del espacio comunitario actual (amigos, incidencias) y su gobernanza.",
    ["Contenido del usuario: incidencias (tipo, ubicación, nota) y perfil; prohibido contenido ilegal, ofensivo o publicidad.",
     "Moderación: frescura comunitaria (confirmaciones) y expiración a 30 días; derecho del titular a ocultar o eliminar reportes; canal de denuncia por correo.",
     "Amistad solo por consentimiento mutuo; el ranking es entre amigos y muestra km y logros, sin ubicación.",
     "Sanciones: advertencia y suspensión de cuenta por abuso; conservación mínima de evidencia para decidir sanciones."])
doc(15, "Política de Menores",
    "Necesaria antes de habilitar la comunidad pública; alineada al capítulo NNA de la Ley 21.719.",
    ["Edad mínima propuesta: 14 años (decisión final con abogado); confirmación en el registro.",
     "Menores de esa edad: no se permite crear cuenta; los datos detectados como de menor se eliminan.",
     "Consentimiento parental documentado si se decide permitir edades inferiores con control.",
     "Seguridad: sin contacto público entre usuarios (amistad mutua), sin ubicación compartida entre usuarios, sin publicidad dirigida a menores."])

# ═══ Anexo B — Referencias ═══
anexo("Anexo B", "Referencias y fuentes verificables")
refs = [
    "Ley 21.719 (protección de datos personales) — bcn.cl/leychile/navegar?idNorma=1209272",
    "Ley 19.628 (vigente en la transición) — bcn.cl/leychile/navegar?idNorma=24686",
    "Ley 19.496 (protección al consumidor) — bcn.cl/leychile/navegar?idNorma=30536",
    "Reglamento de Comercio Electrónico D.S. 53/2020 Econ. — economia.gob.cl/wp-content/uploads/2020/10/2020.10.05-Reglamento-de-Comercio-Electronico.pdf",
    "Ley 18.290 (Ley de Tránsito) — bcn.cl/leychile/navegar?idNorma=29708",
    "Guía para ciclistas (CONASET, 2024) — conaset.cl/wp-content/uploads/2024/09/Guia-para-ciclistas-en-Chile_CONASET_13-09-2024-1-1.pdf",
    "Ley 17.336 (propiedad intelectual) — bcn.cl/leychile/navegar?idNorma=28938",
    "Ley 21.663 (Marco de Ciberseguridad) — bcn.cl/leychile/navegar?idNorma=1202434",
    "OpenStreetMap — Copyright and License: openstreetmap.org/copyright",
    "OSMF — Attribution Guidelines (rev. 2026-09-10): osmfoundation.org/wiki/Licence/Attribution_Guidelines",
    "Google Play — Policy announcement 29-oct-2026 (Location Permissions, obligatorio 27-ene-2027): support.google.com/googleplay/android-developer/answer/18100766",
    "Google Play — Policy announcement 15-abr-2026 (location button): support.google.com/googleplay/android-developer/answer/16926792",
    "MINVU / Parquemet — anuncio del plan Pedalea Seguro (06-nov-2026) y registro desde 15-dic-2026 en pedaleaseguro.parquemet.cl — radioagricultura.cl/noticias/nacional/plan-pedalea-seguro-ciclistas-deberan-registrarse-desde-diciembre-y-re (prensa; norma formal NO VERIFICADA)",
    "Postergación Ley 21.719 al 15-oct-2027 aprobada por el Congreso (17-nov-2026) — latercera.com/pulso/noticia/congreso-aprueba-postergacion-de-la-ley-de-proteccion-de-datos (prensa; publicación oficial pendiente)",
    "INAPI — búsqueda de antecedentes y registro de marcas: inapi.cl",
    "SII — régimen tributario de personas naturales: sii.cl",
]
for i, r in enumerate(refs, 1):
    story.append(Paragraph(f"[{i}] {r}", S["bullet"], bulletText="•"))
body("Nota metodológica: las dos últimas fuentes de carácter periodístico se citan porque el hecho "
     "que reportan (postergación aprobada por el Congreso; anuncio institucional del plan) aún no "
     "cuenta con texto publicado verificado. Ninguna restricción de la app depende de ellas sin "
     "la advertencia correspondiente.")

# ═══ Build ═══
doc = TocDocTemplate(OUT_BODY, pagesize=A4,
                     leftMargin=MARGIN, rightMargin=MARGIN,
                     topMargin=MARGIN, bottomMargin=MARGIN,
                     title=DOC_TITLE, author="Z.ai", creator="Z.ai",
                     subject="Auditoría pre-lanzamiento Chile — diagnóstico")
frame = Frame(MARGIN, MARGIN, AVAIL_W, AVAIL_H, id="main")
doc.addPageTemplates([
    PageTemplate(id="front", frames=[frame], onPage=on_front),
    PageTemplate(id="body", frames=[frame], onPage=on_body),
])
doc.multiBuild(story)
print("CUERPO_OK", OUT_BODY)

