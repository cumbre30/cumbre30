// ============================================================
// Propuesta Pro — Muro de experiencias de Cumbre30 (español).
// Ruta Create + escena Report (plantilla F propuesta) del skill docx.
// Portada: receta R1 (título largo > 20 chars hace caer R4→R1) con
// paleta GO-1 (Graphite Orange, propuestas). Tipografía latina:
// Times New Roman, cuerpo 12pt negro puro, alineación izquierda sin
// sangría (regla "English Body Text"), interlineado 1.3 (line: 312).
// 3 secciones: portada (margen 0, sin folio) → índice (romanos) →
// cuerpo (arábigos desde 1). TOC + pista de actualización obligatoria.
// ============================================================
"use strict";
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  PageBreak, TableLayoutType,
} = require("docx");
const fs = require("fs");

// ── Paleta GO-1 (Graphite Orange — propuestas) ──
const P = {
  bg: "1A2330", accent: "D4875A",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
  primary: "1A2330", body: "000000", secondary: "606060",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };

// ── Utilidades de portada (design-system) ──
function estimateTextWidth(text, pt) {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isCJK = (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef) || (code >= 0x2e80 && code <= 0x2eff);
    width += isCJK ? pt * 20 : pt * 11;
  }
  return width;
}
function splitTitleLinesByWidth(title, maxWidthTwips, pt) {
  if (estimateTextWidth(title, pt) <= maxWidthTwips) return [title];
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const intento = cur ? cur + " " + w : w;
    if (estimateTextWidth(intento, pt) <= maxWidthTwips || !cur) cur = intento;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}
function calcTitleLayoutMixed(title, maxWidthTwips, preferredPt, minPt) {
  let titlePt = preferredPt;
  let lines = splitTitleLinesByWidth(title, maxWidthTwips, titlePt);
  while (titlePt > minPt && lines.length > 3) {
    titlePt -= 2;
    lines = splitTitleLinesByWidth(title, maxWidthTwips, titlePt);
  }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? 12 * 23 + 600 : 0;
  const englishLabelHeight = hasEnglishLabel ? 9 * 23 + 600 : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ── Portada R1 (Pure Paragraph Left) ──
function buildCoverR1(config) {
  const C = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayoutMixed(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: C.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: C.cover.titleColor, font: { ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.cover.subtitleColor, font: { ascii: "Arial" } })],
    }));
  }
  for (const line of config.metaLines || []) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.cover.metaColor, font: { ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: C.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: C.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders, children })],
    })],
  })];
}

// ── Componentes de cuerpo ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: FONT })],
  });
}
function body(text, opts) {
  const o = opts || {};
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: o.after !== undefined ? o.after : 120 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT })],
  });
}
function bodyRuns(runs, opts) {
  const o = opts || {};
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: o.after !== undefined ? o.after : 120 },
    children: runs.map((r) => new TextRun({ text: r.t, bold: !!r.b, size: 24, color: P.body, font: FONT })),
  });
}
function item(text) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT })],
  });
}
function tituloTabla(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.secondary, font: FONT })],
  });
}
function celda(text, opts) {
  const o = opts || {};
  return new TableCell({
    width: { size: o.w, type: WidthType.PERCENTAGE },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 312 },
      children: [new TextRun({ text, bold: !!o.b, size: 21, color: o.color || P.body, font: FONT })],
    })],
  });
}
function tablaComparativa(headers, filas, anchos) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => celda(t, { w: anchos[i], b: true, fill: P.table.headerBg, color: P.table.headerText })),
      }),
      ...filas.map((f) => new TableRow({
        cantSplit: true,
        children: f.map((t, i) => celda(t, { w: anchos[i] })),
      })),
    ],
  });
}

// ── Encabezado y pie del cuerpo ──
function cabecera() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Propuesta Pro · Muro de Experiencias · Cumbre30", size: 18, color: "808080", font: FONT })],
    })],
  });
}
function pie() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
    })],
  });
}

