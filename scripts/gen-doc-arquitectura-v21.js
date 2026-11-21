// Arquitectura corregida v2.1 (revisión técnica final) — Rutas y Comunidad Ciclista — Cumbre30
// Genera download/Arquitectura_corregida_v2_1_Cumbre30.docx
// Portada: receta R1 (Pure Paragraph Left) + paleta FG-1 (identidad verde).
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  TableLayoutType,
} = require("docx");
const fs = require("fs");

// ---------- Paleta (FG-1 Forest Mint) ----------
const COVER = {
  bg: "0C1F1A", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
  metaColor: "90989F", accent: "3DDBB5", footerColor: "687078",
};
const T = { headerBg: "2A7A65", headerText: "FFFFFF", accentLine: "2A7A65", innerLine: "C5D8D0", surface: "EDF5F2" };
const PRIMARY = "173F35";
const BODY = "000000";
const GRAY = "808080";

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ---------- Utilidades de portada (design-system.md) ----------
function estimateTextWidth(text, pt) {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isCJK = (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x3000 && code <= 0x303F) || (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0x2E80 && code <= 0x2EFF);
    width += isCJK ? pt * 20 : pt * 11;
  }
  return width;
}
function wrapWords(title, maxWidthTwips, pt) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (estimateTextWidth(cand, pt) <= maxWidthTwips || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    lines = wrapWords(title, maxWidthTwips, titlePt);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = wrapWords(title, maxWidthTwips, minPt); titlePt = minPt; }
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop(); lines[lines.length - 1] += " " + last;
  }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
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
  return { topSpacing, bottomSpacing };
}
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, font: { ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor, font: { ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, verticalAlign: "top",
        children,
      })],
    })],
  })];
}

