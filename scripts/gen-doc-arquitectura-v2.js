// Arquitectura corregida — Rutas y Comunidad Ciclista (v2) — Cumbre30
// Genera download/Arquitectura_corregida_rutas_comunidad_Cumbre30.docx
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
  h1("1. Decisiones definitivas"),
  p("Este documento complementa la auditoría técnica del 21 de noviembre de 2026 (v1) tras la revisión del cliente. La dirección ROUTE-ACTIVITY-SEGMENT y el diagnóstico general quedan **aprobados**; aquí se fijan las decisiones definitivas incorporando los seis ajustes obligatorios (privacidad geométrica, consultas geográficas, elevación y dificultad, fotografías, moderación y los nuevos apartados de experiencia recreativa, experiencias comunitarias y vigencia). Nada de esto inicia implementación todavía: al aprobarse esta arquitectura corregida, se inicia la fase A con compilación y pruebas verificables. El motor GPS y los motores existentes no se modifican."),
  tableTitle("Tabla 1: Estado de las decisiones"),
  dataTable(
    ["Decisión", "Estado", "Detalle en"],
    [
      ["Reutilizar motor de trazado y motor GPS; no duplicar servicios de ubicación", "Aprobada (v1)", "Auditoría v1, secciones 4.1 y 6.6"],
      ["Segmentos personales privados; separar ROUTE / ACTIVITY / SEGMENT", "Aprobada (v1)", "Auditoría v1, sección 5"],
      ["Actividades históricas intactas; fases aditivas; compatibilidad web y APK", "Aprobada (v1)", "Auditoría v1, secciones 8 y 9"],
      ["Geometría original privada y geometría pública protegida, con vista previa", "**Corregida (v2)**", "Sección 3"],
      ["Consultas geográficas sobre columnas dedicadas (bbox + celdas), no sobre polilíneas", "**Corregida (v2)**", "Sección 4"],
      ["Elevación null explícita; dificultad física y técnica diferenciadas y ajustables", "**Corregida (v2)**", "Sección 5"],
      ["Pipeline seguro de fotografías (EXIF, formatos, límites, borrado)", "**Nueva (v2)**", "Sección 8"],
      ["Moderación con control de abuso, deduplicación, historial y apelaciones", "**Corregida (v2)**", "Sección 7"],
      ["Atributos recreativos orientativos sin clasificación competitiva", "**Nueva (v2)**", "Sección 5.3"],
      ["Entidad de experiencias comunitarias separada de la geometría oficial", "**Nueva (v2)**", "Sección 6"],
      ["Control de vigencia con fecha de revisión y estados informativos", "**Nueva (v2)**", "Sección 7.4"],
      ["Migraciones Prisma formales para el módulo (hoy el esquema se aplica con db push)", "**Corregida (v2)**", "Sección 2.4"],
    ],
    [52, 16, 32]
  ),
  p("Dos correcciones de exactitud sobre la auditoría v1, detectadas en la re-verificación: (1) la v1 asumía un «render de perfil de rides reutilizable» — **no existe ningún componente de perfil altimétrico en la app** (recharts 2.15.4 está instalada pero sin uso), por lo que la ficha de ruta incluye ese componente como trabajo nuevo de la fase C; (2) la v1 mencionaba genéricamente «rate limiter existente» — existe y es correcto (rateLimit.ts, ventana deslizante en memoria con guard() y clientIp), pero solo se usa en autenticación y licencia; su aplicación a todo el contenido UGC queda especificada en la sección 7."),
];

