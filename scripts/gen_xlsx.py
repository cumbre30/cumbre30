# -*- coding: utf-8 -*-
"""Genera las 4 matrices XLSX de la auditoría Cumbre30 usando el sistema de
diseño del skill xlsx (templates/base.py)."""
import sys, os

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)
sys.path.insert(0, "/home/z/my-project/scripts")

from base import (setup_sheet, style_header_row, style_data_row, font_caption,
                  FONT_NAME, ACCENT_NEGATIVE, ACCENT_WARNING, ACCENT_POSITIVE,
                  NEUTRAL_600, NEUTRAL_900, PRIMARY)
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from aud_riesgos import RIESGOS, MODULOS
from aud_legal import CUMPLIMIENTO, DATOS, GEOCERCAS, LICENCIAS

OUT = "/home/z/my-project/download/auditoria-cumbre30"
WRAP = Alignment(horizontal="left", vertical="top", wrap_text=True)

RIEGO_COLOR = {"CRÍTICO": (ACCENT_NEGATIVE, "FDEDEC"),
               "ALTO": (ACCENT_WARNING, "FEF9E7"),
               "MEDIO": (NEUTRAL_900, None),
               "BAJO": (NEUTRAL_600, None)}
ESTADO_COLOR = {"CUMPLE": (ACCENT_POSITIVE, "E8F5E9"),
                "PARCIAL": (ACCENT_WARNING, "FEF9E7"),
                "FALTA": (ACCENT_NEGATIVE, "FDEDEC"),
                "NO APLICA": (NEUTRAL_600, None),
                "PENDIENTE": (NEUTRAL_600, None),
                "NO VERIFICADO": (NEUTRAL_600, None)}


def tabla(ws, titulo, headers, filas, col_color=None, mapa_color=None, nota=None):
    """Escribe una tabla estándar del design system. col_color: índice 0-based de
    la columna a colorear según mapa_color (valor → (font, fill))."""
    last_col = len(headers) + 1
    setup_sheet(ws, title=titulo, last_col=last_col)
    for c, h in enumerate(headers, start=2):
        ws.cell(row=4, column=c, value=h)
    style_header_row(ws, row_num=4, col_start=2, col_end=last_col)
    for i, fila in enumerate(filas):
        rn = 5 + i
        for c, v in enumerate(fila, start=2):
            ws.cell(row=rn, column=c, value=v)
        style_data_row(ws, row_num=rn, col_start=2, col_end=last_col, row_index=i)
        for c in range(2, last_col + 1):
            ws.cell(row=rn, column=c).alignment = WRAP
        if col_color is not None:
            valor = str(fila[col_color]).strip().upper()
            base = mapa_color.get(valor)
            if base:
                fcol, ffill = base
                cell = ws.cell(row=rn, column=2 + col_color)
                cell.font = Font(name=FONT_NAME, size=11, color=fcol, bold=(fcol == ACCENT_NEGATIVE))
                if ffill:
                    cell.fill = PatternFill("solid", fgColor=ffill)
    if nota:
        nr = 5 + len(filas) + 2
        ws.cell(row=nr, column=2, value=nota).font = font_caption()
    ws.freeze_panes = "C5"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0


def auto_widths(ws, max_w=34):
    from openpyxl.utils import get_column_letter
    for col in ws.iter_cols(min_col=2, max_col=ws.max_column):
        letter = get_column_letter(col[0].column)
        best = 8
        for cell in col:
            if isinstance(cell.value, str):
                for line in cell.value.split("\n"):
                    w = min(max_w, max(8, int(len(line) * 0.62) + 2))
                    best = max(best, w)
        ws.column_dimensions[letter].width = best


wb = Workbook()

# ── 1. MATRIZ DE RIESGOS ──
ws = wb.active
ws.title = "Matriz de riesgos"
H_R = ["ID", "Módulo", "Tipo", "Riesgo", "Norma/fuente", "Probabilidad", "Impacto", "Nivel",
       "Evidencia", "Consecuencia posible", "Control existente", "Control faltante",
       "Recomendación", "Responsable", "Prioridad", "Criterio de aceptación"]
tabla(ws, "MATRIZ GENERAL DE RIESGOS — Cumbre30 (auditoría pre-lanzamiento Chile, 2026-11-18)",
      H_R, RIESGOS, col_color=7, mapa_color=RIEGO_COLOR,
      nota="Escalas: Probabilidad e Impacto (Alta/Media/Baja). Tipos: jurídico, técnico, operativo, comercial, reputacional. "
           "Prioridad A=antes de publicar, B=antes de habilitar el módulo, C=mejora, D=comercial. "
           "Fuente: inspección del repositorio Cumbre30 + normativa vigente. NO VERIFICADO = sin evidencia suficiente.")
auto_widths(ws)

ws2 = wb.create_sheet("Resumen")
H_S = ["Nivel", "Cantidad", "% del total"]
conteos = {}
for r in RIESGOS:
    conteos[r[7]] = conteos.get(r[7], 0) + 1
filas_s = [[k, conteos.get(k, 0), f"{conteos.get(k, 0) / len(RIESGOS):.0%}"]
           for k in ["CRÍTICO", "ALTO", "MEDIO", "BAJO"]]