// ---------- Builders de contenido ----------
const FONT = { ascii: "Times New Roman" };
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: PRIMARY, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: PRIMARY, font: FONT })],
  });
}
function p(text, opts = {}) {
  const runs = [];
  const parts = String(text).split("**");
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    runs.push(new TextRun({ text: parts[i], bold: i % 2 === 1, size: 24, color: BODY, font: FONT }));
  }
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after !== undefined ? opts.after : 120 },
    children: runs,
  });
}
function bullet(text) {
  const parts = String(text).split("**");
  const runs = parts.filter(s => s !== "").map((s, i) => new TextRun({ text: s, bold: i % 2 === 1, size: 24, color: BODY, font: FONT }));
  return new Paragraph({ bullet: { level: 0 }, spacing: { line: 312, after: 60 }, children: runs });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: PRIMARY, font: FONT })],
  });
}
function cellP(text, bold, color) {
  const parts = String(text).split("**");
  const runs = parts.filter(s => s !== "").map((s, i) => new TextRun({ text: s, bold: bold || i % 2 === 1, size: 21, color: color || BODY, font: FONT }));
  return new Paragraph({ spacing: { line: 276 }, children: runs });
}
function dataTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((h, i) => new TableCell({
      children: [cellP(h, true, T.headerText)],
      shading: { type: ShadingType.CLEAR, fill: T.headerBg },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((cellText, i) => new TableCell({
      children: [cellP(cellText, false)],
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? "FFFFFF" : T.surface },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: T.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: T.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}


// ---------- Contenido: secciones 1 a 5 ----------
const seccion1 = [
  h1("1. Decisiones definitivas y registro de cambios v2 → v2.1"),
  p("Este documento es la **revisión técnica final (v2.1)** de la arquitectura corregida aprobada conceptualmente, y es la versión sometida a aprobación antes de iniciar la fase A. Incorpora las correcciones de los cuatro puntos revisados: consultas geográficas (con la corrección de un error real detectado en el predicado del bounding box de la v2), protección geométrica por niveles, migraciones y despliegue con guard de entorno, y moderación ponderada contra denuncias coordinadas. No modifica el motor GPS ni el motor de trazado y no inicia implementación; su objetivo es que las decisiones estructurales queden cerradas y probadas **antes** de que existan rutas y contenido comunitario publicados."),
  tableTitle("Tabla 1: Estado de las decisiones"),
  dataTable(
    ["Decisión", "Estado", "Detalle en"],
    [
      ["Reutilizar motor de trazado y motor GPS; no duplicar servicios de ubicación", "Aprobada (v1)", "Auditoría v1, secciones 4.1 y 6.6"],
      ["Segmentos personales privados; separar ROUTE / ACTIVITY / SEGMENT", "Aprobada (v1)", "Auditoría v1, sección 5"],
      ["Actividades históricas intactas; fases aditivas; compatibilidad web y APK", "Aprobada (v1)", "Auditoría v1, secciones 8 y 9"],
      ["Geometría original privada y pública protegida, con vista previa", "Corregida (v2) · ajustada (v2.1)", "Sección 3"],
      ["Consultas geográficas sobre columnas dedicadas, no sobre polilíneas", "Corregida (v2) · **corregida (v2.1)**", "Sección 4"],
      ["Elevación null explícita; dificultad física y técnica diferenciadas", "Corregida (v2)", "Sección 5"],
      ["Pipeline seguro de fotografías (EXIF, formatos, límites, borrado)", "Nueva (v2)", "Sección 8"],
      ["Moderación con control de abuso, historial y apelaciones", "Corregida (v2) · **ajustada (v2.1)**", "Sección 7"],
      ["Atributos recreativos orientativos sin clasificación competitiva", "Nueva (v2)", "Sección 5.3"],
      ["Entidad de experiencias comunitarias separada de la geometría oficial", "Nueva (v2)", "Sección 6"],
      ["Control de vigencia con fecha de revisión y estados informativos", "Nueva (v2)", "Sección 7.4"],
      ["Migraciones Prisma con guard de entorno y runbook de fallo", "Corregida (v2) · **ampliada (v2.1)**", "Sección 9"],
      ["Suite de pruebas automatizadas como criterio de aceptación", "**Nueva (v2.1)**", "Sección 12"],
    ],
    [52, 18, 30]
  ),
  h2("1.1 Registro de cambios y justificación técnica"),
  p("Los nueve cambios v2 → v2.1 con su justificación técnica; el detalle de cada punto está en la sección indicada y los casos de prueba asociados en la sección 12."),
  tableTitle("Tabla 2: Registro de cambios v2 → v2.1"),
  dataTable(
    ["#", "Cambio", "Justificación técnica"],
    [
      ["C1", "Predicado del bounding box corregido a la forma de intersección: minLat <= norte AND maxLat >= sur AND minLon <= este AND maxLon >= oeste", "La v2 publicaba el predicado invertido (minLat <= sur AND maxLat >= norte), que es de contención: solo encontraría rutas cuyo bbox contiene TODO el viewport, excluyendo justamente las rutas parcialmente visibles — el caso de uso principal. Error real, corregido con la forma canónica de intervalos superpuestos y fijado con pruebas."],
      ["C2", "Celdas geohash: del valor único del centro a cells String[] con todas las celdas que la geometría toca, índice GIN y consulta hasSome", "Con la celda del centro, una ruta larga cuyo centro cae fuera del viewport era invisible aunque lo atravesara. La celda pasa a ser atributo de la geometría completa, garantizando el requisito del encargo de encontrar rutas multi-celda con centro fuera del viewport."],
      ["C3", "Viewport que cruza el antimeridiano: ramificación longitudinal (minLon <= este OR minLon >= oeste)", "Chile continental no cruza ±180°, pero Rapa Nui (−109°) entra en el catálogo y un viewport mal normalizado rompería la consulta de forma silenciosa. Corrección barata, cubierta por prueba CT-G6."],
      ["C4", "Falso positivo del bbox documentado (rutas en U) con decisión explícita para el MVP", "El bbox sobre-aproxima: puede incluir una ruta cuya geometría no cruza el viewport. Decisión: aceptar el falso positivo en el MVP (el render muestra la geometría real y el costo es un resultado de más) y eliminarlo con ST_Intersects al activar PostGIS."],
      ["C5", "Protección por niveles: snap solo ≤ 30 m (deriva GPS); sin snap entre 30 y 80 m; sin geometría inventada en zonas sin vía", "La regla v2 de snap hasta 80 m podía mover un extremo 80 m — una alteración perceptible y con riesgo de tramo artificial. v2.1 restringe el snap a corrección de deriva y en zonas sin conexión al grafo solo recorta y amplía la zona de imprecisión. La continuidad queda garantizada porque solo se recortan prefijo y sufijo."],
      ["C6", "Suite de pruebas automatizadas definida (23 casos: consultas, protección, migraciones, moderación)", "El encargo exige verificación con rutas de distintas extensiones y posiciones. La suite queda especificada en la sección 12 como criterio de aceptación de las fases A, D y E, en CI desde la fase D."],
      ["C7", "Guard de migraciones: prisma migrate deploy solo con VERCEL_ENV=production; previews y desarrollo excluidos", "Un despliegue de preview con DATABASE_URL apuntando a producción por error de configuración podría mutar el esquema de producción. El guard lo vuelve imposible; opcionalmente Neon branching da a cada preview una base efímera."],
      ["C8", "Respaldo y runbook: PITR de Neon, pg_dump previo a migraciones estructurales, política aditiva sin DROP, runbook de migración fallida", "Define el comportamiento ante fallos antes de tener contenido publicado: migrate deploy aborta, el build falla y el deploy anterior de Vercel sigue en línea (despliegues atómicos); la corrección es manual y trazada con migrate resolve."],
      ["C9", "Moderación ponderada: umbral de confianza ≥ 2,0, pesos por antigüedad y actividad, decaimiento por denuncias descartadas, lote sospechoso por velocidad, ocultamiento reversible y notificado", "Con el umbral v2 (dos reportantes), dos cuentas coordinadas nuevas podían ocultar una ruta injustificadamente. El umbral ponderado exige confianza real, la señal de velocidad desactiva el ocultamiento automático ante lotes coordinados y toda decisión queda trazada con su peso y es apelable."],
    ],
    [7, 44, 49]
  ),
];

const seccion2 = [
  h1("2. Modelo de datos corregido"),
  p("El modelo conserva la estructura aprobada en v2 (Route, RouteVersion, RoutePoi, RoutePhoto, RouteFavorite, RouteComment, RouteRating, RouteReport, RouteExperience, ExperiencePhoto, ModerationLog, User.role) con tres ajustes v2.1: la columna de celda única pasa al arreglo **cells** (todas las celdas geohash-5 que la geometría toca), RouteReport incorpora el **peso y la clasificación** del reporte al registrarse, y la política de migraciones se expande a la sección 9 con guard de entorno y runbook."),
  tableTitle("Tabla 3: Route — modelo definitivo (v2.1)"),
  dataTable(
    ["Grupo", "Campos", "Notas"],
    [
      ["Identidad", "id, ownerId, nombre, descripcion, modalidad", "Nombre ≤ 80; descripcion ≤ 2000"],
      ["Geometría pública", "polyline (comprimida), coordsPubVer, minLat/maxLat/minLon/maxLon, cells String[], centerLat/centerLon", "cells: celdas geohash-5 tocadas por la geometría (índice GIN); fallback geohash-4 si supera 64 celdas"],
      ["Extremos aproximados", "inicioAproxLat/Lon, finAproxLat/Lon, proteccion: {recorteIniM, recorteFinM, snapInicio?, snapFin?, sinSnapInicio?, sinSnapFin?}", "Redondeo a 3 decimales (~110 m); snap registrado solo si ocurrió (≤ 30 m, cambio C5)"],
      ["Elevación", "gainM?, lossM?, minEle?, maxEle?, eleFuente (gpx | servicio | null)", "Float? — null prohibido como 0; resuelta al publicar (sección 5.1)"],
      ["Dificultad", "dificultadFisica (1-5), dificultadTecnica (1-5), dificultadOrigen (auto | creador)", "Sugerencia orientativa editable siempre (sección 5.2)"],
      ["Recreativa", "attrs String[] (máx 3 del enumerado)", "escénica, familiar, recreativa, desafiante, principiantes, miradores, descanso"],
      ["Vigencia", "ultimaRevisionAt, estadoVigencia (derivado)", "Estados: vigente | avisos | sin-revisar | retirada (sección 7.4)"],
      ["Ciclo de vida", "status (borrador | publicado | oculta | retirada), timestamps, removedAt?", "Oculta = ocultamiento automático reversible; retirada = despublicación"],
      ["Borrado", "soft-delete (removedAt) + purga diferida", "Primera convención de soft-delete general; precede a Incident.active"],
    ],
    [18, 46, 36]
  ),
  h2("2.1 Entidades nuevas o modificadas"),
  tableTitle("Tabla 4: Entidades del módulo (definitivo)"),
  dataTable(
    ["Tabla", "Campos clave / unicidad", "Propósito"],
    [
      ["RouteVersion", "routeId, v, geometrySnapshot (protegida), metaSnapshot, eleSnapshot?, publishedAt", "Historial; los rides y experiencias anclan a la versión"],
      ["RoutePoi", "routeId, orden, lat, lon, tipo, nombre, nota", "Puntos de interés sobre la geometría pública"],
      ["RoutePhoto", "routeId, url, orden, blobPathname, hash", "Fotos de ficha; blobPathname permite borrado físico"],
      ["RouteFavorite", "@@unique([userId, routeId])", "Guardar / favoritos (patrón Achievement)"],
      ["RouteComment", "routeId, userId, body, removedAt?", "Comentarios con borrado propio/moderador"],
      ["RouteRating", "@@unique([userId, routeId]), valor 1-5, updatedAt", "Una valoración editable por usuario"],
      ["RouteReport", "@@unique([routeId, reporterId, motivo]), motivo enum, estado, peso Float, clasificacion (normal | sospechoso), nota", "Denuncias tipificadas con dedup y **peso de confianza registrado al crear** (sección 7)"],
      ["RouteExperience", "routeId, routeVersionId, userId, rideId?, fechaRealizacion, comentario, condiciones String[], observacion, removedAt?", "Experiencias comunitarias (sección 6)"],
      ["ExperiencePhoto", "experienceId, url, blobPathname", "Fotos de experiencia (máx 3)"],
      ["ModerationLog", "actorId, accion, targetType, targetId, motivo, detalle (pesos y umbral), nota, createdAt", "Historial inmutable; el detalle registra la base de cada decisión"],
      ["User.role", "user | moderador | admin (default user)", "Autoriza /api/moderation; transición con adminKey"],
    ],
    [20, 46, 34]
  ),
  h2("2.2 Convenciones de integridad"),
  p("Toda unicidad de participación se resuelve en base de datos con @@unique compuestos, siguiendo el patrón ya usado por Friendship y Achievement (schema.prisma:222 y 232), no con contadores en el cliente. Todo contenido comunitario usa soft-delete con removedAt y borrado físico diferido de blobs asociados. Los rides referencian RouteVersion (id + v): si la geometría cambia, los rides y experiencias antiguos siguen apuntando a su versión y sus datos permanecen idénticos. El autorreparo runtime existente de incidents (ALTER TABLE ADD COLUMN IF NOT EXISTS en api/incidents/route.ts:26-39) queda como está por ser tabla vigente, pero los módulos nuevos no replican ese patrón: usan migraciones formales (sección 9)."),
];

const seccion3 = [
  h1("3. Privacidad geométrica (ajustada en v2.1)"),
  p("Principio intacto: la **geometría original vive solo en el dispositivo del propietario** (store c30.rutas-v2); el servidor recibe, al publicar, exclusivamente la **geometría pública protegida** derivada en el teléfono. La revisión v2.1 ajusta el mecanismo de extremos (cambio C5) para eliminar todo riesgo de discontinuidad o alteración artificial: el snap se restringe a corrección de deriva GPS y **nunca se inventa geometría**."),
  h2("3.1 Protección por niveles de extremo"),
  p("La protección se aplica por extremo (inicio y fin de forma independiente) con tres niveles, evaluados en este orden:"),
  bullet("**Nivel A — snap de deriva (≤ 30 m):** si el vértice del extremo queda a 30 metros o menos de un nodo de vía del grafo, se sustituye el vértice por la coordenada del nodo. Es la corrección de deriva GPS habitual: imperceptible, sin vértices nuevos y sin desvíos — el segmento previo se acorta o alarga como máximo 30 m y la polilínea sigue conexa. Tras el snap se aplica el truncado."),
  bullet("**Nivel B — sin snap (30-80 m o cualquier otra distancia a una vía):** la regla v2 permitía snap hasta 80 m; v2.1 la retira porque mover un extremo 30-80 m ya es una alteración perceptible del recorrido. Si no hay nodo a ≤ 30 m, **no hay snap**: solo truncado."),
  bullet("**Nivel C — zona sin conexión al grafo (sin vía cercana):** en trailheads rurales o trazados fuera de la red cartografiada no se crea ningún tramo de conexión al grafo — inventarlo alteraría artificialmente el recorrido. Se marca sinSnap en el registro de protección, se aplica el truncado sobre la geometría cruda y la zona de imprecisión del extremo conserva su radio de 150 m."),
  p("El **truncado** (común a los tres niveles) recorta desde cada extremo hasta el primer vértice que queda a más de D = 150 metros del extremo original, con tope de 400 m o el 10 % de la distancia, lo que ocurra primero. Como solo elimina prefijo y sufijo de la polilínea, la continuidad queda garantizada por construcción: el resultado es una polilínea conexa, sin saltos, sin vértices añadidos y sin desplazamientos. Si el tope se alcanza (por ejemplo, un inicio a 600 m de la primera vía), la vista previa lo advierte y sugiere mover el extremo manualmente antes de publicar; publicar con tope excedido exige confirmación explícita (prueba CT-P6)."),
  p("Los extremos publicados se representan como **zona aproximada** (círculo de 150 m) con coordenadas redondeadas a 3 decimales (~110 m) en inicioAprox/finAprox — los únicos datos de extremo que consumen búsqueda y ficha; el pin exacto del creador jamás se publica. Los casos del encargo quedan cubiertos: **domicilios urbanos** (el recorte elimina la aproximación privada, prueba CT-P1), **calles sin salida** (son vías del grafo: nivel A si la deriva es ≤ 30 m y el recorte de 150 m elimina el acceso privado, CT-P2), **zonas sin conexión directa al grafo** (nivel C: sin snap, sin tramos inventados, CT-P3). La exportación GPX de una ruta pública entrega la geometría protegida y nada más (CT-P4); solo el propietario puede exportar el original de sus propias rutas desde su dispositivo."),
  h2("3.2 Vista previa de publicación"),
  p("La publicación exige pasar por la vista previa (fase D): mapa con la geometría protegida y capa superpuesta opt-in de la original para comparar; metros recortados por extremo; nivel de protección aplicado por extremo (snap de deriva, solo recorte, sin snap); y la lista exacta de datos que salen del dispositivo (geometría protegida, metadatos, dificultad, atributos, fotos ya sin EXIF, POIs). La confirmación exige marcar «revisé la protección aplicada». Las pruebas CT-P de la sección 12 verifican que el payload del POST y el GPX exportado contienen únicamente información protegida y que la original jamás sale del dispositivo."),
];

const seccion4 = [
  h1("4. Estrategia geográfica (corregida en v2.1)"),
  p("La búsqueda por área nunca decodifica polilíneas: las consultas corren sobre columnas dedicadas calculadas al escribir, y la polilínea comprimida es solo el formato de entrega. La revisión v2.1 corrige el predicado de intersección (error real de la v2, cambio C1), sustituye la celda única por el arreglo de celdas tocadas (C2) y define el manejo de límites geográficos y las pruebas automatizadas (C3, C4, C6)."),
  h2("4.1 Predicado de intersección corregido"),
  p("Sea el viewport definido por norte (n), sur (s), este (e) y oeste (o). La intersección entre el bbox de la ruta [minLat, maxLat] × [minLon, maxLon] y el viewport usa la forma canónica de intervalos superpuestos:"),
  bullet("**Latitud:** minLat <= n AND maxLat >= s. **Longitud:** minLon <= e AND maxLon >= o. El predicado es inclusivo en los bordes: una ruta que toca el límite del viewport por un vértice sí se incluye (prueba CT-G4)."),
  bullet("**Error de la v2 (C1):** publicaba minLat <= s AND maxLat >= n — la contención del viewport dentro del bbox de la ruta — que excluye las rutas parcialmente visibles, el caso de uso principal de la búsqueda por mapa. Corregido, fijado en la especificación y cubierto por pruebas para evitar regresión."),
  bullet("**Antimeridiano (C3):** si o > e (viewport que cruza ±180°, aplicable a Rapa Nui y zonas futuras), la condición longitudinal se ramifica en (minLon <= e OR minLon >= o); el generador de celdas usa la misma ramificación (prueba CT-G6)."),
  bullet("**Falso positivo aceptado (C4):** el bbox sobre-aproxima: una ruta en U cuyo bbox cruza el viewport pero cuya geometría no aparece en resultados. Decisión para el MVP: aceptarlo — el usuario ve la geometría real al renderizar y el costo es un resultado de más; ST_Intersects lo elimina al activar PostGIS sin cambiar la API (prueba CT-G5 documenta el comportamiento)."),
  h2("4.2 Celdas multi-celda: todas las celdas tocadas (C2)"),
  p("La v2 indexaba la celda geohash-5 del centro: una ruta larga cuyo centro cae fuera del viewport era invisible aunque lo atravesara. v2.1 almacena **cells String[]**: el conjunto de celdas geohash-5 (~4,9 × 4,9 km) que la geometría toca, calculado al escribir recorriendo la polilínea y subdividiendo los segmentos más largos que la celda. Con índice **GIN** (@@index([cells], type: Gin)) la consulta usa el solapamiento de arreglos (en Prisma, hasSome) contra las celdas del viewport, y el predicado bbox corregido afina el resultado. Una ruta urbana típica toca 1-6 celdas y una de 150 km unas 30; si una ruta supera 64 celdas, su conjunto se almacena en geohash-4 (~39 km, más grueso) y el generador de celdas del viewport incluye también las celdas madre geohash-4 de sus celdas geohash-5, de modo que la mezcla de granularidades sigue encontrando la ruta. Esto cumple el requisito del encargo: rutas que atraviesan varias celdas se encuentran aunque su centro esté fuera del viewport (pruebas CT-G2 y CT-G6)."),
  h2("4.3 Orden, paginación y PostGIS"),
  p("Se conservan de la v2: centerLat/centerLon para orden por cercanía (haversine en SQL), distKm indexado para los filtros de distancia, @@index([status, createdAt]) y paginación por cursor (LIMIT 20, cursor por id/createdAt) estable ante inserciones entre páginas (CT-G7). PostGIS mantiene su papel de ruta de migración documentada: al superar ~20 mil rutas o requerir vecino más cercano real por geometría, se agrega la columna geometry(LineString, 4326) poblada desde la polyline, índice GIST y ST_Intersects/ST_DWithin por $queryRaw — migración aditiva y sin downtime que elimina además el falso positivo del bbox (C4). La tabla comparativa de la v2 (criterios, dependencias y riesgo operativo de ambas opciones) sigue vigente."),
  h2("4.4 Pruebas automatizadas de consultas"),
  p("La suite (vitest sobre base de datos efímera con las mismas migraciones) se especifica en la sección 12 con ocho casos CT-G: rutas de distintas extensiones (menos de 1 km a más de 150 km), posiciones (contenida, parcial, esquina, adyacente, multi-celda con centro fuera), límites geográficos (borde inclusivo, antimeridiano) y estabilidad de paginación. Son criterio de aceptación de la fase D y quedan en CI para toda modificación futura del motor de búsqueda."),
];

const seccion5 = [
  h1("5. Elevación, dificultad y atributos recreativos"),
  h2("5.1 Elevación: null explícito, jamás cero"),
  p("Los campos gainM, lossM, minEle y maxEle son **Float?** y permanecen null cuando no hay información; el cero ficticio queda prohibido en esquema y en UI (la ficha muestra «—» con la etiqueta «sin datos de elevación»). El origen queda trazado en eleFuente: gpx (calculada al importar con las reglas existentes de parseGpxLine), servicio o null. Para las rutas trazadas con el motor — donde hoy el creador fija gainM = 0 (useCreadorTrazas.ts:96) — la resolución se traslada al **servidor en el momento de publicar**: el endpoint de publicación muestrea la geometría protegida contra un servicio de elevación (Open-Meteo Elevation, sin clave, ~100 puntos por ruta) y guarda los cuatro valores con eleFuente = servicio; si el servicio falla, la ruta se publica igual con null y el creador puede «recalcular elevación» desde la ficha (idempotente por RouteVersion). No se resuelve en el teléfono para no duplicar dependencias ni costos por dispositivo."),
  h2("5.2 Dificultad física y técnica, con revisión del creador"),
  p("Dos escalas independientes de 1 a 5 (muy fácil, fácil, media, difícil, muy difícil). La **clasificación automática es orientativa y editable siempre**: dificultadFisica se sugiere desde datos objetivos (distKm, gainM cuando exista, pendiente media) y dificultadTecnica desde superficie y atributos del entorno; el campo dificultadOrigen registra si el valor vigente es auto o del creador. Cuando gainM es null, la sugerencia física se calcula solo con distancia y la UI la presenta como «sugerencia preliminar — revisa y ajusta». Las sugerencias se recalculan al editar geometría o metadatos, pero **nunca sobrescriben** un valor ajustado por el creador."),
  h2("5.3 Atributos recreativos"),
  p("Enumerado cerrado de siete valores — escénica, familiar, recreativa, desafiante, para principiantes, con miradores, con zonas de descanso — que el creador marca (máximo tres) y la ficha presenta como chips informativos con la leyenda «atributos orientativos definidos por el creador». La plataforma no los verifica automáticamente ni los convierte en ranking: **no existe clasificación competitiva por velocidad en rutas** — el rendimiento por tramos sigue viviendo en los segmentos personales. El catálogo ordena por relevancia, fecha y valoración de experiencia (comodidad), nunca por tiempo; el «tiempo estimado orientativo» se muestra como rango (±25 %) y la etiqueta «completada» es binaria, sin tiempo objetivo ni fantasma de ruta."),
];

// __PART2B__

// ---------- Contenido: secciones 6 a 14 ----------
const seccion6 = [
  h1("6. Experiencias comunitarias"),
  p("La experiencia comunitaria (RouteExperience, tabla 4) asocia vivencias reales a una ruta sin tocar jamás su geometría oficial: fotografías (hasta 3), comentario, observaciones (≤ 500 caracteres), condiciones del recorrido como etiquetas tipificadas (camino en buen estado, tramo cerrado, barro, mucho tráfico, sombra, agua disponible — hasta 3) y **fecha de realización** (la del ride asociado o la que el usuario elija). Cada experiencia ancla a una RouteVersion concreta: si la ruta se edita después, la experiencia sigue describiendo con fidelidad la versión que se recorrió."),
  p("Reglas de separación y moderación: las experiencias viven en tablas propias, se muestran en la ficha bajo una sección «Experiencias» con etiqueta de contenido comunitario (distinta de los datos oficiales), y ninguna operación de experiencia puede escribir en Route. Un usuario registra una experiencia por ruta y día (unicidad por [userId, routeId, fecha]); puede borrar la suya (soft-delete) y el moderador puede ocultarla. El flujo natural nace en la fase F: al terminar un ride ligado a una ruta, la app ofrece «agregar experiencia», rellenando rideId y fecha automáticamente; también se puede escribir desde la ficha sin ride. **La pista GPS del ride nunca acompaña a la experiencia** — solo salen del dispositivo los textos, fotos y metadatos que el usuario ve en la confirmación."),
];

const seccion7 = [
  h1("7. Moderación, apelaciones y vigencia (ajustada en v2.1)"),
  h2("7.1 Reportes tipificados y controles de abuso"),
  p("Los motivos quedan tipificados como enumerado: **cierre, peligro, error geográfico, spam y contenido inapropiado**. Los controles base se mantienen de la v2: deduplicación por [routeId, reporterId, motivo] (única denuncia por usuario y motivo, resuelta por @@unique), rate limit con el guard() existente (10 reportes/día por usuario, rateLimit.ts:50) y la regla de que el autor no puede denunciar su propia ruta (patrón ya vigente en incidents, api/incidents/route.ts:178-180)."),
  h2("7.2 Umbral ponderado de confianza y defensa contra denuncias coordinadas (C9)"),
  p("El mecanismo v2 ocultaba automáticamente con dos reportantes; dos cuentas coordinadas nuevas podían abusar. v2.1 sustituye el conteo por un **umbral ponderado de confianza**: cada reporte se registra con el peso del reportante en RouteReport (peso, clasificacion), calculado en el servidor al crearlo — veterano 1,5 (cuenta con ≥ 90 días y ≥ 3 contribuciones confirmadas o ≥ 20 rides), usuario regular 1,0, cuenta nueva o de poca actividad 0,5 (menos de 30 días o sin contribuciones confirmadas). El peso **decae 0,25 por cada denuncia descartada** de ese reportante (mínimo 0,25): el denunciante reincidente pierde capacidad de ocultar."),
  p("Reglas de ocultamiento automático — exclusivas de los motivos **cierre y peligro** — quedan así: la suma de pesos de reportantes distintos debe ser ≥ 2,0 **y** al menos 2 reportantes distintos; un **lote sospechoso** (tres o más denuncias del mismo motivo en menos de una hora desde cuentas creadas la misma semana) marca clasificacion = sospechoso y desactiva el ocultamiento automático para ese lote: pasa siempre a cola de moderación. Todo ocultamiento automático es **reversible** por el moderador, **notifica al autor** con el motivo y el enlace de apelación, y queda registrado en ModerationLog con los pesos y el umbral aplicado (detalle de la decisión). El resto de motivos (error geográfico, spam, contenido inapropiado) no ocultan automáticamente en ningún caso: van siempre a cola."),
  h2("7.3 Flujo de revisión, apelaciones y trazabilidad"),
  p("El estado del reporte transita abierta → bajo revisión → confirmada | descartada. Ni el reporte ni el ocultamiento modifican jamás la geometría ni los datos oficiales de la ruta: solo afectan visibilidad y estado informativo. Cada acción queda en ModerationLog (actor, acción, objetivo, motivo, detalle con pesos y umbral, nota, fecha) como historial inmutable; el autor puede presentar **una apelación activa por ruta** (nota ≤ 500 caracteres, estado apelada) y el moderador resuelve restaurar o confirmar la medida — ambos desenlaces quedan trazados. Si se confirma la retirada, la ruta pasa a status retirada con posibilidad de edición y republicación posterior al corregir el motivo; apelaciones rechazadas repetidas activan revisión de cuenta por el propietario del producto. La moderación usa el rol User.role (moderador) autorizando /api/moderation, con la transición inicial protegida por la clave admin timing-safe existente (adminKey.ts:10, hash SHA-256 y timingSafeEqual)."),
  h2("7.4 Control de vigencia"),
  p("Cada ruta pública lleva **ultimaRevisionAt** y un estado informativo derivado que la ficha muestra como banner: vigente (revisada hace menos de 6 meses), avisos activos (reportes de cierre o peligro confirmados o abiertos, con su número), sin revisar (más de 6 meses desde la última revisión o publicación) y retirada. La revisión es una acción del creador («revisé esta ruta hoy», que actualiza ultimaRevisionAt y limpia avisos confirmados resueltos) o del moderador. El patrón reutiliza la vigencia de avisos operativos (desde/hasta en public/avisos.json y avisoVigente en avisos.ts:53) y la caducidad por antigüedad de incidents (30 días), pero **los reportes nunca cambian la geometría**: un cierre confirmado queda como aviso informativo con fecha hasta que el creador o el moderador lo resuelvan."),
];

const seccion8 = [
  h1("8. Pipeline de fotografías"),
  p("Cumbre30 no sube imágenes hoy (la credencial Parquemet se procesa y queda en localStorage), pero el re-encode en canvas ya existe como precedente directo: processQrImage en Wallet.tsx:55-83 re-encodea a máx 1024 px con JPEG 0,92. El pipeline de fotos del módulo lo generaliza con seguridad completa:"),
  bullet("**Cliente (antes de salir del dispositivo):** acepta JPEG/PNG/WebP verificando magic bytes; rechaza > 8 MB; re-encodea en canvas al lado largo máximo de 1600 px con JPEG calidad 0,85. El re-encode **elimina EXIF por construcción** (coordenadas, fecha y dispositivo no viajan), y el objetivo de peso queda ≤ 1,5 MB por foto."),
  bullet("**Transporte y storage:** POST multipart a /api/upload con sesión; el servidor almacena en **Vercel Blob** (despliegue ya Vercel + Neon, región gru1) mediante token server-side; URL pública no adivinable y blobPathname registrado para borrado físico. Alternativa documentada: cualquier storage S3-compatible sin cambiar el diseño."),
  bullet("**Servidor (validación de entrada):** re-verifica magic bytes y tamaño, genera nombre aleatorio (sin nombre de archivo del usuario), limita 6 fotos por ruta y 3 por experiencia, y deduplica por hash opcional."),
  bullet("**Ciclo de vida y borrado:** al eliminar una foto o el contenido que la contiene (soft-delete y purga), se ejecuta del() del blob correspondiente; job de purga para huérfanos semanal. La eliminación por moderador queda trazada en ModerationLog."),
  bullet("**Moderación:** las fotos son reportables (motivo contenido inapropiado), con ocultamiento automático por umbral ponderado (sección 7.2) y eliminación directa por moderador; el uploader queda identificado por sesión para abuso repetido."),
];

const seccion9 = [
  h1("9. Migraciones y despliegue (ampliada en v2.1)"),
  p("El proyecto actual no mantiene carpeta de migraciones: el esquema se aplica con db push manual (scripts package.json:10-13) y vercel.json:3 ejecuta solo prisma generate. El módulo introduce **prisma migrate** formal (carpeta prisma/migrations versionada en git) y la revisión v2.1 define el entorno de ejecución, el respaldo y el comportamiento ante fallos — los cambios C7 y C8 del registro."),
  h2("9.1 Guard de entorno: migrar solo en producción"),
  bullet("El comando de build de producción ejecuta **prisma generate && prisma migrate deploy && next build únicamente cuando VERCEL_ENV=production**; en preview y desarrollo corre solo prisma generate. Así, un despliegue de preview nunca muta el esquema — ni siquiera si su DATABASE_URL apuntara a producción por error de configuración."),
  bullet("**DATABASE_URL se delimita por entorno** en Vercel (Production / Preview / Development) con DIRECT_URL para migraciones; opción recomendada de endurecimiento: **Neon branching**, que da a cada preview una base efímera derivada de producción — cero riesgo y cero costo de datos."),
  bullet("Se prohíbe db push --accept-data-loss fuera del desarrollo local, y **las migraciones de las fases aditivas no contienen DROP COLUMN ni DROP TABLE** (chequeo en CI sobre los archivos de migración, prueba CT-M3); la limpieza de columnas deprecadas se hace en un release posterior, nunca en el que introduce el cambio."),
  h2("9.2 Respaldo y recuperación"),
  p("Tres capas: **PITR de Neon** (restauración a un punto en el tiempo del historial continuo) como red principal; **pg_dump** de respaldo manual antes de cualquier migración estructural mayor, guardado como snapshot verificable; y la **atomicidad de despliegues de Vercel** — el build fallido nunca reemplaza al deploy vigente, así que producción no queda a medias ni con esquema parcial. El procedimiento de restauración se ensaya una vez (prueba CT-M4) antes del primer despliegue con migraciones."),
  h2("9.3 Comportamiento ante migración fallida (runbook)"),
  bullet("Detección: prisma migrate deploy se detiene en la primera migración fallida y el build falla → el deploy anterior sigue sirviendo producción (CT-M2)."),
  bullet("Diagnóstico: prisma migrate status e inspección del error; decidir si la corrección es del SQL de la migración o requiere intervención puntual en la base."),
  bullet("Resolución: corregir y aplicar manualmente lo necesario, marcar el estado con **prisma migrate resolve --applied** (o --rolled-back si se retiró) y volver a disparar el deploy. Toda intervención queda documentada en la entrada del runbook con fecha y causa."),
  bullet("Prevención: cada migración nueva se prueba en la base efímera de la suite (misma versión de migraciones) y contra una copia de staging antes del deploy de producción."),
];

const seccion10 = [
  h1("10. Seguridad y privacidad consolidada"),
  tableTitle("Tabla 5: Matriz de datos — qué sale del dispositivo y qué nunca sale"),
  dataTable(
    ["Dato", "Sale del dispositivo", "Condición"],
    [
      ["Pista GPS cruda de actividades", "**Nunca** (política vigente)", "Los rides siguen subiendo solo agregados con dedupe por clientId"],
      ["Geometría original de una ruta propia", "**Nunca**", "Solo la geometría protegida al publicar (sección 3, CT-P1/P3/P4)"],
      ["Extremos exactos (puerta de casa)", "**Nunca**", "Publicados como zona aproximada redondeada a ~110 m"],
      ["Geometría protegida + metadatos", "Solo al publicar", "Vista previa con checklist de revisión obligatoria"],
      ["Fotografías", "Solo tras re-encode local", "Sin EXIF, ≤ 1,5 MB, formatos validados en cliente y servidor"],
      ["Experiencias (texto + fotos + fecha)", "Solo con confirmación explícita", "Nunca incluyen pista GPS; anclan a RouteVersion"],
      ["Export GPX de ruta pública", "Geometría protegida", "El original solo lo exporta su propietario (CT-P4)"],
    ],
    [30, 26, 44]
  ),
  p("Los controles transversales se heredan y completan: sesiones Bearer/cookie con CORS de Capacitor (apiCors.ts) y backendOrigin() horneado a cumbregeo.cl (backend.ts:51, fijado en scripts/export-web.sh:21); rate limit en todos los endpoints de escritura del módulo (guard() ya probado en auth); autorización por propiedad en cada PATCH/DELETE y por rol en moderación; atribución OSM/ODbL y nota de carácter orientativo sin valor de autorización legal ya presentes en la app; y versionado RouteVersion como base de auditoría de cualquier cambio publicado. El APK sin /api consume por URL absoluta y encola en el outbox ampliado (rutas, favoritos, comentarios, experiencias), con servidor-autoridad y last-write-wins por updatedAt."),
];

const seccion11 = [
  h1("11. Plan A-F ajustado con criterios de aceptación"),
  p("El plan conserva las seis fases aprobadas y las ajusta con las correcciones v2 y v2.1. Cada fase entrega código, compilación verificada (tsc y build web), pruebas funcionales in-vivo, evidencia visual, problemas detectados y documentación técnica; los casos de prueba de la sección 12 se integran como criterios de aceptación de las fases A, D y E."),
  tableTitle("Tabla 6: Alcance ajustado por fase"),
  dataTable(
    ["Fase", "Alcance v2.1 (ajustes en negrita)"],
    [
      ["A. Modelo de datos y migración", "Tablas del modelo definitivo (tablas 3-4); User.role; store c30.rutas-v2; migración por lectura desde c30.trazas; API /api/routes básica; outbox ampliado. **+ prisma migrate con guard de entorno (solo VERCEL_ENV=production), PITR ensayado y runbook (sección 9, CT-M1 a CT-M4)**"],
      ["B. Creación y edición", "Multi-waypoint, POIs, metadatos, borrador; edición post-guardado; export GPX; crear desde actividad. **+ atributos recreativos, dificultad física/técnica con sugerencia editable, elevación null explícita en el editor**"],
      ["C. Biblioteca y fichas", "Cuatro secciones; Mis rutas; ficha completa con acciones. **+ componente de perfil altimétrico nuevo (recharts, ya instalado y sin uso), chips recreativos, banner de vigencia, tiempo estimado en rango**"],
      ["D. Publicación y descubrimiento", "Publicación explícita; RouteVersion; catálogo con búsqueda y filtros; enlaces públicos. **+ protección por niveles con vista previa obligatoria; cells multi-celda con índice GIN y predicado bbox corregido (CT-G1 a CT-G8 en CI); resolución de elevación al publicar (CT-P1 a CT-P6)**"],
      ["E. Comunidad y moderación", "Favoritos, comentarios, valoraciones, reportes; cola con rol; fotos. **+ motivos tipificados con umbral ponderado y lote sospechoso (CT-Mo1 a CT-Mo5), ModerationLog con detalle de pesos, apelaciones, pipeline de fotografías (EXIF/borrado físico), experiencias comunitarias**"],
      ["F. Integración GPS y navegación", "Preset de línea guardada; proyector con estado; eventos persistidos; routeRef + cumplimiento; Mis recorridos. **+ alta de experiencia al terminar ride ligado (con rideId y fecha)**"],
    ],
    [24, 76]
  ),
  h2("11.1 Criterios de aceptación por fase"),
  bullet("**Fase A:** prisma migrate deploy aplicado en producción con guard VERCEL_ENV activo y sin pérdida de datos; migración por lectura reproduce los trazados existentes (id, kind, coords) sin convertir segmentos; compilación tsc 0 y build SUCCESS; smoke test del servidor con la API /api/routes autenticando y rechazando escritura sin sesión; APK export estático compila sin /api; ensayo de restauración PITR (CT-M4) y verificación de que el build de preview no migra (CT-M1)."),
  bullet("**Fase B:** crear ruta con waypoints, atributos y dificultad ajustable desde cero en APK y web; edición post-guardado persiste y se refleja en el mapa; export GPX abre en terceros; elevación queda null visible como «sin datos» cuando no hay fuente — jamás 0."),
  bullet("**Fase C:** las cuatro secciones navegables con identidad verde en tema claro y oscuro; ficha con perfil altimétrico renderizando solo cuando hay elevación; banner de vigencia correcto en sus tres estados básicos; regresión del creador y del panel Mis trazados sin cambios de conducta."),
  bullet("**Fase D:** la publicación nunca envía la geometría original (verificado en payload y en base de datos, CT-P4); extremos publicados en zona aproximada con niveles de protección correctos (CT-P1 a CT-P3, CT-P6); vista previa muestra recortes y exige confirmación; suite CT-G verde en CI con celdas multi-celda, bordes inclusivos y antimeridiano (CT-G2, CT-G4, CT-G6); elevación resuelta al publicar con eleFuente = servicio."),
  bullet("**Fase E:** denuncia única por usuario y motivo (violación de @@unique rechazada); ocultamiento automático solo con umbral ponderado ≥ 2,0 y ≥ 2 reportantes en motivos cierre/peligro (CT-Mo2), y nunca con lotes sospechosos (CT-Mo3); ModerationLog registra cada acción con pesos; apelación restaura o retira con historial (CT-Mo5); foto publicada sin EXIF (verificado extrayendo metadatos del archivo almacenado) y borrada físicamente del blob al eliminar el contenido."),
  bullet("**Fase F:** ride ligado a ruta registra progreso, desvío máximo y reincorporaciones sin tocar useRideEngine; pausas y mala señal no generan desvíos falsos (prueba con simulador); «completada» correcta por geocerca de meta con histéresis; Mis recorridos agrupa por ruta con su versión; experiencia post-ride ancla a la versión recorrida."),
];

const seccion12 = [
  h1("12. Casos de prueba de la revisión (CT-G, CT-P, CT-M, CT-Mo)"),
  p("La suite queda especificada aquí y se implementa dentro de las fases indicadas (no se implementa en esta revisión). Todos los casos se ejecutan con vitest contra base efímera con las mismas migraciones; los de protección, además, con fixtures GPX reales reproducidos del encargo (domicilios, calles sin salida, zonas sin grafo)."),
  tableTitle("Tabla 7: Consultas geográficas (fase D)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-G1", "Ruta corta (< 1 km) contenida en el viewport", "Aparece en resultados"],
      ["CT-G2", "Ruta larga (~40 km) multi-celda cuyo centro cae fuera del viewport pero que lo atraviesa", "Aparece por solapamiento de cells (hasSome) — requisito del encargo"],
      ["CT-G3", "Ruta adyacente al viewport sin intersección real", "No aparece"],
      ["CT-G4", "Ruta que toca el viewport solo por un vértice del bbox (borde)", "Aparece — predicado inclusivo en bordes"],
      ["CT-G5", "Ruta en U cuyo bbox cruza el viewport pero cuya geometría no", "Aparece — falso positivo aceptado del bbox (C4), documentado en la respuesta de la API"],
      ["CT-G6", "Viewport que cruza el antimeridiano (o > e) con ruta en la zona", "Aparece — ramificación longitudinal (minLon <= este OR minLon >= oeste)"],
      ["CT-G7", "Inserción de una ruta nueva entre dos páginas ya paginadas", "Sin duplicados ni saltos con paginación por cursor"],
      ["CT-G8", "10 mil rutas sintéticas, consulta de viewport con take 20", "p95 < 150 ms con índices cells (GIN), bbox y status"],
    ],
    [10, 45, 45]
  ),
  tableTitle("Tabla 8: Protección geométrica (fase D)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-P1", "GPX que inicia a 12 m de un domicilio urbano", "Extremo recortado ≥ 150 m; polilínea conexa única; el original no sale del dispositivo"],
      ["CT-P2", "Inicio en calle sin salida, a 8 m de un nodo del grafo", "Snap de deriva ≤ 30 m; sin vértices nuevos ni desvíos; recorte posterior aplicado"],
      ["CT-P3", "Inicio a 500 m de la vía más cercana (zona sin conexión al grafo)", "sinSnap = true; solo recorte; zona de imprecisión 150 m; ningún tramo de conexión inventado"],
      ["CT-P4", "GPX exportado de una ruta pública", "Trackpoints idénticos a la geometría protegida y distintos del original en los extremos; sin metadatos privados"],
      ["CT-P5", "Ruta trazada con el motor (ya en el grafo)", "Cuerpo interior sin cambios tras la protección (diff de vértices interiores = 0)"],
      ["CT-P6", "Inicio a 600 m de la primera vía (tope de recorte excedido)", "Vista previa advierte; la publicación exige confirmación explícita del tope excedido"],
    ],
    [10, 45, 45]
  ),
  tableTitle("Tabla 9: Migraciones y despliegue (fase A)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-M1", "Deploy de preview con VERCEL_ENV=preview", "No ejecuta prisma migrate deploy (verificable en logs de build)"],
      ["CT-M2", "Migración fallida forzada en entorno de ensayo", "Build falla; el deploy anterior sigue en línea; runbook resuelve con migrate resolve"],
      ["CT-M3", "Migración con DROP COLUMN/TABLE durante las fases aditivas", "Chequeo en CI la rechaza"],
      ["CT-M4", "Ensayo de restauración PITR de Neon sobre base efímera", "Esquema y datos reproducidos al punto elegido"],
    ],
    [10, 45, 45]
  ),
  tableTitle("Tabla 10: Moderación (fase E)"),
  dataTable(
    ["ID", "Escenario", "Resultado esperado"],
    [
      ["CT-Mo1", "Dos cuentas nuevas (< 30 días, peso 0,5) denuncian cierre", "Suma 1,0 < 2,0 → sin ocultamiento automático; pasa a cola"],
      ["CT-Mo2", "Veterano (1,5) y regular (1,0) denuncian peligro", "Suma 2,5 ≥ 2,0 con 2 reportantes → ocultamiento reversible + notificación al autor con apelación"],
      ["CT-Mo3", "Tres denuncias del mismo motivo en < 1 h desde cuentas creadas la misma semana", "clasificacion = sospechoso → cola de moderación, sin auto-hide"],
      ["CT-Mo4", "Denunciante con tres denuncias descartadas (peso decae a 0,25)", "Su denuncia sola ya no alcanza el umbral ponderado"],
      ["CT-Mo5", "Apelación resuelta a favor del autor", "Ruta restaurada; ModerationLog con actor, pesos, umbral y decisión"],
    ],
    [10, 45, 45]
  ),
];