const seccion2 = [
  h1("2. Modelo de datos corregido"),
  p("El modelo conserva la estructura aprobada (Route, RouteVersion, RoutePoi, RoutePhoto, RouteFavorite, RouteComment, RouteRating, RouteReport, User.role) y la corrige en cuatro frentes: separación de geometrías, columnas de consulta geográfica, atributos recreativos y vigencia, y las entidades nuevas de experiencia comunitaria y moderación. La tabla 2 muestra el modelo definitivo de Route; las siguientes describen las entidades nuevas o modificadas."),
  tableTitle("Tabla 2: Route — modelo definitivo (v2)"),
  dataTable(
    ["Grupo", "Campos", "Notas"],
    [
      ["Identidad", "id, ownerId, nombre, descripcion, modalidad", "Nombre ≤ 80; descripcion ≤ 2000"],
      ["Geometría pública", "polyline (comprimida), coordsPubVer, minLat/maxLat/minLon/maxLon, cell, centerLat/centerLon", "Solo geometría protegida; el original jamás sale del dispositivo (sección 3)"],
      ["Extremos aproximados", "inicioAproxLat/Lon, finAproxLat/Lon, proteccion: {recorteIniM, recorteFinM, snapInicio, snapFin}", "Redondeo a 3 decimales (~110 m); visible en ficha como zona, no como pin"],
      ["Elevación", "gainM?, lossM?, minEle?, maxEle?, eleFuente (gpx | servicio | null)", "Float? — null prohibido como 0; resuelta al publicar (sección 5.1)"],
      ["Dificultad", "dificultadFisica (1-5), dificultadTecnica (1-5), dificultadOrigen (auto | creador)", "La auto es sugerencia orientativa; el creador ajusta (sección 5.2)"],
      ["Recreativa", "attrs String[] (máx 3 del enumerado)", "escénica, familiar, recreativa, desafiante, principiantes, miradores, descanso"],
      ["Vigencia", "ultimaRevisionAt, estadoVigencia (derivado)", "Estados: vigente | avisos | sin-revisar | retirada (sección 7.4)"],
      ["Ciclo de vida", "status (borrador | publicado | oculta | retirada), timestamps, removedAt?", "Oculta = ocultamiento automático por reportes; retirada = despublicación"],
      ["Borrado", "soft-delete (removedAt) + purga diferida", "Primera convención de soft-delete general; precede a Incident.active"],
    ],
    [18, 46, 36]
  ),
  h2("2.1 Entidades nuevas o modificadas"),
  tableTitle("Tabla 3: Entidades del módulo (definitivo)"),
  dataTable(
    ["Tabla", "Campos clave / unicidad", "Propósito"],
    [
      ["RouteVersion", "routeId, v, geometrySnapshot (protegida), metaSnapshot, eleSnapshot?, publishedAt", "Historial; los rides y experiencias anclan a la versión"],
      ["RoutePoi", "routeId, orden, lat, lon, tipo, nombre, nota", "Puntos de interés sobre la geometría pública"],
      ["RoutePhoto", "routeId, url, orden, blobPathname, hash", "Fotos de ficha; blobPathname permite borrado físico"],
      ["RouteFavorite", "@@unique([userId, routeId])", "Guardar / favoritos (patrón Achievement)"],
      ["RouteComment", "routeId, userId, body, removedAt?", "Comentarios con borrado propio/moderador"],
      ["RouteRating", "@@unique([userId, routeId]), valor 1-5, updatedAt", "Una valoración editable por usuario"],
      ["RouteReport", "@@unique([routeId, reporterId, motivo]), motivo enum, estado, nota", "Denuncias tipificadas con dedup (sección 7)"],
      ["RouteExperience", "routeId, routeVersionId, userId, rideId?, fechaRealizacion, comentario, condiciones String[], observacion, removedAt?", "Experiencias comunitarias (sección 6)"],
      ["ExperiencePhoto", "experienceId, url, blobPathname", "Fotos de experiencia (máx 3)"],
      ["ModerationLog", "actorId, accion, targetType, targetId, motivo, nota, createdAt", "Historial inmutable de moderación y apelaciones"],
      ["User.role", "user | moderador | admin (default user)", "Autoriza /api/moderation; transición con adminKey"],
    ],
    [20, 46, 34]
  ),
  h2("2.2 Convenciones de integridad"),
  p("Toda unicidad de participación se resuelve en base de datos con @@unique compuestos, siguiendo el patrón ya usado por Friendship y Achievement (schema.prisma:222 y 232), no con contadores en el cliente. Todo contenido comunitario usa soft-delete con removedAt y borrado físico diferido de blobs asociados. Los rides referencian RouteVersion (id + v) — si la geometría cambia, los rides y experiencias antiguos siguen apuntando a su versión y sus datos permanecen idénticos."),
  h2("2.4 Migraciones formales"),
  p("El proyecto actual no mantiene carpeta de migraciones: el esquema se aplica con db push manual y un autorreparo puntual en runtime (ALTER TABLE ADD COLUMN IF NOT EXISTS en api/incidents/route.ts:26-39; vercel.json:3 ejecuta solo prisma generate). Para un módulo con nueve tablas nuevas y datos de usuarios, la fase A introduce **prisma migrate** (carpeta prisma/migrations versionada en git y prisma migrate deploy en el build de Vercel). Es el único cambio de proceso de despliegue de la arquitectura, y elimina la posibilidad de divergencia entre el esquema local y el de producción."),
];

