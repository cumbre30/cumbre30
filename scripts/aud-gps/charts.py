# ============================================================
# Gráficos del informe AUDITORÍA DE BRECHAS DEL MOTOR GPS - CUMBRE30.
# Datos derivados de la inspección de código (evidencias en el
# informe). Salida: scripts/aud-gps/chart_madurez.png y chart_estado.png
# ============================================================
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams["axes.unicode_minus"] = False
plt.rcParams["font.family"] = "DejaVu Sans"  # texto en español (latín)

ACCENT = "#1B6B7A"      # DM-1 table accent (paleta del informe)
GREY = "#B0B0B0"
COLORS = {"Implementada": "#7BA68A", "Parcial": "#C8B87C", "Inexistente": "#B87472"}

# ---------- 1) Madurez por área (0-100) ----------
areas = [
    ("A. Captura GPS", 62),
    ("B. Velocidad", 72),
    ("C. Distancia", 58),
    ("D. Altitud y desnivel", 40),
    ("E. Inteligencia del ciclocomputador", 30),
    ("F. Registro de actividades", 48),
    ("G. Rendimiento y batería", 65),
    ("H. Arquitectura e integración", 68),
]
fig, ax = plt.subplots(figsize=(10, 5.2), constrained_layout=True)
labels = [a for a, _ in areas][::-1]
vals = [v for _, v in areas][::-1]
bars = ax.barh(labels, vals, color=ACCENT, alpha=0.88, height=0.62)
for b, v in zip(bars, vals):
    ax.text(v + 1.2, b.get_y() + b.get_height() / 2, str(v),
            va="center", fontsize=10, color="#333333")
ax.axvline(54, color="#B87472", linestyle="--", linewidth=1.4)
ax.text(54, len(labels) - 0.28, " ponderado global: 54/100", fontsize=9.5,
        color="#B87472", va="bottom")
ax.set_xlim(0, 100)
ax.set_xlabel("Madurez (0-100, juicio técnico respaldado por evidencia de código)")
ax.grid(True, axis="x", alpha=0.3)
ax.spines[["top", "right"]].set_visible(False)
ax.set_title("Madurez del motor GPS por área — Cumbre30", fontsize=13, pad=10)
fig.savefig("/home/z/my-project/scripts/aud-gps/chart_madurez.png", dpi=200)
plt.close(fig)

# ---------- 2) Cobertura por área: implementada / parcial / inexistente ----------
# Conteo de la matriz funcional (sección 4 del informe).
cobertura = {
    "A. Captura GPS":       [3, 4, 1],
    "B. Velocidad":         [6, 2, 0],
    "C. Distancia":         [3, 2, 0],
    "D. Altitud/desnivel":  [2, 3, 0],
    "E. Inteligencia":      [2, 1, 4],
    "F. Registro":          [4, 4, 0],
    "G. Rendimiento":       [4, 3, 0],
    "H. Arquitectura":      [5, 3, 0],
}
cats = list(cobertura.keys())
imp = [c[0] for c in cobertura.values()]
par = [c[1] for c in cobertura.values()]
inx = [c[2] for c in cobertura.values()]
fig, ax = plt.subplots(figsize=(10, 5.2), constrained_layout=True)
b1 = ax.barh(cats[::-1], imp[::-1], color=COLORS["Implementada"], label="Implementada", height=0.62)
b2 = ax.barh(cats[::-1], par[::-1], left=imp[::-1], color=COLORS["Parcial"], label="Parcial", height=0.62)
b3 = ax.barh(cats[::-1], inx[::-1], left=[i + p for i, p in zip(imp, par)][::-1],
             color=COLORS["Inexistente"], label="Inexistente", height=0.62)
for bars in (b1, b2, b3):
    for b in bars:
        w = b.get_width()
        if w >= 1:
            ax.text(b.get_x() + w / 2, b.get_y() + b.get_height() / 2, str(int(w)),
                    ha="center", va="center", fontsize=9, color="#1A1A1A")
ax.set_xlabel("Funcionalidades evaluadas (n=8 por área aprox.)")
ax.grid(True, axis="x", alpha=0.3)
ax.spines[["top", "right"]].set_visible(False)
ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.14), fontsize=9, frameon=False, ncol=3)
ax.set_title("Estado de la funcionalidad evaluada por área", fontsize=13, pad=12)
fig.savefig("/home/z/my-project/scripts/aud-gps/chart_estado.png", dpi=200)
plt.close(fig)

# Verificación: archivos no vacíos
import os
for f in ("chart_madurez.png", "chart_estado.png"):
    p = f"/home/z/my-project/scripts/aud-gps/{f}"
    print(f, os.path.getsize(p), "bytes")
print("OK gráficos")
