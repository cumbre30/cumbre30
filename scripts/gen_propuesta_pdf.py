# -*- coding: utf-8 -*-
"""Genera el cuerpo del PDF: Cumbre30 - Propuesta de Rediseño UX/UI (ReportLab)."""
import os, sys, hashlib

PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))
sys.path.insert(0, "/home/z/my-project/scripts")

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, Image, KeepTogether, CondPageBreak,
                                HRFlowable)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from PIL import Image as PILImage

import propuesta_contenido as C

# ---------- fuentes ----------
FONT_DIR = "/usr/share/fonts"
pdfmetrics.registerFont(TTFont("FreeSerif", f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC-Bold", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"))
registerFontFamily("FreeSerif", normal="FreeSerif", bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")
registerFontFamily("NotoSerifSC", normal="NotoSerifSC", bold="NotoSerifSC-Bold")

from pdf import install_font_fallback
install_font_fallback()

# ---------- paleta cascade (design_engine palette-cascade --intent nature --seed 5) ----------
from reportlab.lib import colors
PAGE_BG       = colors.HexColor('#f4f6f5')
SECTION_BG    = colors.HexColor('#e6eae8')
CARD_BG       = colors.HexColor('#edf0ef')
TABLE_STRIPE  = colors.HexColor('#f2f4f3')
HEADER_FILL   = colors.HexColor('#445f51')
COVER_BLOCK   = colors.HexColor('#527061')
BORDER        = colors.HexColor('#a4c1b2')
ICON          = colors.HexColor('#468163')
ACCENT        = colors.HexColor('#1d9559')
ACCENT_2      = colors.HexColor('#5ca5be')
TEXT_PRIMARY  = colors.HexColor('#1f2321')
TEXT_MUTED    = colors.HexColor('#828b87')

# ---------- documento ----------
OUT = "/tmp/proto/propuesta_body.pdf"
MARGIN = 20 * mm
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - 2 * MARGIN
H1_THRESHOLD = AVAIL_H * 0.25

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            # numeración de cuerpo: la página 1 del build es el índice (roma)
            self.notify("TOCEntry", (level, text, self.page - 1, key))

def header_footer(canvas, doc):
    canvas.saveState()
    # encabezado
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 12 * mm, "CUMBRE30 - Propuesta de Rediseño UX/UI y Navegación")
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, PAGE_H - 14 * mm, PAGE_W - MARGIN, PAGE_H - 14 * mm)
    # pie
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 10 * mm, "Fases 1-2 · Auditoría y prototipo")
    page_label = "i" if doc.page == 1 else str(doc.page - 1)
    canvas.drawRightString(PAGE_W - MARGIN, 10 * mm, page_label)
    canvas.restoreState()

# ---------- estilos ----------
S = {}
S["h1"] = ParagraphStyle("H1", fontName="FreeSerif", fontSize=20, leading=25,
                         textColor=HEADER_FILL, spaceBefore=18, spaceAfter=4)
S["h2"] = ParagraphStyle("H2", fontName="FreeSerif", fontSize=14, leading=19,
                         textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6)
S["body"] = ParagraphStyle("Body", fontName="FreeSerif", fontSize=10.5, leading=16.5,
                           textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=9)
S["bullet"] = ParagraphStyle("Bullet", parent=S["body"], leftIndent=14, bulletIndent=2,
                             spaceAfter=5, alignment=TA_LEFT, bulletFontName="FreeSerif",
                             bulletFontSize=10.5, bulletColor=ACCENT)
S["cell"] = ParagraphStyle("Cell", fontName="FreeSerif", fontSize=9.5, leading=13,
                           textColor=TEXT_PRIMARY, alignment=TA_LEFT)
S["cellC"] = ParagraphStyle("CellC", parent=S["cell"], alignment=TA_CENTER)
S["cellH"] = ParagraphStyle("CellH", fontName="FreeSerif", fontSize=9.5, leading=13,
                            textColor=colors.white, alignment=TA_LEFT)
S["cellHC"] = ParagraphStyle("CellHC", parent=S["cellH"], alignment=TA_CENTER)
S["caption"] = ParagraphStyle("Caption", fontName="FreeSerif-Italic", fontSize=8.5, leading=12,
                              textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)
S["statBig"] = ParagraphStyle("StatBig", fontName="FreeSerif", fontSize=21, leading=25,
                              textColor=ACCENT, alignment=TA_CENTER)
S["statLbl"] = ParagraphStyle("StatLbl", fontName="FreeSerif", fontSize=8.5, leading=11.5,
                              textColor=TEXT_MUTED, alignment=TA_CENTER)
S["tocTitle"] = ParagraphStyle("TocTitle", fontName="FreeSerif", fontSize=20, leading=26,
                               textColor=HEADER_FILL, spaceAfter=14)