const seccion3 = [
  h1("3. Privacidad geométrica"),
  p("Principio: la **geometría original vive solo en el dispositivo del propietario** (store c30.rutas-v2); el servidor recibe, al publicar, exclusivamente la **geometría pública protegida** derivada en el teléfono. Esto replica la decisión de privacidad vigente con las actividades (la pista GPS nunca sale del dispositivo) y hace innecesario cualquier borrado retrospectivo: el original sencillamente no existe en el servidor."),
  h2("3.1 Protección con continuidad garantizada"),
  p("La protección no deforma el recorrido. Se compone de dos operaciones sobre los extremos, ambas preservan la continuidad por construcción porque solo **recortan prefijo y sufijo** de la polilínea (el resultado sigue siendo una polilínea conexa, sin saltos ni desplazamientos):"),
  bullet("**Snap de extremos a vía pública** (ya inherente a las rutas del motor; para GPX e importadas, snap del primer y último vértice al nodo de vía más cercano del grafo, tolerancia 80 m)."),
  bullet("**Truncado de extremos**: se recorta desde cada extremo hasta el primer vértice que queda a más de D = 150 metros del extremo original, con tope de 400 m o el 10 % de la distancia (lo que ocurra primero). Si el tope se alcanza, la vista previa lo advierte y sugiere mover el extremo manualmente en el editor antes de publicar."),
  p("Quedan descartados por diseño el desplazamiento aleatorio y cualquier distorsión del tramo interior — el encargo exige no alterar artificialmente el recorrido. Los extremos publicados se representan como **zona aproximada** (círculo de 150 m) y sus coordenadas se almacenan redondeadas a 3 decimales (~110 m) en inicioAprox/finAprox, que son los datos que consumen búsqueda y ficha; el pin exacto del creador jamás se publica. La exportación GPX de una ruta pública entrega la geometría protegida; solo el propietario puede exportar el original de sus propias rutas."),
  h2("3.2 Vista previa de publicación"),
  p("La publicación exige pasar por una pantalla de **vista previa** (fase D): mapa con la geometría protegida y, como capa superpuesta opt-in, la original para que el creador compare; metros recortados en cada extremo; y la lista exacta de datos que salen del dispositivo (geometría protegida, metadatos, dificultad, atributos, fotos ya sin EXIF, POIs). La confirmación requiere marcar una casilla «revisé la protección aplicada». El payload del POST queda verificado en pruebas funcionales: sin coordenadas del original fuera de la geometría protegida y sin campos de extremo exactos."),
];