const seccion13 = [
  h1("13. Dependencias y riesgos"),
  tableTitle("Tabla 11: Dependencias externas e internas"),
  dataTable(
    ["Dependencia", "Uso", "Estado"],
    [
      ["Vercel Blob", "Fotos de rutas y experiencias (fase E)", "Nueva; activar storage y token BLOB en Vercel"],
      ["Open-Meteo Elevation", "Elevación al publicar (fase D)", "Nueva; API pública sin clave, con degradación a null y reintento"],
      ["recharts (instalada)", "Perfil altimétrico de la ficha (fase C)", "Ya en package.json sin uso; no añade dependencias"],
      ["prisma migrate", "Esquema versionado con guard de entorno (fase A)", "Nueva; sustituye el db push manual"],
      ["geohash (implementación propia ≤ 60 líneas)", "Celdas de búsqueda y fallback geohash-4 (fase D)", "Nueva, sin paquete externo"],
      ["Neon branching (opcional)", "Base efímera por deploy de preview (fase A)", "Opcional; sin él, el guard VERCEL_ENV ya previene migraciones desde preview"],
    ],
    [30, 40, 30]
  ),
  tableTitle("Tabla 12: Riesgos nuevos o ajustados"),
  dataTable(
    ["Riesgo", "Impacto", "Mitigación"],
    [
      ["Truncado insuficiente para privacidad de extremos", "Exposición parcial de domicilios en rutas importadas", "Vista previa obligatoria con comparación, tope de recorte con aviso (CT-P6) y niveles de protección con casos de prueba (CT-P1 a CT-P3)"],
      ["Denuncias coordinadas", "Ocultamientos injustos de rutas legítimas", "Umbral ponderado ≥ 2,0 con pesos por confianza, lote sospechoso por velocidad, ocultamiento reversible y apelable (CT-Mo1 a CT-Mo5)"],
      ["Servicio de elevación caído o lento", "Publicación degradada", "Publicación no bloqueante con null + recalcular desde la ficha; timeout y caché por RouteVersion"],
      ["Fotos indebidas (UGC)", "Cumplimiento Play Store / privacidad", "Pipeline con EXIF eliminado, validación doble, moderación ponderada y borrado físico"],
      ["Migración fallida en producción", "Esquema o deploy inconsistente", "Deploy atómico de Vercel + runbook con migrate resolve + PITR ensayado (CT-M2, CT-M4)"],
      ["Crecimiento del catálogo", "Consultas lentas", "Paginación por cursor + celdas con GIN; PostGIS como ruta documentada si se supera ~20 mil rutas (CT-G8 valida el rendimiento)"],
      ["Doble geometría (privada/pública) confunde al creador", "Publicaciones con datos no deseados", "Vista previa comparativa; etiquetas «tu copia» vs «copia pública» en Mis rutas"],
      ["Regresión del funcionamiento vigente", "Rides o trazados dañados", "Fases aditivas con release separado; c30.trazas intocado como respaldo; criterios de aceptación con regresión por fase"],
    ],
    [28, 26, 46]
  ),
];