S["callout"] = ParagraphStyle("Callout", fontName="FreeSerif", fontSize=10.5, leading=16,
                              textColor=TEXT_PRIMARY)

def h1(text):
    key = "h_%s" % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), S["h1"])
    p.bookmark_name = key
    p.bookmark_level = 0
    p.bookmark_text = text
    p.bookmark_key = key
    rule = HRFlowable(width="100%", color=ACCENT, thickness=1.6, spaceBefore=0, spaceAfter=10)
    return [CondPageBreak(H1_THRESHOLD), KeepTogether([p, rule])]

def h2(text):
    return Paragraph("<b>%s</b>" % text, S["h2"])

def body(text):
    return Paragraph(text, S["body"])

def bullet(text):
    return Paragraph(text, S["bullet"], bulletText="•")

def make_table(data, ratios, center_cols=(), header=True, font_size=9.5):
    col_w = [r * AVAIL_W for r in ratios]
    assert abs(sum(ratios) - 1.0) < 0.01, "ratios deben sumar 1"
    assert sum(col_w) <= AVAIL_W + 0.5, "tabla excede ancho disponible"
    wrapped = []
    for i, row in enumerate(data):
        out = []
        for j, cell in enumerate(row):
            if i == 0 and header:
                st = S["cellHC"] if j in center_cols else S["cellH"]
                out.append(Paragraph("<b>%s</b>" % cell, st))
            else:
                st = S["cellC"] if j in center_cols else S["cell"]
                out.append(Paragraph(cell, st))
        wrapped.append(out)
    t = Table(wrapped, colWidths=col_w, hAlign="CENTER", repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL))
        for r in range(1, len(data)):
            style.append(("BACKGROUND", (0, r), (-1, r),
                          colors.white if r % 2 == 1 else TABLE_STRIPE))
    t.setStyle(TableStyle(style))
    return t

def callout_row(items):
    """Fila de 3 CalloutBox con métricas destacadas."""
    gap = 10
    box_w = (AVAIL_W - 2 * gap) / 3.0
    cells = []
    for big, lbl in items:
        inner = Table([[Paragraph("<b>%s</b>" % big, S["statBig"])],
                       [Paragraph(lbl, S["statLbl"])]], colWidths=[box_w - 2])
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("BOX", (0, 0), (-1, -1), 1, ACCENT),
            ("TOPPADDING", (0, 0), (-1, 0), 9),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 9),
            ("TOPPADDING", (0, 1), (-1, 1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ]))
        cells.append(inner)
    outer = Table([cells], colWidths=[box_w, box_w, box_w], hAlign="CENTER")
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer

def fig(path, caption, max_h=300, max_w=None):
    max_w = max_w or AVAIL_W
    im = PILImage.open(path)
    ow, oh = im.size
    ratio = min(max_w / ow, max_h / oh, 1.0)
    img = Image(path, width=ow * ratio, height=oh * ratio)
    img.hAlign = "CENTER"
    return KeepTogether([Spacer(1, 8), img, Paragraph(caption, S["caption"])])

# ============================================================
story = []

# --- índice ---
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle("TOC0", fontName="FreeSerif", fontSize=11, leading=20,
                   leftIndent=6, textColor=TEXT_PRIMARY),
]
story.append(Paragraph("<b>Índice</b>", S["tocTitle"]))
story.append(HRFlowable(width="100%", color=ACCENT, thickness=1.6, spaceAfter=12))
story.append(toc)
story.append(PageBreak())

# --- capítulo 1 ---
story.extend(h1(C.CH1["titulo"]))
story.append(body(C.CH1["parrafos"][0]))
story.append(Spacer(1, 6))
story.append(callout_row(C.CH1["callouts"]))
story.append(Spacer(1, 10))
story.append(body(C.CH1["parrafos"][1]))
story.append(body(C.CH1["parrafos"][2]))