// ── Contenido ──
const cuerpo = [];

cuerpo.push(h1("1. Resumen ejecutivo"));
cuerpo.push(body("Este documento propone qué funcionalidades del muro de experiencias de Cumbre30 quedan disponibles para todos los usuarios y cuáles se reservan para el plan Pro, de modo que la decisión comercial quede definida antes de desarrollar las siguientes olas. El muro ya está implementado y verificado: la subsección «Experiencias» del módulo «Rutas, segmentos y comunidad» muestra el feed público de experiencias vivas de rutas publicadas, con autor, fecha, condiciones tipificadas del día, comentario, observación y hasta tres fotos por experiencia."));
cuerpo.push(body("La propuesta se apoya en dos principios. Primero, lo social básico es gratis: leer el muro, registrar experiencias y reportar problemas nunca estará detrás de un paywall, porque la confianza de la comunidad es el activo del módulo. Segundo, Pro se vende como amplificación, no como acceso: más fotos, mejores filtros, identidad visible y utilidades de compartición. El plan Pro actual es un pago único de $7.650 (CLP) con nueve beneficios enfocados en el ciclista individual; esta propuesta añade un segundo grupo de beneficios centrado en la comunidad."));
cuerpo.push(bodyRuns([{ t: "Recomendación en una línea: ", b: true }, { t: "todo lo que crea contenido social queda gratis; lo que lo organiza, destaca y comparte pasa a Pro. Las tablas de la sección 4 detallan la frontera exacta por grupo de funcionalidad." }]));

cuerpo.push(h1("2. Estado actual y análisis"));
cuerpo.push(h2("2.1 Lo que ya está construido"));
cuerpo.push(body("El backend de experiencias existe desde la Fase E del módulo: registro con fecha obligatoria, condiciones tipificadas de un enumerado cerrado (máximo tres por experiencia), texto de hasta 2.000 caracteres, observación de hasta 500, unicidad de una experiencia por usuario, ruta y fecha, y anclaje a la versión de la ruta recorrida. La moderación opera con un umbral ponderado de confianza: el ocultamiento automático solo procede en cierres o peligro, con reportantes de peso distinto (veterano 1,5; regular 1,0; cuenta nueva 0,5) y un umbral de 2,0 puntos con al menos dos reportantes distintos; toda decisión queda en un historial de moderación auditable."));
cuerpo.push(body("El muro público agregó la capa de lectura: un endpoint de feed que solo expone experiencias vivas de rutas publicadas — las ocultas por moderación y las retiradas jamás muestran contenido — con el nombre de usuario público, un resumen ligero de la ruta sin geometría, hasta tres fotos y contadores de experiencias y ciclistas. La lectura exige sesión iniciada, en línea con la política de invitado vigente: el mapa es libre y todo el módulo comunitario vive en la cuenta."));
cuerpo.push(h2("2.2 El sistema Pro hoy"));
cuerpo.push(body("Pro es una compra única activada por licencia, con estos beneficios declarados en la aplicación: exportación GPX de viajes con GPS, constancias PDF ilimitadas (el plan gratuito permite tres al mes), segmentos del cerro con récord personal e historial, buscador universal con trazado automático, historial ilimitado de viajes (gratuito: los últimos veinte), estadísticas avanzadas mensuales, desafíos completos y todos los pines (gratuito: el primero de cada serie), temas de color y velocímetro personalizable, y apoyo directo al desarrollo. Ninguno de estos beneficios toca la comunidad: el terreno es virgen y la frontera puede definirse sin retirar nada ya prometido."));