const seccion4 = [
  h1("4. Estrategia geográfica"),
  p("La búsqueda por área nunca decodifica polilíneas: las consultas corren sobre **columnas dedicadas calculadas al escribir**, y la polilínea comprimida es solo el formato de entrega para renderizar. El esquema de consulta es el siguiente."),
  h2("4.1 Esquema de consulta (MVP, sin extensiones)"),
  bullet("**bbox exacto** de la geometría pública en cuatro columnas reales (minLat, maxLat, minLon, maxLon), con predicado de intersección: minLat <= sur AND maxLat >= norte AND minLon <= oeste AND maxLon >= este."),
  bullet("**celda geohash-5** (≈ 4,9 × 4,9 km) de la posición central, indexada con b-tree: la consulta por viewport se reduce primero a las 1-12 celdas que cubren el área y luego afina con el bbox; con paginación por cursor (LIMIT 20) el conjunto escaneado es pequeño."),
  bullet("**centerLat/centerLon** para orden por cercanía (haversine en SQL) y filtros por distancia al punto de búsqueda; **distKm** indexado para los filtros de distancia del catálogo."),
  bullet("Índices: @@index([cell, distKm]) y @@index([status, createdAt]); el bbox se aplica como predicado de refinado sobre el resultado de celda."),
  h2("4.2 PostGIS: evaluación y ruta de migración"),
  tableTitle("Tabla 4: Comparación de la estrategia espacial"),
  dataTable(
    ["Criterio", "bbox + geohash (MVP)", "PostGIS + GIST"],
    [
      ["Dependencias", "Ninguna: columnas reales e índices b-tree estándar", "Extensión postgis en la base (Neon la soporta)"],
      ["Prisma", "Modelo declarado completo, sin tipos especiales", "Columna Unsupported(\"geometry\") + $queryRaw para espaciales"],
      ["Volumen cómodo", "Decenas de miles de rutas con catálogo paginado", "Millones; consultas espaciales arbitrarias"],
      ["Operaciones espaciales", "bbox, cercanía por centro, celdas", "ST_Intersects, ST_DWithin (nearest real), KNN"],
      ["Riesgo operativo", "Bajo; fácil de razonar y de depurar", "Mayor: extensiones, datos binarios, backfill"],
      ["Decisión", "**Se adopta en el MVP**", "Ruta de migración documentada, no requerida al inicio"],
    ],
    [22, 39, 39]
  ),
  p("Criterio de activación de PostGIS: superadas ~20 mil rutas publicadas, o necesidad de vecino más cercano real por geometría (no por centro). La migración es aditiva y sin downtime: se agrega la columna geometry(LineString, 4326), se puebla por lotes decodificando la polyline existente (ST_GeomFromGeoJSON), se crea el índice GIST y se sustituyen las consultas por raw queries equivalentes; el esquema de columnas del MVP se conserva durante la transición como respaldo. Con esto, la exigencia de no depender de polilíneas comprimidas para consultar queda cumplida en ambas etapas."),
];

const seccion5 = [
  h1("5. Elevación, dificultad y atributos recreativos"),
  h2("5.1 Elevación: null explícito, jamás cero"),
  p("Los campos gainM, lossM, minEle y maxEle son **Float?** y permanecen null cuando no hay información; el cero ficticio queda prohibido en esquema y en UI (la ficha muestra «—» con la etiqueta «sin datos de elevación»). El origen queda trazado en eleFuente: gpx (calculada al importar con las reglas existentes de parseGpxLine), servicio o null. Para las rutas trazadas con el motor — donde hoy el creador fija gainM = 0 (useCreadorTrazas.ts:96) — la resolución se traslada al **servidor en el momento de publicar**: el endpoint de publicación muestrea la geometría protegida contra un servicio de elevación (Open-Meteo Elevation, sin clave, ~100 puntos por ruta) y guarda los cuatro valores con eleFuente = servicio; si el servicio falla, la ruta se publica igual con null y el creador puede «recalcular elevación» desde la ficha (idempotente por RouteVersion). No se resuelve en el teléfono para no duplicar dependencias ni costos por dispositivo."),
  h2("5.2 Dificultad física y técnica, con revisión del creador"),
  p("Dos escalas independientes de 1 a 5 (muy fácil, fácil, media, difícil, muy difícil). La **clasificación automática es orientativa y editable siempre**: dificultadFisica se sugiere desde datos objetivos (distKm, gainM cuando exista, pendiente media) y dificultadTecnica desde superficie y atributos del entorno; el campo dificultadOrigen registra si el valor vigente es auto o del creador. Cuando gainM es null, la sugerencia física se calcula solo con distancia y la UI la presenta como «sugerencia preliminar — revisa y ajusta», cumpliendo la exigencia de que el creador revise y ajuste la clasificación. Las sugerencias se recalculan al editar geometría o metadatos, pero **nunca sobrescriben** un valor ajustado por el creador."),
  h2("5.3 Atributos recreativos"),
  p("Enumerado cerrado de siete valores — escénica, familiar, recreativa, desafiante, para principiantes, con miradores, con zonas de descanso — que el creador marca (máximo tres) y la ficha presenta como chips informativos con la leyenda «atributos orientativos definidos por el creador». La plataforma no los verifica automáticamente ni los convierte en ranking: **no existe clasificación competitiva por velocidad en rutas** — el rendimiento por tramos sigue viviendo en los segmentos personales. El catálogo ordena por relevancia, fecha y valoración de experiencia (comodidad), nunca por tiempo; el «tiempo estimado orientativo» de la ficha se muestra como rango (±25 %) calculado con el modelo de velocidad por pendiente ya presente en rideMetrics, y la etiqueta «completada» es binaria, sin tiempo objetivo ni fantasma de ruta."),
];