const seccion14 = [
  h1("14. Confirmaciones"),
  p("Las cuatro confirmaciones que solicita la revisión, con su base verificable:"),
  bullet("**No se requiere modificar el motor GPS ni el motor de trazado.** La revisión v2.1 afecta únicamente modelo de datos, endpoints nuevos, protección aplicada al publicar y consultas del catálogo: el motor GPS (useRideEngine y su cadena) y el motor de trazado (routingService/computeRoute) son consumidores de las rutas publicadas, no objetos de cambio. La fase F solo lee su estado existente (routeRef, eventos) sin tocarlos."),
  bullet("**Las actividades históricas y los trazados actuales permanecen intactos.** El store vigente c30.trazas no se toca: la migración de la fase A es por lectura y crea c30.rutas-v2 sin convertir ni renombrar nada; los segmentos personales y los rides existentes no cambian de tabla ni de formato; las fases son aditivas y cada release es verificable de forma independiente."),
  bullet("**La geometría original permanece exclusivamente en el dispositivo.** El servidor recibe solo la geometría protegida al publicar (verificado en payload y en base de datos con CT-P1, CT-P3 y CT-P4); el original no existe en producción y la exportación GPX de una ruta pública regenera la geometría protegida, nunca la original."),
  bullet("**La geometría pública y su exportación GPX contienen únicamente información protegida.** Los extremos se publican como zona aproximada redondeada (~110 m), sin pin exacto ni metadatos privados; la prueba CT-P4 compara los trackpoints del GPX exportado contra la geometría protegida (idénticos) y contra el original (distintos en los extremos)."),
  p("Con la aprobación de esta revisión v2.1, la **fase A** se inicia sobre la v1.14.3 publicada con compilación y pruebas funcionales verificables antes de continuar a la fase B. Los cambios estructurales de consultas, protección, migraciones y moderación quedan especificados y con casos de prueba definidos antes de que exista contenido publicado — que es exactamente el objetivo declarado de esta revisión."),
];