cuerpo.push(h1("3. Objetivos y resultados esperados"));
cuerpo.push(body("El objetivo comercial es dar al plan Pro un segundo bloque de valor coherente con la comunidad, de modo que el ciclista activo en el muro tenga razones concretas para comprar más allá de las funciones individuales actuales. El objetivo de producto es que la frontera gratuito/Pro resulte comprensible de un vistazo: nada de lo esencial se bloquea, y cada función Pro es una mejora visible sobre algo que ya se usó gratis."));
cuerpo.push(body("Resultados esperados: primero, que la tasa de conversión a Pro entre ciclistas con al menos una experiencia registrada sea medible y mejore respecto de la base actual; segundo, que el muro crezca en contenido de calidad (experiencias con foto y condiciones), porque las mejoras Pro premian la creación, no el consumo; tercero, que ningún elemento de seguridad — reportes, moderación, registro básico — quede tras el paywall, protegiendo la confianza que sostiene el módulo."));

cuerpo.push(h1("4. Diseño de la solución: la frontera gratuito/Pro"));
cuerpo.push(body("La frontera se organiza en cuatro grupos funcionales más una reserva explícita de lo que jamás se monetiza. Cada tabla indica qué queda gratis hoy y qué se añade a Pro; ninguna funcionalidad existente gratuita se retira."));

cuerpo.push(h2("4.1 Grupo A — Crear experiencias"));
cuerpo.push(tituloTabla("Tabla 1: Crear experiencias — plan gratuito frente a Pro"));
cuerpo.push(tablaComparativa(
  ["Capacidad", "Gratuito (hoy)", "Pro (propuesto)"],
  [
    ["Texto, fecha y condiciones", "Incluido", "Incluido"],
    ["Observación del día", "Incluida", "Incluida"],
    ["Fotos por experiencia", "1 foto", "Hasta 6 fotos con galería"],
    ["Destacar una experiencia propia", "No disponible", "1 experiencia fijada por ruta en el perfil"],
    ["Borrador de experiencia a medio escribir", "No disponible", "Guardado local hasta completarlo"],
  ],
  [30, 33, 37]
));
cuerpo.push(body("Justificación: las fotos son el mayor costo real (almacenamiento y moderación) y a la vez la mayor mejora percibida; ampliarlas de una a seis crea un límite natural y honesto. Destacar una experiencia propia conecta con la identidad de creador sin introducir ranking: es una elección del autor, no una métrica de la plataforma.", { after: 200 }));

cuerpo.push(h2("4.2 Grupo B — Leer y organizar el muro"));
cuerpo.push(tituloTabla("Tabla 2: Lectura del muro — plan gratuito frente a Pro"));
cuerpo.push(tablaComparativa(
  ["Capacidad", "Gratuito (hoy)", "Pro (propuesto)"],
  [
    ["Feed público reciente", "Completo, últimos 30", "Completo, últimos 30"],
    ["Filtro por condición del camino", "No disponible", "Sí (barro, cierre, sombra, agua, etc.)"],
    ["Vista «Siguiendo» prioritaria", "Lista simple", "Feed propio con actividad de amigos primero"],
    ["Rango de fechas en el feed", "No disponible", "Sí"],
    ["Historial completo de experiencias de una ruta", "Últimas 30", "Completo, paginado"],
  ],
  [30, 33, 37]
));
cuerpo.push(body("Justificación: la lectura general permanece íntegra en gratuito — el muro debe sentirse público y vivo para todos — y Pro vende organización sobre esa misma lectura, que es donde el ciclista frecuente siente el dolor de buscar.", { after: 200 }));

cuerpo.push(h2("4.3 Grupo C — Identidad y reconocimiento"));
cuerpo.push(tituloTabla("Tabla 3: Identidad en la comunidad — plan gratuito frente a Pro"));
cuerpo.push(tablaComparativa(
  ["Capacidad", "Gratuito (hoy)", "Pro (propuesto)"],
  [
    ["Nombre de usuario en el muro y la ficha", "Incluido", "Incluido"],
    ["Distintivo Pro visible en tarjetas y ficha", "No aplica", "Sí, con marco de avatar"],
    ["Panel «Tu aporte» con histórico completo", "Resumen básico", "Histórico completo + rutas cubiertas"],
    ["Agradecimientos recibidos («útil» en experiencias)", "Contador simple", "Desglose y evolución en el perfil"],
  ],
  [30, 33, 37]
));
cuerpo.push(body("Justificación: el distintivo convierte la compra en pertenencia visible y, al mismo tiempo, publicita Pro dentro del muro de forma orgánica. El agradecimiento «útil» ya tiene paridad conceptual con las valoraciones existentes y no introduce ranking público de ciclistas.", { after: 200 }));