// ---------- Contenido: secciones 6 a 11 ----------
const seccion6 = [
  h1("6. Experiencias comunitarias"),
  p("La experiencia comunitaria (RouteExperience, tabla 3) asocia vivencias reales a una ruta sin tocar jamás su geometría oficial: fotografías (hasta 3), comentario, observaciones (≤ 500 caracteres), condiciones del recorrido como etiquetas tipificadas (camino en buen estado, tramo cerrado, barro, mucho tráfico, sombra, agua disponible — hasta 3) y **fecha de realización** (la del ride asociado o la que el usuario elija). Cada experiencia ancla a una RouteVersion concreta, de modo que si la ruta se edita después, la experiencia sigue describiendo con fidelidad la versión que se recorrió."),
  p("Reglas de separación y moderación: las experiencias viven en tablas propias, se muestran en la ficha bajo una sección «Experiencias» con etiqueta de contenido comunitario (distinta de los datos oficiales), y ninguna operación de experiencia puede escribir en Route. Un usuario registra una experiencia por ruta y día (unicidad por [userId, routeId, fecha]); puede borrar la suya (soft-delete) y el moderador puede ocultarla. El flujo natural nace en la fase F: al terminar un ride ligado a una ruta, la app ofrece «agregar experiencia», rellenando rideId y fecha automáticamente; también se puede escribir desde la ficha sin ride. **La pista GPS del ride nunca acompaña a la experiencia** — solo salen del dispositivo los textos, fotos y metadatos que el usuario ve en la confirmación."),
];

const seccion7 = [
  h1("7. Moderación, apelaciones y vigencia"),
  h2("7.1 Reportes tipificados y contra-abuso"),
  p("Los motivos quedan tipificados como enumerado: **cierre, peligro, error geográfico, spam y contenido inapropiado**. Contra el abuso se combinan cuatro controles: deduplicación por [routeId, reporterId, motivo] (única denuncia por usuario y motivo); rate limit con el guard() existente (10 reportes/día por usuario, rateLimit.ts:50); el autor no puede denunciar su propia ruta (patrón ya vigente en incidents, api/incidents/route.ts:178-180); y un score de abuso simple por reportante — las denuncias descartadas elevan el score y sus siguientes reportes necesitan más denunciantes distintos para ocultar automáticamente el contenido."),
  h2("7.2 Flujo de revisión, sin mutación automática de geometría"),
  p("El estado del reporte transita abierta → bajo revisión → confirmada | descartada, y el contenido reportado solo se **oculta automáticamente** (status oculta) cuando el motivo es cierre o peligro con dos o más reportantes distintos; los demás motivos pasan siempre por la cola de moderación. Ni el reporte ni el ocultamiento modifican jamás la geometría ni los datos oficiales de la ruta: solo afectan visibilidad y estado informativo. La moderación registra cada acción en ModerationLog (actor, acción, objetivo, motivo, nota, fecha) como historial inmutable, con roles User.role (moderador) autorizando /api/moderation y la transición inicial protegida con la clave admin timing-safe existente (adminKey.ts:10, comparación por hash SHA-256 y timingSafeEqual)."),
  h2("7.3 Apelaciones"),
  p("El autor de una ruta oculta o moderada puede presentar **una apelación activa por ruta** (nota ≤ 500 caracteres, estado apelada). El moderador resuelve restaurar o confirmar la medida, y ambos desenlaces quedan en ModerationLog. Si el moderador confirma la retirada, la ruta pasa a status retirada con posibilidad de edición y republicación posterior por el autor cuando corrija el motivo; un historial de apelaciones rechazadas repetidas activa revisión de cuenta por el propietario del producto."),
  h2("7.4 Control de vigencia"),
  p("Cada ruta pública lleva **ultimaRevisionAt** y un estado informativo derivado que la ficha muestra como banner: vigente (revisada hace menos de 6 meses), avisos activos (reportes de cierre o peligro confirmados o abiertos, con su número), sin revisar (más de 6 meses desde la última revisión o publicación) y retirada. La revisión es una acción del creador («revisé esta ruta hoy», que actualiza ultimaRevisionAt y limpia avisos confirmados resueltos) o del moderador. El patrón reutiliza la experiencia de vigencia de avisos operativos (desde/hasta en public/avisos.json y avisoVigente en avisos.ts:53) y la caducidad por antigüedad de incidents (30 días), pero **los reportes nunca cambian la geometría**: un cierre confirmado queda como aviso informativo con fecha hasta que el creador o el moderador lo resuelvan."),
];

