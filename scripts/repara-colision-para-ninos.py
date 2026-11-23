#!/usr/bin/env python3
# Reparación de la colisión «Ciclismo para niños» (id cmwsjxxjb8af6185bbe2b15e0).
# El registro YA estaba publicado (lote anterior, lote-ciclismo-final.json) y la
# semilla del delta le sobrescribió campos editoriales. La restauración en Neon
# se ejecuta con scripts/repara-colision-para-ninos.mjs (pg).
# Este script solo: (1) retira el título del lote canonical para que futuros
# re-runs de la semilla jamás vuelvan a tocar el registro publicado.
import json
from pathlib import Path

BASE = Path("/home/z/my-project/scripts/data")
F = BASE / "lote-es-fichas-final.json"
lote = json.loads(F.read_text())
antes = len(lote)
lote = [l for l in lote if l["titulo"] != "Ciclismo para niños"]
F.write_text(json.dumps(lote, ensure_ascii=False, indent=1))
print(f"lote canonical: {antes} → {len(lote)} (retirado «Ciclismo para niños», ya publicado)")