filas_s.append(["TOTAL", len(RIESGOS), "100%"])
tabla(ws2, "Resumen de riesgos por nivel", H_S, filas_s,
      nota="Detalle completo en la hoja 'Matriz de riesgos'.")
auto_widths(ws2)

wb.properties.creator = "Z.ai"
wb.save(f"{OUT}/MATRIZ_RIESGOS_CUMBRE30.xlsx")
print("OK MATRIZ_RIESGOS", len(RIESGOS), "riesgos")

# ── 2. MATRIZ DE CUMPLIMIENTO LEGAL + GEOCERCAS ──
wb = Workbook()
ws = wb.active
ws.title = "Cumplimiento legal"
H_C = ["Norma / fuente", "Obligación aplicable", "Vigencia y fuente oficial", "Estado",
       "Evidencia en el repositorio", "Acción requerida", "Prioridad"]
tabla(ws, "MATRIZ DE CUMPLIMIENTO LEGAL — Cumbre30 (Chile, 2026-11-18)",
      H_C, CUMPLIMIENTO, col_color=3, mapa_color=ESTADO_COLOR,
      nota="Estados: CUMPLE / PARCIAL / FALTA / NO APLICA / PENDIENTE / NO VERIFICADO. "
           "Prioridad A=antes de publicar, B=antes de habilitar el módulo, C=mejora, D=comercial. "
           "Fuentes: bcn.cl/leychile (idNorma citados por fila), osmfoundation.org, support.google.com, inapi.cl, sii.cl.")
auto_widths(ws)

ws2 = wb.create_sheet("Geocercas Parquemet")
H_G = ["Identificador", "Descripción", "Fuente", "Tipo", "Verificación", "Vigencia", "Recomendación"]
tabla(ws2, "MATRIZ DE GEOCERCAS — Cerro San Cristóbal / Parquemet",
      H_G, GEOCERCAS,
      nota="Las geocercas son INFORMATIVE por defecto; ninguna bloquea recorridos. La regla dura del código impide "
           "clasificar como OFFICIAL_RESTRICTION lo que provenga solo de OpenStreetMap (docs/cumplimiento-geocercas.md). "
           "Tras el 15-dic-2026 (plan Pedalea Seguro) re-verificar accesos y senderos autorizados.")
auto_widths(ws2)

wb.properties.creator = "Z.ai"
wb.save(f"{OUT}/MATRIZ_CUMPLIMIENTO_LEGAL_CUMBRE30.xlsx")
print("OK MATRIZ_CUMPLIMIENTO", len(CUMPLIMIENTO), "normas,", len(GEOCERCAS), "geocercas")

# ── 3. INVENTARIO DE DATOS Y PRIVACIDAD (+ inventario funcional) ──
wb = Workbook()
ws = wb.active
ws.title = "Datos personales"
H_D = ["Campo", "Tipo", "Finalidad", "Almacenamiento", "Destinatarios", "Retención",
       "Sensibilidad", "Base jurídica propuesta"]
tabla(ws, "INVENTARIO DE DATOS PERSONALES Y PRIVACIDAD — Cumbre30",
      H_D, DATOS,
      nota="Construido desde prisma/schema.prisma, src/lib (iceContacts, cloudSync, ridePdf, geocode, sensors) y README. "
           "La pista GPS completa (coordenadas 1 Hz) permanece SOLO en el dispositivo (schema Ride sin track). "
           "HR (salud, dato sensible) debe tratarse con consentimiento explícito (R-05).")
auto_widths(ws)

ws2 = wb.create_sheet("Inventario funcional")
H_M = ["Módulo", "Implementado", "Parcial", "Proyectado", "Observaciones"]
tabla(ws2, "INVENTARIO FUNCIONAL DEL PROYECTO (Fase 1)",
      H_M, MODULOS,
      nota="Verificado por inspección de código el 2026-11-18. 'NO VERIFICADO' = sin evidencia suficiente en el repo.")
auto_widths(ws2)

wb.properties.creator = "Z.ai"
wb.save(f"{OUT}/INVENTARIO_DATOS_Y_PRIVACIDAD_CUMBRE30.xlsx")
print("OK INVENTARIO_DATOS", len(DATOS), "campos,", len(MODULOS), "módulos")

# ── 4. INVENTARIO DE LICENCIAS ──
wb = Workbook()
ws = wb.active
ws.title = "Licencias"
H_L = ["Recurso", "Licencia", "Obligación", "Riesgo", "Acción"]
tabla(ws, "INVENTARIO DE LICENCIAS Y PROPIEDAD INTELECTUAL — Cumbre30",
      H_L, LICENCIAS,
      nota="Dependencias verificadas contra package.json (bun.lock 2026-11). Acción común: generar THIRD-PARTY-NOTICES.md "
           "con todos los avisos y publicarlo desde Ayuda. ODbL: atribución ya implementada (mantener).")
auto_widths(ws)

wb.properties.creator = "Z.ai"
wb.save(f"{OUT}/INVENTARIO_LICENCIAS_CUMBRE30.xlsx")
print("OK INVENTARIO_LICENCIAS", len(LICENCIAS), "recursos")