const seccion8 = [
  h1("8. Pipeline de fotografías"),
  p("Cumbre30 no sube imágenes hoy (la credencial Parquemet se procesa y queda en localStorage), pero el re-encode en canvas ya existe como precedente directo: processQrImage en Wallet.tsx:55-83 re-encodea a máx 1024 px con JPEG 0.92. El pipeline de fotos del módulo lo generaliza con seguridad completa:"),
  bullet("**Cliente (antes de salir del dispositivo):** acepta JPEG/PNG/WebP verificando magic bytes; rechaza > 8 MB; re-encodea en canvas al lado largo máximo de 1600 px con JPEG calidad 0,85. El re-encode **elimina EXIF por construcción** (coordenadas, fecha, dispositivo no viajan), y el objetivo de peso queda ≤ 1,5 MB por foto."),
  bullet("**Transporte y storage:** POST multipart a /api/upload con sesión; el servidor almacena en **Vercel Blob** (el despliegue ya es Vercel + Neon, vercel.json con región gru1) mediante token server-side; URL pública no adivinable y blobPathname registrado para borrado físico. Alternativa documentada: cualquier storage S3-compatible sin cambiar el diseño."),
  bullet("**Servidor (validación de entrada):** re-verifica magic bytes y tamaño, rechaza según lista de tipos permitidos, genera nombre aleatorio (sin nombre de archivo del usuario), limita 6 fotos por ruta y 3 por experiencia, y deduplica por hash opcional."),
  bullet("**Ciclo de vida y borrado:** al eliminar una foto o el contenido que la contiene (soft-delete y purga), se ejecuta del() del blob correspondiente; job de purga para huérfanos semanales. La eliminación es trazable en ModerationLog cuando la realiza un moderador."),
  bullet("**Moderación:** las fotos son reportables (motivo contenido inapropiado), con ocultamiento automático por umbral de reportantes distintos y eliminación directa por moderador; el uploader queda identificado por sesión para abuso repetido."),
];

const seccion9 = [
  h1("9. Seguridad y privacidad consolidada"),
  tableTitle("Tabla 5: Matriz de datos — qué sale del dispositivo y qué nunca sale"),
  dataTable(
    ["Dato", "Sale del dispositivo", "Condición"],
    [
      ["Pista GPS cruda de actividades", "**Nunca** (política vigente)", "Los rides siguen subiendo solo agregados con dedupe por clientId"],
      ["Geometría original de una ruta propia", "**Nunca**", "Solo la geometría protegida al publicar (sección 3)"],
      ["Extremos exactos (puerta de casa)", "**Nunca**", "Publicados como zona aproximada redondeada a ~110 m"],
      ["Geometría protegida + metadatos", "Solo al publicar", "Vista previa con checklist de revisión obligatoria"],
      ["Fotografías", "Solo tras re-encode local", "Sin EXIF, ≤ 1,5 MB, formatos validados en cliente y servidor"],
      ["Experiencias (texto + fotos + fecha)", "Solo con confirmación explícita", "Nunca incluyen pista GPS; anclan a RouteVersion"],
      ["Export GPX de ruta pública", "Geometría protegida", "El original solo lo exporta su propietario desde su dispositivo"],
    ],
    [30, 26, 44]
  ),
  p("Los controles transversales se heredan y completan: sesiones Bearer/cookie con CORS de Capacitor (apiCors.ts) y backendOrigin() horneado a cumbregeo.cl (backend.ts:51, fijado en scripts/export-web.sh:21); rate limit en todos los endpoints de escritura del módulo (guard() ya probado en auth); autorización por propiedad en cada PATCH/DELETE y por rol en moderación; atribución OSM/ODbL y nota de carácter orientativo sin valor de autorización legal ya presentes en la app; y versionado RouteVersion como base de auditoría de cualquier cambio publicado. El APK sin /api consume por URL absoluta y encola en el outbox ampliado (rutas, favoritos, comentarios, experiencias), con servidor-autoridad y last-write-wins por updatedAt."),
];

