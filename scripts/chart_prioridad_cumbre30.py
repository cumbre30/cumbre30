# -*- coding: utf-8 -*-
"""
Figura 1 del informe Cumbre30: índice de prioridad de las funcionalidades propuestas.
Índice = impacto*2 - esfuerzo (escala: impacto y esfuerzo 1-5, definidos en el informe).
También escribe scores.json para que el generador del docx use los mismos valores.
"""
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf')
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Noto Sans SC']
plt.rcParams['axes.unicode_minus'] = False

# id, nombre corto (gráfico), nombre completo (informe), eje, impacto 1-5, esfuerzo 1-5, ola
PROPOSALS = [
    ("ice",    "Contactos ICE + alerta por caída",        "Seguridad y emergencia",  5, 2, 1),
    ("fc",     "Zonas de esfuerzo con sensor BT",         "Datos e integraciones",   4, 2, 1),
    ("mod",    "Moderación comunitaria de incidencias",   "Comunidad",               4, 2, 1),
    ("push",   "Notificaciones push / locales",           "Notificaciones",          4, 3, 1),
    ("racha",  "Rachas de actividad y reactivación",      "Retención",               3, 1, 1),
    ("bat",    "Modo ahorro de batería en ride",          "Experiencia y rendimiento", 3, 2, 1),
    ("vlm",    "Clasificación de fotos con IA (VLM)",     "Inteligencia artificial", 4, 3, 2),
    ("strava", "Exportación a Strava / archivo FIT",      "Datos e integraciones",   4, 3, 2),
    ("resumen","Resumen semanal generado con IA",         "Inteligencia artificial", 3, 2, 2),
    ("rank",   "Ranking de segmentos",                    "Comunidad",               4, 4, 2),
    ("vivo",   "Ride en vivo compartido",                 "Seguridad y emergencia",  4, 4, 3),
    ("nube",   "Respaldo y restauración en la nube",      "Nube y continuidad",      5, 5, 3),
    ("voz",    "Comandos por voz durante el ride",        "Experiencia y rendimiento", 3, 3, 3),
    ("heat",   "Heatmap anual de pedaleos",               "Datos e integraciones",   3, 3, 3),
]

rows = []
for pid, nombre, eje, imp, esf, ola in PROPOSALS:
    idx = imp * 2 - esf
    rows.append({"id": pid, "nombre": nombre, "eje": eje, "impacto": imp,
                 "esfuerzo": esf, "ola": ola, "indice": idx})

rows.sort(key=lambda r: (-r["indice"], r["ola"], r["nombre"]))

print(f"{'Funcionalidad':44s} {'Eje':28s} IMP ESF IDX OLA")
for r in rows:
    print(f"{r['nombre']:44s} {r['eje']:28s} {r['impacto']:3d} {r['esfuerzo']:3d} {r['indice']:3d} {r['ola']:3d}")

out_dir = "/home/z/my-project/scripts/out"
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "scores.json"), "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

# ── Figura 1: barras horizontales ordenadas por índice, color por ola ──
OLA_COLORS = {1: "#1B6B7A", 2: "#5B8DB8", 3: "#9AA6B2"}
OLA_NAMES = {1: "Ola 1 (alto impacto · bajo esfuerzo)",
             2: "Ola 2 (conectividad e IA)",
             3: "Ola 3 (apuestas mayores)"}

fig, ax = plt.subplots(figsize=(10, 6), constrained_layout=True)
names = [r["nombre"] for r in rows][::-1]
vals = [r["indice"] for r in rows][::-1]
cols = [OLA_COLORS[r["ola"]] for r in rows][::-1]

bars = ax.barh(names, vals, color=cols, height=0.62, zorder=3)
for b, v in zip(bars, vals):
    ax.text(v + 0.12, b.get_y() + b.get_height() / 2, str(v),
            va="center", ha="left", fontsize=10, color="#333333")

ax.set_xlabel("Índice de prioridad (impacto × 2 − esfuerzo)", fontsize=11)
ax.set_xlim(0, max(vals) + 1.2)
ax.grid(True, axis="x", alpha=0.3, zorder=0)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.tick_params(axis="y", labelsize=10)
ax.tick_params(axis="x", labelsize=10)

from matplotlib.patches import Patch
handles = [Patch(facecolor=OLA_COLORS[o], label=OLA_NAMES[o]) for o in (1, 2, 3)]
ax.legend(handles=handles, loc="lower right", bbox_to_anchor=(1.0, -0.02),
          fontsize=9, frameon=True, framealpha=0.9)

png_path = os.path.join(out_dir, "figura1_prioridad.png")
fig.savefig(png_path, dpi=200)
plt.close(fig)

from PIL import Image
im = Image.open(png_path).convert("L")
h = im.histogram()
print("PNG:", png_path, im.size, "non-white ratio:", round(1 - h[255] / sum(h), 4))