// ---------- Ensamblaje ----------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };
function pageFooter(marker) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: marker ? "\u200B" : "", size: 18, color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY }),
      ],
    })],
  });
}
const bodyHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Cumbre30 · Rutas y Comunidad Ciclista — Arquitectura corregida v2.1", size: 18, color: GRAY, font: FONT })],
  })],
});

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: { ascii: "Times New Roman" }, size: 24, color: BODY }, paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
      heading2: { run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 240, after: 120, line: 312 } } },
    },
  },
  sections: [
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Arquitectura Corregida",
        subtitle: "Rutas y Comunidad Ciclista · Revisión técnica final sobre la arquitectura v2 (v2.1)",
        englishLabel: "CUMBRE30",
        metaLines: [
          "Producto: Cumbre30 · web cumbregeo.cl + APK Android (Vercel + Neon)",
          "Base auditada: v1.14.3 · code 74 — revisión final sobre la arquitectura v2 del 21-11-2026",
          "Documento: Fase 0 · v2.1 — cambios C1-C9, casos de prueba y confirmaciones",
          "Estado: pendiente de aprobación — al aprobarse inicia la fase A",
        ],
        footerLeft: "Cumbre30",
        footerRight: "Uso interno del proyecto",
        palette: COVER,
      }),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter(true) },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Índice", bold: true, size: 32, color: PRIMARY, font: FONT })],
        }),
        new TableOfContents("Tabla de contenidos", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Nota: este índice se genera mediante códigos de campo. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos» para refrescar la numeración de páginas.",
            italics: true, size: 18, color: "888888", font: FONT,
          })],
        }),
      ],
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader },
      footers: { default: pageFooter(false) },
      children: [
        ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
        ...seccion6, ...seccion7, ...seccion8, ...seccion9, ...seccion10,
        ...seccion11, ...seccion12, ...seccion13, ...seccion14,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/Arquitectura_corregida_v2_1_Cumbre30.docx";
  fs.writeFileSync(out, buf);
  console.log("OK", out, buf.length, "bytes");
});