const seccion10 = [
  h1("10. Plan A-F ajustado con criterios de aceptación"),
  p("El plan conserva las seis fases aprobadas y las ajusta con las correcciones v2. Cada fase entrega código, compilación verificada (tsc y build web), pruebas funcionales in-vivo, evidencia visual, problemas detectados y documentación técnica; los **criterios de aceptación** son la condición objetiva para cerrar la fase."),
  tableTitle("Tabla 6: Alcance ajustado por fase"),
  dataTable(
    ["Fase", "Alcance v2 (ajustes en negrita)"],
    [
      ["A. Modelo de datos y migración", "Tablas del modelo definitivo (tabla 2-3); User.role; store c30.rutas-v2; migración por lectura desde c30.trazas; API /api/routes básica; outbox ampliado. **+ prisma migrate formal con migrate deploy en el build**"],
      ["B. Creación y edición", "Multi-waypoint, POIs, metadatos, borrador; edición post-guardado; export GPX; crear desde actividad. **+ atributos recreativos, dificultad física/técnica con sugerencia editable, elevación null explícita en el editor**"],
      ["C. Biblioteca y fichas", "Cuatro secciones; Mis rutas; ficha completa con acciones. **+ componente de perfil altimétrico nuevo (recharts, ya instalado y sin uso), chips recreativos, banner de vigencia, tiempo estimado en rango**"],
      ["D. Publicación y descubrimiento", "Publicación explícita; RouteVersion; catálogo con búsqueda y filtros; enlaces públicos. **+ pipeline de protección de extremos con vista previa obligatoria; columnas bbox/celda y consultas por viewport; resolución de elevación al publicar**"],
      ["E. Comunidad y moderación", "Favoritos, comentarios, valoraciones, reportes; cola con rol; fotos. **+ motivos tipificados, dedup y control de abuso, ModerationLog, apelaciones, pipeline de fotografías (EXIF/borrado físico), experiencias comunitarias**"],
      ["F. Integración GPS y navegación", "Preset de línea guardada; proyector con estado; eventos persistidos; routeRef + cumplimiento; Mis recorridos. **+ alta de experiencia al terminar ride ligado (con rideId y fecha)**"],
    ],
    [24, 76]
  ),
  h2("10.1 Criterios de aceptación por fase"),
  bullet("**Fase A:** prisma migrate deploy aplicado en un despliegue real sin pérdida de datos; migración por lectura reproduce los trazados existentes (id, kind, coords) sin convertir segmentos; compilación tsc 0 y build SUCCESS; smoke test del servidor con la API /api/routes autenticando y rechazando escritura sin sesión; APK export estático compila sin /api."),
  bullet("**Fase B:** crear ruta con waypoints, atributos y dificultad ajustable desde cero en APK y web; edición post-guardado persiste y se refleja en el mapa; export GPX abre en terceros; elevación queda null visible como «sin datos» cuando no hay fuente — jamás 0."),
  bullet("**Fase C:** las cuatro secciones navegables con identidad verde en tema claro y oscuro; ficha con perfil altimétrico renderizando solo cuando hay elevación; banner de vigencia correcto en sus tres estados básicos; regresión del creador y del panel Mis trazados sin cambios de conducta."),
  bullet("**Fase D:** la publicación nunca envía la geometría original (verificado en payload y en base de datos); extremos publicados en zona aproximada; vista previa muestra recortes y exige confirmación; búsqueda por viewport devuelve resultados correctos con celdas + bbox (caso de prueba con dos rutas en celdas distintas); elevación resuelta al publicar con eleFuente = servicio."),
  bullet("**Fase E:** denuncia única por usuario y motivo (violación de @@unique rechazada); ocultamiento automático solo con dos reportantes distintos en motivos cierre/peligro; ModerationLog registra cada acción; apelación restaura o retira con historial; foto publicada sin EXIF (verificado extrayendo metadatos del archivo almacenado) y borrada físicamente del blob al eliminar el contenido."),
  bullet("**Fase F:** ride ligado a ruta registra progreso, desvío máximo y reincorporaciones sin tocar useRideEngine; pausas y mala señal no generan desvíos falsos (prueba con simulador); «completada» correcta por geocerca de meta con histéresis; Mis recorridos agrupa por ruta con su versión; experiencia post-ride ancla a la versión recorrida."),
];