cuerpo.push(h2("4.4 Grupo D — Utilidades de compartición y avisos"));
cuerpo.push(tituloTabla("Tabla 4: Utilidades — plan gratuito frente a Pro"));
cuerpo.push(tablaComparativa(
  ["Capacidad", "Gratuito (hoy)", "Pro (propuesto)"],
  [
    ["Ir a la ruta desde el muro", "Incluido", "Incluido"],
    ["Tarjeta imagen de una experiencia para compartir", "No disponible", "Sí, con el motor visual de las tarjetas actuales"],
    ["Aviso cuando hay actividad nueva en una ruta guardada", "No disponible", "Sí, con control por ruta"],
    ["Exportar el historial propio de experiencias", "No disponible", "Sí, en formato legible"],
  ],
  [30, 33, 37]
));
cuerpo.push(body("Justificación: reutiliza el motor de imágenes para compartir ya existente (fichas de ADN y semana), cuyo costo de desarrollo está amortizado, y añade un beneficio de notificación que incrementa el retorno diario a la app sin convertir avisos en spam: cada usuario elige en qué rutas quiere actividad.", { after: 200 }));

cuerpo.push(h2("4.5 Lo que jamás irá a Pro"));
cuerpo.push(body("Queda expresamente fuera del paywall: registrar experiencias (texto, fecha, condiciones y observación), reportar cierres o peligros, la moderación y sus apelaciones, la lectura general del muro y la ficha pública de las rutas. Son la base de confianza del módulo: monetizarlas fragmentaría la comunidad exactamente donde necesita estar unida. Esta reserva es también un argumento de venta — Pro se comunica como apoyo y amplificación, nunca como rescate de funciones secuestradas."));

cuerpo.push(h1("5. Hoja de ruta de implementación"));
cuerpo.push(body("La implementación se organiza en tres olas de tamaño acotado, cada una con valor autónomo y verificable, aprovechando que el backend de la Fase E ya cubre datos, moderación y fotos."));
cuerpo.push(item("Ola 1 — Identidad y fotos (Grupo A y distintivo Pro): ampliación del límite de fotos, distintivo visible y panel de aporte ampliado. Es la ola más barata y la que hace visible Pro dentro del muro."));
cuerpo.push(item("Ola 2 — Organización del feed (Grupo B): filtros por condición y fecha, vista «Siguiendo» prioritaria y paginación completa del historial por ruta."));
cuerpo.push(item("Ola 3 — Compartición y avisos (Grupo D): tarjeta imagen de experiencia, avisos por ruta guardada y exportación del historial propio."));
cuerpo.push(body("Cada ola se entrega con su batería de pruebas contra base de datos real y verificación en navegador, siguiendo el estándar de las fases anteriores del módulo. No se propone fecha de calendario: la secuencia depende de las prioridades del cliente y puede reordenarse sin costo técnico, porque las olas no tienen dependencias entre sí.", { after: 200 }));

cuerpo.push(h1("6. Recursos y requisitos"));
cuerpo.push(body("El sistema de licencias Pro existente (pago único, activación por código y verificación de estado) se reutiliza sin cambios: las nuevas funcionalidades solo añaden comprobaciones de plan en los endpoints y componentes correspondientes. El almacenamiento de fotos ya opera con registros vinculados a cada experiencia y con borrado moderable, por lo que el aumento de límite no requiere infraestructura nueva, solo vigilancia del volumen. Los requisitos previos son dos decisiones del cliente: confirmar la frontera de la sección 4 (o ajustarla) y confirmar el orden de las olas. Con eso, cada ola es un ciclo completo de desarrollo, pruebas y entrega independiente."));

