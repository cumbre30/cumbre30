#!/usr/bin/env python3
# ============================================================
# Reemplaza text-zinc-950 por text-(--c30-on-accent) SOLO en las
# lineas que tienen fondo de acento (bg-emerald-*): asi el texto
# de los botones acompana al tema Pro (lila/grafito piden claro).
# Los botones ambar (bg-amber-*) no se tocan: su texto sigue
# oscuro en todos los temas.
# Convencion de texto: guion simple "-" en comentarios.
# ============================================================
import pathlib

ROOT = pathlib.Path("/home/z/my-project/src")

targets = [
    "components/MapView.tsx",
    "components/ProUI.tsx",
    "components/VehicleConfirmModal.tsx",
    "components/Wallet.tsx",
    "components/ProfileTab.tsx",
    "components/StatsTab.tsx",
    "components/AmigosTab.tsx",
    "components/ChallengesTab.tsx",
    "components/HelpTab.tsx",
    "components/PagosTab.tsx",
]

OLD, NEW = "text-zinc-950", "text-(--c30-on-accent)"
changed = 0
for rel in targets:
    f = ROOT / rel
    lines = f.read_text(encoding="utf-8").splitlines(keepends=True)
    n = 0
    for i, line in enumerate(lines):
        if OLD in line and ("bg-emerald-6" in line or "bg-emerald-5" in line):
            lines[i] = line.replace(OLD, NEW)
            n += 1
    if n:
        f.write_text("".join(lines), encoding="utf-8")
        print(f"{rel}: {n} linea(s)")
        changed += n

print(f"TOTAL: {changed}")