const seccion11 = [
  h1("11. Dependencias, riesgos y correcciones respecto de la v1"),
  tableTitle("Tabla 7: Dependencias externas e internas"),
  dataTable(
    ["Dependencia", "Uso", "Estado"],
    [
      ["Vercel Blob", "Fotos de rutas y experiencias (fase E)", "Nueva; activar storage y token BLOB en Vercel"],
      ["Open-Meteo Elevation", "Elevación al publicar (fase D)", "Nueva; API pública sin clave, con degradación a null y reintento"],
      ["recharts (instalada)", "Perfil altimétrico de la ficha (fase C)", "Ya en package.json sin uso; no añade dependencias"],
      ["prisma migrate", "Esquema versionado (fase A)", "Nueva; sustituye el db push manual"],
      ["geohash (implementación propia ≤ 40 líneas)", "Celdas de búsqueda (fase D)", "Nueva, sin paquete externo"],
    ],
    [30, 40, 30]
  ),
  tableTitle("Tabla 8: Riesgos nuevos o ajustados"),
  dataTable(
    ["Riesgo", "Impacto", "Mitigación"],
    [
      ["Truncado insuficiente para privacidad de extremos", "Exposición parcial de domicilios en rutas importadas", "Vista previa obligatoria con comparación y tope de recorte con aviso antes de publicar"],
      ["Servicio de elevación caído o lento", "Publicación degradada", "Publicación no bloqueante con null + recalcular desde la ficha; timeout y caché por RouteVersion"],
      ["Abuso del sistema de reportes", "Ocultamientos injustos", "Dedup por usuario y motivo, umbral por reportantes distintos, score de abuso, apelación con historial"],
      ["Fotos indebidas (UGC)", "Cumplimiento Play Store / privacidad", "Pipeline con EXIF eliminado, validación doble, moderación con ocultamiento por umbral y borrado físico"],
      ["Crecimiento del catálogo", "Consultas lentas", "Paginación por cursor + celdas; PostGIS como ruta documentada si se supera ~20 mil rutas"],
      ["Doble geometría (privada/pública) confunde al creador", "Publicaciones con datos no deseados", "Vista previa comparativa; etiquetas «tu copia» vs «copia pública» en Mis rutas"],
      ["Regresión del funcionamiento vigente", "Rides o trazados dañados", "Fases aditivas con release separado; c30.trazas intocado como respaldo; pruebas de regresión por fase (criterios de aceptación)"],
    ],
    [28, 26, 46]
  ),
  p("Con la aprobación de esta arquitectura corregida, la **fase A** se inicia de inmediato sobre la v1.14.3 publicada, con entrega de compilación y pruebas funcionales verificables antes de continuar a la fase B. El motor GPS, el motor de trazado y el funcionamiento vigente de la aplicación permanecen intactos durante toda la implementación."),
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
    children: [new TextRun({ text: "Cumbre30 · Rutas y Comunidad Ciclista — Arquitectura corregida (v2)", size: 18, color: GRAY, font: FONT })],
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
        subtitle: "Rutas y Comunidad Ciclista · Validación y ajustes sobre la auditoría técnica (v2)",
        englishLabel: "CUMBRE30",
        metaLines: [
          "Producto: Cumbre30 · web cumbregeo.cl + APK Android (Vercel + Neon)",
          "Base auditada: v1.14.3 · code 74 — complementa la auditoría del 21-11-2026",
          "Documento: Fase 0 · v2 — decisiones definitivas y plan A-F ajustado",
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
        ...seccion6, ...seccion7, ...seccion8, ...seccion9, ...seccion10, ...seccion11,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/Arquitectura_corregida_rutas_comunidad_Cumbre30.docx";
  fs.writeFileSync(out, buf);
  console.log("OK", out, buf.length, "bytes");
});