cuerpo.push(h1("7. Riesgos y mitigaciones"));
cuerpo.push(tituloTabla("Tabla 5: Riesgos principales y mitigación propuesta"));
cuerpo.push(tablaComparativa(
  ["Riesgo", "Efecto", "Mitigación"],
  [
    ["Percepción de muro fragmentado por el paywall", "Menos participaciones, comunidad desconfiada", "Todo lo social básico gratis (sección 4.5); Pro solo amplifica"],
    ["Crecimiento del almacenamiento de fotos", "Costo operativo creciente", "Límite de 6 fotos para Pro, 1 para gratuito; moderación con borrado ya existente"],
    ["Avisos percibidos como spam", "Desactivación de notificaciones", "Suscripción optativa por ruta y agrupación diaria"],
    ["Distintivo Pro leído como estatus de compra", "Mala recepción en la comunidad", "Comunicarlo como apoyo al desarrollo; sin ranking de ciclistas"],
  ],
  [30, 30, 40]
));
cuerpo.push(body("El riesgo mayor es el primero y por eso la reserva de la sección 4.5 es innegociable en esta propuesta: la experiencia previa del módulo demuestra que la participación depende de que reportar y compartir sea gratuito y seguro.", { after: 200 }));

cuerpo.push(h1("8. Beneficios esperados y evaluación"));
cuerpo.push(body("Los beneficios se evaluarán con métricas definidas antes de la primera ola, sin inventar valores de partida: se medirá la línea base actual y se comparará tras cada ola. Las métricas propuestas son cuatro: tasa de conversión a Pro entre ciclistas con al menos una experiencia registrada; proporción de experiencias que incluyen foto (calidad del contenido); retorno semanal de usuarios con rutas guardadas con avisos activos; y participación en el muro medida como experiencias nuevas por semana. La decisión de continuar, ajustar o detener las olas se tomará con esos pares de valores (antes y después), no con impresiones."));
cuerpo.push(body("Como criterio de éxito mínimo de la propuesta completa se sugiere que la conversión a Pro del segmento con experiencias supere de forma sostenida a la del resto de usuarios activos; de no cumplirse tras la Ola 2, conviene revisar la frontera del Grupo B antes de construir la Ola 3. Este documento queda listo para revisión del cliente; cualquier ajuste a las tablas de la sección 4 se incorpora como versión 1.1 y las olas se planifican sobre la versión aprobada."));

// ── Documento ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: FONT, size: 32, bold: true, color: P.primary }, paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 } },
      heading2: { run: { font: FONT, size: 28, bold: true, color: P.primary }, paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 } },
    },
  },
  sections: [
    { // Sección 1: portada — margen 0, sin folio
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Propuesta Pro",
        subtitle: "Funcionalidades del muro de experiencias para el plan gratuito y Pro",
        englishLabel: "CUMBRE30 PRODUCT",
        metaLines: [
          "Módulo: Rutas, segmentos y comunidad",
          "Documento: propuesta para revisión del cliente",
          "Fecha: 21 de noviembre de 2026",
          "Versión: 1.0",
        ],
        footerLeft: "Cumbre30",
        footerRight: "cumbregeo.cl",
        palette: P,
      }),
    },
    { // Sección 2: índice — romanos
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pie() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Índice", bold: true, size: 32, font: FONT, color: P.primary })],
        }),
        new TableOfContents("Tabla de contenidos", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "Nota: este índice se genera mediante campos. Para actualizar los números de página tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos».", italics: true, size: 18, color: "888888", font: FONT })],
        }),
        // Sin PageBreak final: la sección siguiente ya es NEXT_PAGE
        // (PageBreak + nextPage = página en blanco).
      ],
    },
    { // Sección 3: cuerpo — arábigos desde 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: cabecera() },
      footers: { default: pie() },
      children: cuerpo,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/Propuesta_Pro_Muro_Experiencias.docx", buf);
  console.log("OK: Propuesta_Pro_Muro_Experiencias.docx generado");
});