# --- capítulo 2 ---
story.extend(h1(C.CH2["titulo"]))
story.append(body(C.CH2["intro"]))
story.append(h2(C.CH2["s21_t"])); story.append(body(C.CH2["s21"]))
story.append(h2(C.CH2["s22_t"])); story.append(body(C.CH2["s22"]))
story.append(h2(C.CH2["s23_t"])); story.append(body(C.CH2["s23"]))
story.append(h2(C.CH2["s24_t"])); story.append(body(C.CH2["s24"]))
story.append(h2(C.CH2["s25_t"])); story.append(body(C.CH2["s25"]))
story.append(h2(C.CH2["hallazgos_t"]))
story.append(body(C.CH2["hallazgos_intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH2["hallazgos"], [0.27, 0.33, 0.26, 0.14], center_cols=(3,)))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 1. Hallazgos de la auditoría con evidencia en código.", S["caption"]))

# --- capítulo 3 ---
story.extend(h1(C.CH3["titulo"]))
story.append(h2(C.CH3["s31_t"]))
for b in C.CH3["s31"]:
    story.append(bullet(b))
story.append(h2(C.CH3["s32_t"]))
story.append(body(C.CH3["s32_intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH3["s32"], [0.14, 0.50, 0.36]))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 2. Destinos de la navegación inferior.", S["caption"]))
story.append(h2(C.CH3["s33_t"]))
story.append(body(C.CH3["s33_intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH3["s33"], [0.20, 0.48, 0.32]))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 3. Estructura del menú lateral.", S["caption"]))
story.append(h2(C.CH3["s34_t"]))
story.append(body(C.CH3["s34_intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH3["s34"], [0.42, 0.40, 0.18], center_cols=(2,)))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 4. Mapa de migración pantalla por pantalla.", S["caption"]))
story.append(h2(C.CH3["s35_t"]))
story.append(body(C.CH3["s35"]))
story.append(fig("/tmp/proto/diagram-nav.png",
                 "Figura 1. Arquitectura de navegación propuesta: barra inferior y menú lateral.",
                 max_h=250))

# --- capítulo 4 ---
story.extend(h1(C.CH4["titulo"]))
story.append(body(C.CH4["intro"]))
story.append(h2(C.CH4["s41_t"]))
story.append(Spacer(1, 4))
story.append(make_table(C.CH4["s41"], [0.24, 0.16, 0.60], center_cols=(1,)))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 5. Tokens de color de la identidad Cumbre30.", S["caption"]))
story.append(Spacer(1, 6))
story.append(body(C.CH4["s41_nota"]))
story.append(h2(C.CH4["s42_t"])); story.append(body(C.CH4["s42"]))
story.append(h2(C.CH4["s43_t"])); story.append(body(C.CH4["s43"]))
story.append(h2(C.CH4["s44_t"]))
story.append(body(C.CH4["s44_intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH4["s44"], [0.30, 0.42, 0.28]))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 6. Componentes reutilizables del sistema.", S["caption"]))
story.append(h2(C.CH4["s45_t"])); story.append(body(C.CH4["s45"]))

# --- capítulo 5 ---
story.extend(h1(C.CH5["titulo"]))
story.append(body(C.CH5["intro"]))
story.append(h2(C.CH5["s_ride_t"])); story.append(body(C.CH5["s_ride"]))
story.append(fig("/tmp/proto/fig-ride-run.png", C.CH5["figs"][0][1], max_h=280))
story.append(h2(C.CH5["s_exp_t"])); story.append(body(C.CH5["s_exp"]))
story.append(fig("/tmp/proto/fig-explorar.png", C.CH5["figs"][2][1], max_h=280))
story.append(h2(C.CH5["s_menu_t"])); story.append(body(C.CH5["s_menu"]))
story.append(fig("/tmp/proto/fig-drawer.png", C.CH5["figs"][1][1], max_h=280))
story.append(fig("/tmp/proto/fig-planes.png", C.CH5["figs"][3][1], max_h=280))

# --- capítulo 6 ---
story.extend(h1(C.CH6["titulo"]))
story.append(body(C.CH6["intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH6["tabla"], [0.58, 0.21, 0.21], center_cols=(1, 2)))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 7. Comparación FREE/PRO validada contra el código.", S["caption"]))
story.append(Spacer(1, 6))
story.append(body(C.CH6["nota"]))

# --- capítulo 7 ---
story.extend(h1(C.CH7["titulo"]))
story.append(body(C.CH7["intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH7["etapas"], [0.16, 0.48, 0.36]))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 8. Etapas de implementación con archivos afectados.", S["caption"]))
story.append(h2(C.CH7["validacion_t"]))
story.append(body(C.CH7["validacion"]))

# --- capítulo 8 ---
story.extend(h1(C.CH8["titulo"]))
story.append(body(C.CH8["intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH8["tabla"], [0.30, 0.09, 0.11, 0.50], center_cols=(1, 2)))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 9. Riesgos técnicos, probabilidad e impacto.", S["caption"]))

# --- capítulo 9 ---
story.extend(h1(C.CH9["titulo"]))
story.append(body(C.CH9["intro"]))
story.append(Spacer(1, 6))
story.append(make_table(C.CH9["decisiones"], [0.06, 0.34, 0.60], center_cols=(0,)))
story.append(Spacer(1, 4))
story.append(Paragraph("Tabla 10. Decisiones para desbloquear la Fase 3.", S["caption"]))
story.append(Spacer(1, 8))
story.append(body(C.CH9["cierre"]))

# ---------- build ----------
doc = TocDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    title=C.TITULO_DOC, author="Z.ai", creator="Z.ai",
    subject="Auditoría, arquitectura de navegación, sistema de diseño y prototipo",
)
doc.multiBuild(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("OK body ->", OUT)
