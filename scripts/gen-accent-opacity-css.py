#!/usr/bin/env python3
# ============================================================
# Genera los overrides CSS de las utilidades emerald CON OPACIDAD
# (bg-emerald-600/15, border-emerald-500/40, hover:..., dark:...).
#
# Por que existe: Tailwind v4 compila las variantes con opacidad a
# color LITERAL (ej .bg-emerald-600\/15{background-color:#00976726}),
# mientras que las solidas usan var(--color-emerald-600). Los temas
# Pro (html[data-accent]) remapean la variable, pero los literales
# quedarian verdes: este generador emite, por cada clase usada en
# src/, una regla por tema con color-mix(in oklab, var(--...), N%).
#
# Uso: python3 scripts/gen-accent-opacity-css.py
# Reescribe la seccion entre los marcadores de globals.css.
# Ejecutar de nuevo si se agregan clases emerald con opacidad.
# ============================================================
import pathlib
import re

ROOT = pathlib.Path("/home/z/my-project")
SRC = ROOT / "src"
CSS_FILE = ROOT / "src/app/globals.css"

INI = "/* >>> CUMBRE30:OPACIDAD-ACENTO:INICIO (generado por scripts/gen-accent-opacity-css.py - no editar a mano) <<< */"
FIN = "/* >>> CUMBRE30:OPACIDAD-ACENTO:FIN <<< */"

THEMES = ["andes", "atardecer", "lila", "grafito"]

# prefijo de utilidad -> propiedad CSS que compila Tailwind
PROP = {
    "bg": "background-color",
    "text": "color",
    "border": "border-color",
    "ring": "--tw-ring-color",
    "fill": "fill",
    "stroke": "stroke",
    "shadow": "box-shadow",
    "outline": "outline-color",
    "accent": "accent-color",
    "caret": "caret-color",
    "decoration": "text-decoration-color",
}

pat = re.compile(
    r'(?<![\w-])((?:[a-z-]+:)*)?(bg|text|border|ring|fill|stroke|shadow|outline|accent|caret|decoration)-emerald-(\d{2,3})/(\d{1,3})'
)

classes = {}  # (variant_chain, prefix, shade, op) -> None
for f in list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts")):
    src = f.read_text(encoding="utf-8")
    for m in pat.finditer(src):
        key = (m.group(1) or "", m.group(2), m.group(3), m.group(4))
        classes.setdefault(key, None)

def escape_class(variants: str, prefix: str, shade: str, op: str) -> tuple[str, str]:
    """Devuelve (selector_de_clase, pseudos). Escapa : y / como Tailwind."""
    token = f"{prefix}-emerald-{shade}/{op}" if op else f"{prefix}-emerald-{shade}"
    if variants:
        token = variants + token
    pseudos = []
    parts = token.split(":")
    base = parts[-1]
    chain = parts[:-1]
    # variantes que se convierten en pseudo-clase real
    for v in list(chain):
        if v in ("hover", "focus", "active", "disabled", "visited", "focus-visible"):
            pseudos.append(f":{v}")
            chain.remove(v)
    cls = ":".join(chain + [base])
    esc = cls.replace(":", "\\:").replace("/", "\\/")
    dark = ".dark " if "dark" in chain else ""
    return f"{dark}.{esc}", "".join(pseudos)

rules: list[str] = []
for theme in THEMES:
    rules.append(f'/* {theme} */')
    for (variants, prefix, shade, op) in sorted(classes):
        prop = PROP.get(prefix)
        if prop is None:
            continue
        sel, pseudos = escape_class(variants, prefix, shade, op)
        lead = f'html[data-accent="{theme}"]'
        value = f"color-mix(in oklab, var(--color-emerald-{shade}) {int(op)}%, transparent)"
        rules.append(f"{lead} {sel}{pseudos}{{{prop}:{value}}}")

block = INI + "\n" + "\n".join(rules) + "\n" + FIN

css = CSS_FILE.read_text(encoding="utf-8")
if INI in css:
    css = re.sub(re.escape(INI) + ".*?" + re.escape(FIN), block.replace("\\", "\\\\"), css, flags=re.S)
else:
    css = css.rstrip() + "\n\n" + block + "\n"
CSS_FILE.write_text(css, encoding="utf-8")

n = sum(len([1 for t in THEMES]) for _ in classes)
print(f"clases unicas: {len(classes)} · reglas emitidas: {len(classes) * len(THEMES)}")
for k in sorted(classes):
    print("  ", ".".join(k))
