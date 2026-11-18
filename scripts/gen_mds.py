# -*- coding: utf-8 -*-
"""Genera PLAN_REMEDIACION_CUMBRE30.md y CHECKLIST_LANZAMIENTO_CUMBRE30.md
desde los módulos central de datos (aud_plan.py)."""
import sys
sys.path.insert(0, "/home/z/my-project/scripts")
from aud_plan import REMEDIACION, CHECKLIST

OUT = "/home/z/my-project/download/auditoria-cumbre30"

FASES = {
    "A": ("Fase A — Bloqueantes de lanzamiento",
          "Problemas que impiden publicar responsablemente en Chile (alimentos de Play Store y del régimen de datos)."),
    "B": ("Fase B — Correcciones de alta prioridad",
          "Deben resolverse antes de habilitar los módulos relacionados (sensores, Pro, comunidad, emergencias)."),
    "C": ("Fase C — Mejoras de cumplimiento",
          "Controles adicionales que robustecen la aplicación, sin bloquear el lanzamiento."),
    "D": ("Fase D — Preparación comercial",
          "Necesarios para suscripciones, publicidad y colaboraciones futuras."),
}

lines = []
lines.append("# PLAN DE REMEDIACIÓN — Cumbre30")
lines.append("")
lines.append("**Auditoría pre-lanzamiento Chile · Diagnóstico (sin modificaciones de código)**")
lines.append("")
lines.append("Fecha: 2026-11-18 · Fuente: inspección del repositorio + investigación normativa. "
             "Este plan NO se ejecuta hasta recibir autorización expresa del propietario.")
lines.append("")
lines.append("Resumen: %d correcciones — %d bloqueantes (Fase A), %d de alta prioridad (B), %d mejoras (C), %d comerciales (D)."
             % (len(REMEDIACION),
                sum(1 for r in REMEDIACION if r[1] == "A"),
                sum(1 for r in REMEDIACION if r[1] == "B"),
                sum(1 for r in REMEDIACION if r[1] == "C"),
                sum(1 for r in REMEDIACION if r[1] == "D")))
lines.append("")
for fase in ["A", "B", "C", "D"]:
    titulo, desc = FASES[fase]
    lines.append(f"## {titulo}")
    lines.append("")
    lines.append(desc)
    lines.append("")
    for r in REMEDIACION:
        if r[1] != fase:
            continue
        (rid, _f, desc2, mod, files, cambio, impacto, reg, prueba, dep) = r
        lines.append(f"### {rid} — {desc2.split('.')[0]}")
        lines.append("")
        lines.append(f"- **Módulo:** {mod}")
        lines.append(f"- **Cambio requerido:** {cambio}")
        lines.append(f"- **Archivos involucrados:** {files}")
        lines.append(f"- **Impacto en funcionalidades:** {impacto}")
        lines.append(f"- **Riesgo de regresión:** {reg}")
        lines.append(f"- **Prueba de aceptación:** {prueba}")
        lines.append(f"- **Dependencias:** {dep if dep != '—' else 'ninguna'}")
        lines.append("")
lines.append("## Pendientes de decisión del propietario")
lines.append("")
lines.append("1. Autorizar la ejecución de las Fases A y B antes de cualquier publicación.")
lines.append("2. Confirmar fecha objetivo de lanzamiento frente a las vigencias: registro Pedalea Seguro "
             "15-dic-2026; Ley 21.719 (premisa 1-dic-2026; Congreso aprobó postergarla al 15-oct-2027, "
             "pendiente de publicación); políticas de ubicación de Google Play obligatorias 27-ene-2027.")
lines.append("3. Decidir edad mínima de la app (13/14) con el abogado.")
lines.append("4. Aprobar el contacto con Parquemet para obtener la base normativa de las geocercas oficiales.")
lines.append("")
with open(f"{OUT}/PLAN_REMEDIACION_CUMBRE30.md", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

cl = []
cl.append("# CHECKLIST DE LANZAMIENTO — Cumbre30")
cl.append("")
cl.append("**Auditoría pre-lanzamiento Chile · 2026-11-18**")
cl.append("")
cl.append("Marco: [PLAN_REMEDIACION_CUMBRE30.md](PLAN_REMEDIACION_CUMBRE30.md). "
          "Nada de este checklist se marca completo sin la evidencia indicada.")
cl.append("")
cl.append("| # | Ítem | Fase | Criterio de listo | Estado |")
cl.append("| --- | --- | --- | --- | --- |")
for (n, item, fase, criterio) in CHECKLIST:
    cl.append(f"| {n} | {item} | {fase} | {criterio} | ☐ |")
cl.append("")
cl.append("## Puertas de lanzamiento (todas en verde)")
cl.append("")
cl.append("- [ ] Los 4 ítems de Fase A completados con evidencia.")
cl.append("- [ ] Los ítems de Fase B completados **antes de habilitar** cada módulo relacionado.")
cl.append("- [ ] Cero riesgos CRÍTICOS abiertos en la matriz (MATRIZ_RIESGOS_CUMBRE30.xlsx).")
cl.append("- [ ] Calendario normativo verificado la semana del lanzamiento "
             "(21.719, Pedalea Seguro, políticas Play).")
cl.append("- [ ] Toda comunicación pública sin promesas no implementadas "
             "(p. ej. 'llamamos a emergencias por ti' está PROHIBIDA).")
cl.append("")
with open(f"{OUT}/CHECKLIST_LANZAMIENTO_CUMBRE30.md", "w", encoding="utf-8") as f:
    f.write("\n".join(cl))

print("MD_OK", len(lines), len(cl))
