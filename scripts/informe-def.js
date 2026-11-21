// ============================================================
// Informe de entrega — Fases D, E y F del módulo Rutas y Comunidad
// (Cumbre30). docx-js con receta de portada R1 (design-system),
// TOC con placeholders y numeración en 3 secciones.
// Ejecutar: node scripts/informe-def.js
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Footer, PageNumber, NumberFormat, SectionType,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableLayoutType, TableOfContents, BorderStyleNone,
} = require("docx");
const fs = require("fs");

// ---------- paleta (Dawn Mist Tech, informe técnico) ----------
const P = {
  primary: "0A1628", body: "000000", secondary: "5A6B7D",
  accent: "5B8DB8", surface: "F1F5F9",
  cover: {
    bg: "0A1628", titleColor: "FFFFFF", subtitleColor: "B9C6D8",
    metaColor: "D5DEE9", accent: "5B8DB8", footerColor: "8FA1B5",
  },
};

const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};
const allNoBorders = {
  ...noBorders,
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
};

// ---------- helpers de portada (design-system, autoritativo) ----------
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
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
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ---------- Receta R1: portada de párrafos (alineada a la izquierda) ----------
function buildCoverR1(config) {
  const PC = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PC.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PC.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: PC.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: PC.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: PC.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: PC.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PC.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: PC.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: PC.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: PC.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ---------- helpers de cuerpo ----------
const FONT_H = { ascii: "Arial", eastAsia: "SimHei" };
const FONT_B = { ascii: "Times New Roman", eastAsia: "SimSun" };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: FONT_H })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: FONT_H })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT_B, ...opts })],
  });
}
function pRuns(runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: runs.map((r) => new TextRun({ size: 24, color: P.body, font: FONT_B, ...r })),
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT_B })],
  });
}
let tablaN = 0;
function captionTabla(texto) {
  tablaN++;
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text: `Tabla ${tablaN}: ${texto}`, bold: true, size: 21, color: P.secondary, font: FONT_H })],
  });
}
function tabla(headers, rows, widths) {
  const cell = (text, isHeader, w) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: P.surface } : undefined,
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 312 },
      children: [new TextRun({ text, bold: isHeader, size: 21, color: isHeader ? P.primary : P.body, font: isHeader ? FONT_H : FONT_B })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D0DAE4" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => cell(t, true, widths[i])) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, false, widths[i])) })),
    ],
  });
}

// ---------- contenido del cuerpo ----------
const cuerpo = [];

// 1 · Resumen ejecutivo
cuerpo.push(h1("1. Resumen ejecutivo"));
cuerpo.push(p("Este informe entrega las fases D, E y F del módulo «Rutas y Comunidad» de Cumbre30, cerrando la implementación completa del módulo planificado en seis fases incrementales (A–F) sobre la arquitectura v2.1. La fase D implementó la publicación con protección geométrica por niveles y el catálogo público con consulta geográfica corregida; la fase E implementó la comunidad (favoritos, valoraciones, comentarios, experiencias y reportes) con un umbral ponderado de confianza para el ocultamiento automático y moderación por roles; la fase F cerró el ciclo de uso real con el proyector «Navegar», la referencia ruta–ride (routeRef), la experiencia post-ride y el marcado binario de rutas completadas."));
cuerpo.push(p("Las tres fases se entregaron verificadas: una suite nueva por fase ejecutada contra una base PostgreSQL real (postgres embebido local), las regresiones completas de las fases anteriores, compilación con cero errores de tipos en el código fuente, build web exitoso y ensayos in-vivo en Chromium con cero errores de consola. Los commits de referencia son 326737b (fase D), b390b56 (fase E) y 596b115 + cb88ce0 (fase F, incluido el hallazgo del ensayo corregido)."));
cuerpo.push(p("El release v1.17.0 (versionCode 77) se publicó con el tag correspondiente y el push de la rama main fue exitoso; al cerrar este informe, la acción «Build APK Cumbre30» estaba compilando el APK oficial del tag v1.17.0 para GitHub Releases. Las garantías transversales se mantienen: la geometría original de las rutas nunca sale del dispositivo, las experiencias comunitarias jamás llevan pista GPS, el historial de rides del servidor no cambió de modelo y las tablas de trazados locales (c30.trazas) quedaron intactas."));

// 2 · Alcance y método
cuerpo.push(h1("2. Alcance, base de diseño y método de verificación"));
cuerpo.push(p("El informe cubre exclusivamente lo implementado en las fases D, E y F del módulo Rutas y Comunidad entre el 21 de noviembre de 2026 (comienza la fase D tras el release v1.15.0) y el cierre del release v1.17.0. La base de diseño es la arquitectura v2.1 del módulo, con sus reglas de privacidad (§3: solo geometría protegida sale del dispositivo), de contenido comunitario (§6: sin pistas GPS, un mínimo de metadatos elegidos) y de moderación (§7: umbrales ponderados, trazabilidad y roles). Las fases A (modelo de datos y migraciones) y B (creación y edición) ya habían sido entregadas en los releases v1.15.0 y v1.16.0; la fase C (biblioteca y fichas) en el commit e89bcf1 con su propio informe."));
cuerpo.push(p("La verificación combinó cuatro capas. Primero, suites automatizadas en Node que ejercitan la lógica pura y los handlers de API contra una base PostgreSQL real local (postgres embebido en el puerto 5433), incluida la verificación de umbrales con pesos calculados. Segundo, regresiones completas de todas las suites anteriores del módulo en cada fase. Tercero, controles estáticos: TypeScript sin errores en src, ESLint sin errores en archivos nuevos y build de producción web exitoso en cada fase. Cuarto, ensayos in-vivo en Chromium contra el servidor de desarrollo local con sesión sembrada y geolocalización simulada, colectando errores de consola y verificando el estado persistido en el dispositivo y en la base."));
cuerpo.push(p("Quedan fuera del alcance de este informe el APK firmado oficial (lo construye la acción de GitHub al recibir el tag y se publica en Releases) y el rendimiento contra el motor OSRM en producción (la lógica de trazado multi-waypoint está cubierta por suite; el ensayo del motor de red requiere el despliegue con red viva)."));

// 3 · Fase D
cuerpo.push(h1("3. Fase D — Publicación y descubrimiento (commit 326737b)"));
cuerpo.push(h2("3.1 Protección geométrica por niveles"));
cuerpo.push(p("La biblioteca nueva src/lib/proteccionRuta.ts clasifica cada extremo de la ruta y aplica el recorte correspondiente antes de que la geometría salga del dispositivo. El nivel A corresponde a extremos cuya deriva respecto a un nodo conocido del grafo es menor o igual a 30 metros (se ajusta con snap); el nivel B abarca derivas de 30 a 80 metros sin snap (la regla de 80 metros de la arquitectura v2 quedó retirada) y el nivel C marca extremos sin conexión al grafo, que se entregan sin snap (sinSnap). Sobre ambos extremos se aplica un truncado común: se elimina el primer vértice que queda a más de 150 metros del extremo, con tope de 400 metros o del 10 % de la distancia total, lo que ocurra primero. El recorte solo opera como prefijo y sufijo, de modo que la polilínea sigue conexa por construcción y el interior de la ruta queda intacto (criterio CT-P5). Cuando el tope se excede, la vista previa advierte y exige una segunda confirmación (CT-P6); los extremos aproximados se publican con precisión de tres decimales (aprox3, unos 110 metros), de forma que el extremo exacto jamás sale del dispositivo."));
cuerpo.push(p("La vista previa de publicación (§3.2 de la arquitectura) es obligatoria: componente propio con mapa independiente, comparación opcional contra el original, lista explícita de los datos que salen y de los que nunca salen, y casilla obligatoria «revisé la protección aplicada». El payload enviado al servidor contiene únicamente la geometría protegida; el original jamás sale (criterios CT-P1 y CT-P4). Si no hay red, la publicación queda encolada en el outbox y reintenta al reconectar."));
cuerpo.push(h2("3.2 Catálogo público con consulta geográfica corregida"));
cuerpo.push(p("El endpoint GET /api/routes/catalog implementa el predicado de bounding box inclusivo en los bordes (CT-G4), la ramificación antimeridiana con OR longitudinal (CT-G6) y la búsqueda por celdas con índice GIN (cells hasSome), de modo que una ruta multi-celda que cruza el viewport aparece aunque su centro caiga fuera (CT-G2). Incluye filtros por texto, modalidad y dificultad, paginación por cursor estable (CT-G7) y documenta el falso positivo aceptado del bounding box (CT-G5). La prueba de rendimiento CT-G8 con diez mil rutas sintéticas midió un percentil 95 de 7,9 milisegundos, muy por debajo del tope de 150 milisegundos."));
cuerpo.push(h2("3.3 Elevación al publicar y ficha pública"));
cuerpo.push(p("El servidor resuelve la elevación al momento de publicar: muestrea la geometría protegida contra Open-Meteo (aproximadamente 100 puntos, src/lib/elevacionServicio.ts) y la guarda con fuente «servicio». Si el servicio falla, publica con elevación nula — nunca con ceros (§5.1). El creador puede recalcular la elevación después (POST /api/routes/[id]/elevacion, idempotente por versión y sin crear versiones nuevas). El cliente incorporó el tab Catálogo vivo en la biblioteca, con búsqueda por viewport, ficha pública con creador, versión, vigencia, chips y POIs, y las acciones «Ver en el mapa» (capa protegida más zonas de extremo), «Cómo llegar» (destino = inicio aproximado) y descarga del GPX protegido con la nota CT-P4."));
cuerpo.push(p("Verificación de la fase D: suites proteccion-ruta (9 comprobaciones, criterios CT-P1 a CT-P6) y catalogo-geo (9 comprobaciones CT-G1 a CT-G8 contra PostgreSQL real), regresiones completas (rutas-ficha 22, rutas-editor 33, rutas-store 8, route-geo 11, api-routes 11), TypeScript sin errores en src, build web exitoso y ensayo in-vivo sin errores de consola: publicación de un borrador GPX de 4 puntos con recorte de 454 metros de nivel C, aviso de tope excedido con doble casilla, aparición en el catálogo por viewport y descarga del GPX protegido con extremos distintos del original."));

// 4 · Fase E
cuerpo.push(h1("4. Fase E — Comunidad y moderación (commit b390b56)"));
cuerpo.push(h2("4.1 Interacción comunitaria"));
cuerpo.push(p("La fase E añadió los endpoints de interacción sobre las rutas públicas, todos con sesión obligatoria, límite de tasa y validación en el servidor. Los favoritos son un toggle idempotente con unicidad por usuario y ruta; las valoraciones van de 1 a 5 con upsert y promedio (una medida de comodidad, jamás un ranking); los comentarios admiten hasta 1000 caracteres con borrado propio en dos fases (soft-delete) y error 403 si se intenta borrar un comentario ajeno; los reportes usan motivos cerrados (§7.1), impiden denunciar al autor, limitan a diez por día y deduplican por ruta, reportante y motivo; las experiencias (§6) exigen fecha de realización, aceptan hasta tres condiciones tipificadas de un enumerado cerrado, comentario de hasta 2000 caracteres y observación de hasta 500, con unicidad por usuario, ruta y fecha, ancladas a la versión vigente (RouteVersion) y sin escribir jamás en la ruta ni llevar GPS."));
cuerpo.push(captionTabla("Endpoints comunitarios de la fase E y sus reglas"));
cuerpo.push(tabla(
  ["Endpoint", "Regla principal", "Dato sensible"],
  [
    ["POST /api/routes/[id]/favorite", "Toggle idempotente (@@unique por usuario y ruta)", "Ninguno"],
    ["POST /api/routes/[id]/rating", "Valor 1–5 con upsert; respuesta con promedio y votos", "Ninguno"],
    ["POST /api/routes/[id]/comments", "≤1000 caracteres; soft-delete propio; 403 ajeno", "Ninguno"],
    ["POST /api/routes/[id]/report", "Motivos cerrados §7.1; 10/día; dedupe [ruta, reportante, motivo]", "Ninguno"],
    ["POST /api/routes/[id]/experience", "Fecha obligatoria; ≤3 condiciones; unicidad [usuario, ruta, fecha]", "Jamás pista GPS"],
    ["GET /api/routes/favorites", "Lista propia de favoritas", "Solo propios"],
    ["GET/POST /api/moderation", "Cola y acciones; rol moderador/admin; 403 honesto", "Pesos y umbral en log"],
  ],
  [30, 45, 25]
));
cuerpo.push(h2("4.2 Umbral ponderado de confianza y lote sospechoso"));
cuerpo.push(p("El ocultamiento automático (§7.2) solo procede para reportes de cierre o peligro y exige dos condiciones simultáneas: la suma de los pesos de reportantes distintos alcanza al menos 2,0 y participan al menos dos reportantes. El peso del reportante es veterano (1,5) cuando la cuenta tiene 90 días o más y al menos tres contribuciones confirmadas o veinte rides; regular (1,0) en el caso intermedio; y nueva (0,5) cuando la cuenta tiene menos de 30 días o no tiene contribuciones confirmadas. Cada reporte descartado aplica un decaimiento de 0,25 al peso del reportante, con piso de 0,25 para que nadie quede sin voz. El reporte se crea antes de evaluar el umbral, de modo que su propio peso entra en la suma. El patrón de lote sospechoso (tres o más reportes del mismo motivo en menos de una hora desde cuentas creadas la misma semana) marca todo el lote como sospechoso, desactiva el ocultamiento automático y lo envía a la cola de moderación; cada decisión queda registrada en ModerationLog con los pesos y el umbral aplicados, como base trazable de la decisión (§7.3)."));
cuerpo.push(h2("4.3 Moderación por roles y cliente de comunidad"));
cuerpo.push(p("La cola de moderación (GET /api/moderation) reúne rutas ocultas automáticamente, lotes sospechosos y el historial reciente; las acciones (bajo revisión, confirmada, descartada, restaurar, retirar) exigen rol de moderador o administrador y devuelven 403 honesto para el resto. En el cliente, la ficha pública incorporó el tab de comunidad (favorito con contador, estrellas, comentarios con borrado propio, experiencias con chips de condiciones y fecha, y reporte con selector de motivo y mensajes honestos de ocultada, cola o éxito); el tab Favoritas pasó a listar las favoritas del servidor; y el tab de Moderación solo aparece para los roles, con un probe silencioso al abrir. Verificación: suite comunidad con 9 comprobaciones contra PostgreSQL real, incluido el caso límite del umbral justo (1,5 + 0,5 = 2,0) y el lote sospechoso que no oculta; TypeScript sin errores en src, ESLint sin errores y build web exitoso."));

// 5 · Fase F
cuerpo.push(h1("5. Fase F — Navegar y comunidad vivida (commits 596b115 y cb88ce0)"));
cuerpo.push(h2("5.1 Proyector «Navegar» sobre el mapa"));
cuerpo.push(p("La fase F cerró el ciclo de uso real del módulo. La acción «Navegar» existe ahora en las fichas privadas y en las públicas: en la ficha privada proyecta la copia local completa de la ruta (línea índigo punteada con extremos marcados, chip superior con nombre y origen «tu copia») y en la ficha pública proyecta la geometría protegida decodificada del servidor (chip con la nota «geometría protegida»). El proyector es un estado del dispositivo con store propio (clave c30.ruta-proyectada, snapshot estable para useSyncExternalStore) que persiste entre recargas para sobrevivir a los reinicios del APK; valida estrictamente los datos almacenados y ante un registro corrupto u operable vuelve a un estado vacío honesto. El mapa se encuadra al proyectar pero no persigue al ciclista, la misma regla del resto de la aplicación."));
cuerpo.push(h2("5.2 routeRef: el ride queda vinculado a la ruta"));
cuerpo.push(p("Al cerrar un ride con una ruta proyectada, el resumen local del ride guarda la referencia routeRef con los identificadores, el nombre y el origen — jamás geometría. La referencia vive en el historial local del dispositivo: el payload que sube al servidor se construye con una lista blanca de campos que no incluye routeRef, por lo que el modelo Ride del servidor no cambió (verificado por suite contra la base real: el ride con routeRef extra se guarda normal y el modelo no tiene esa columna). La pantalla de ride muestra un recordatorio discreto «Siguiendo la ruta» mientras la proyección está activa."));
cuerpo.push(h2("5.3 Experiencia post-ride"));
cuerpo.push(p("Tras cerrar un ride GPS con ruta vinculada, un diálogo ofrece registrar la experiencia comunitaria con la fecha del ride prellenada, el mismo enumerado cerrado de condiciones (máximo tres), comentario opcional de hasta 2000 caracteres y el identificador del ride anclado en RouteExperience.rideId. El diálogo advierte que la experiencia nunca lleva la pista GPS; si la ruta no está publicada en el servidor, muestra el aviso honesto de que la experiencia comunitaria solo existe para rutas publicadas y el ride queda vinculado igual en el dispositivo. Los rides de demostración (simulación) no marcan ni preguntan. La unicidad por usuario, ruta y fecha la resuelve el servidor (respuesta yaRegistrada para el mismo día)."));
cuerpo.push(h2("5.4 Completada binaria y hallazgo del ensayo"));
cuerpo.push(p("Al abrirse el diálogo post-ride, la copia local de la ruta se marca como completada (RutaV2.completada con la fecha de la primera vez en completadaAt): una bandera sí/no, sin conteos ni ranking. La resolución funciona por identificador local y, cuando la navegación vino del catálogo, por serverId sobre la copia local publicada; es idempotente y conserva la primera fecha. La ficha muestra el distintivo «Completada» con su fecha."));
cuerpo.push(p("El ensayo in-vivo registró un pageerror de hidratación en las cargas con ?gps=1: la fuente Demo/GPS se leía en el inicializador del estado y el servidor renderizaba «Fuente: Demo» mientras el cliente pintaba «Fuente: GPS real». La corrección (commit cb88ce0) resuelve la fuente después del montaje con un efecto, eliminando el mismatch. El mismo ensayo dejó dos observaciones por diseño (no son defectos): un borrador sin serverId muestra el aviso honesto sin botón de envío, y los saltos de la geolocalización simulada disparan la sospecha de vehículo, que se resuelve con el diálogo «¿Fuiste en bici?» existente."));

// 6 · Verificación global
cuerpo.push(h1("6. Verificación global de las tres fases"));
cuerpo.push(p("La tabla 2 resume las suites ejecutadas al cierre de la fase F, todas en verde. Las suites de lógica pura corren en Node; las de API y umbrales corren contra la base PostgreSQL real local (puerto 5433). El total de comprobaciones automatizadas del módulo Rutas y Comunidad al cierre es de 126 entre aserciones y grupos verificados."));
cuerpo.push(captionTabla("Suites del módulo al cierre de la fase F"));
cuerpo.push(tabla(
  ["Suite", "Comprobaciones", "Fase de origen", "Base"],
  [
    ["tests/proteccion-ruta.test.ts", "9 OK", "D", "Node"],
    ["tests/catalogo-geo.test.ts", "9 OK", "D", "PostgreSQL real"],
    ["tests/comunidad.test.ts", "9 OK", "E", "PostgreSQL real"],
    ["tests/fase-f.test.ts", "14 grupos OK", "F (nueva)", "Node + PostgreSQL real"],
    ["tests/rutas-editor.test.ts", "33 OK", "B", "Node"],
    ["tests/rutas-ficha.test.ts", "22 OK", "C", "Node"],
    ["tests/rutas-store.test.ts", "8 OK", "A", "Node"],
    ["tests/route-geo.test.ts", "11 OK", "A", "Node"],
    ["tests/api-routes.test.ts", "11 OK", "A", "PostgreSQL real"],
  ],
  [40, 20, 20, 20]
));
cuerpo.push(p("En controles estáticos, TypeScript reporta cero errores en src al cierre de cada fase (el chequeo del proyecto excluye scripts de diagnóstico históricos), ESLint queda sin errores en todos los archivos nuevos de las tres fases y el build de producción web fue exitoso en cada una. El ensayo in-vivo de la fase F (Chromium contra servidor local con PostgreSQL 5433, sesión sembrada por token y geolocalización simulada) completó 19 pasos con cero errores de consola: biblioteca, ficha privada, Navegar con chip «tu copia», persistencia del proyector tras recargar, recordatorio en la pantalla de ride, cierre del ride GPS con routeRef en el historial local, modal post-ride con la nota de completada, publicación de la experiencia con condiciones [agua, sombra] y rideId anclado verificado en base, catálogo por viewport, y Navegar pública con chip «geometría protegida»; la ruta siguió publicada después de la experiencia (la experiencia jamás escribe en Route)."));

// 7 · Release
cuerpo.push(h1("7. Release y despliegue"));
cuerpo.push(p("Los releases del módulo siguen la convención del proyecto: la versión vive en una fuente única (src/lib/appVersion.ts), se replica en android/app/build.gradle y en public/version.json (regenerado con gen-version-json), y el APK oficial lo construye la acción de GitHub al recibir el tag. La tabla 3 resume los tres releases del ciclo; el tamaño del APK se mantiene en 53 MB por no haber cambios de recursos."));
cuerpo.push(captionTabla("Releases del ciclo del módulo"));
cuerpo.push(tabla(
  ["Release", "versionCode", "Contenido", "Estado"],
  [
    ["v1.15.0", "75", "Fase A: modelo de datos y migraciones formales", "Publicado"],
    ["v1.16.0", "76", "Fase B: creación y edición de rutas", "Publicado"],
    ["v1.17.0", "77", "Fases C–F: biblioteca, publicación, comunidad y navegar", "Tag pusheado; APK en compilación al cierre"],
  ],
  [15, 15, 45, 25]
));
cuerpo.push(p("El push de la rama main (hasta el commit 2591496 del release v1.17.0) y del tag v1.17.0 se completó con éxito contra github.com/cumbre30/cumbre30. La acción «Build APK Cumbre30» quedó en ejecución para el tag v1.17.0 (iniciada a las 12:08 UTC del 21 de noviembre de 2026) y publicará cumbre30-v1.17.0-code77.apk en GitHub Releases al terminar. El despliegue web en Vercel se actualiza con el mismo push de main, y la base de producción no requería migraciones en este ciclo: las fases D–F no alteraron el esquema (la fase A ya había aplicado las migraciones aditivas con el guard de producción)."));

// 8 · Conclusiones
cuerpo.push(h1("8. Conclusiones y recomendaciones"));
cuerpo.push(p("Con la fase F, el módulo Rutas y Comunidad quedó completo en sus seis fases: el ciclo entero «crear, publicar, descubrir, seguir, pedalear y contar» funciona sin que la geometría original salga del dispositivo y sin que el contenido comunitario lleve pista GPS. Las tres fases de este informe se entregaron con verificación en cuatro capas y con los dos hallazgos de ensayo corregidos en el mismo ciclo (el umbral del lote sospechoso en la fase E y la hidratación de ?gps=1 en la fase F), lo que confirma que la estrategia de ensayo in-vivo aporta hallazgos que las suites no cubren."));
cuerpo.push(p("Para el siguiente ciclo se recomienda, en primer lugar, observar la cola de moderación durante las primeras semanas de comunidad real: el umbral ponderado está verificado por suite, pero los valores de pesos y decaimiento merecen revisión con datos reales de reportes. En segundo lugar, monitorear la tasa de fallo de Open-Meteo en producción: la publicación con elevación nula es un comportamiento seguro pero degrada la ficha, y un contador simple permitiría decidir si hace falta un proveedor de respaldo. En tercer lugar, realizar una verificación del proyector y de la experiencia post-ride en un dispositivo físico con GPS real (el ensayo de este ciclo usó geolocalización simulada), donde el course nativo y el ahorro de batería pueden afectar la frecuencia de actualización. Por último, cuando la comunidad crezca, evaluar notificaciones para respuestas a experiencias y comentarios, hoy limitadas a la revisión manual de la ficha."));
cuerpo.push(p("Este informe acompaña los archivos generados en el repositorio: las suites mencionadas en la tabla 2, los scripts de ensayo in-vivo (scripts/invivo-fase-f.mjs y su semilla) y los commits 326737b, b390b56, 596b115, cb88ce0 y 2591496 como referencia auditable de cada cambio."));

// ---------- footer con número de página ----------
function pieNumerado() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT_B })],
    })],
  });
}
function encabezado() {
  return new (require("docx").Header)({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C9D4E0", space: 4 } },
      children: [new TextRun({ text: "Cumbre30 · Módulo Rutas y Comunidad — Fases D–F", size: 18, color: "808080", font: FONT_H })],
    })],
  });
}

// ---------- documento ----------
const doc = new Document({
  creator: "Cumbre30",
  title: "Módulo Rutas y Comunidad — Fases D, E y F",
  styles: {
    default: {
      document: {
        run: { font: FONT_B, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT_H, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: FONT_H, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 260, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: FONT_H, size: 24, bold: true, color: P.primary },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // Sección 1 · Portada (margen 0, sin folio)
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Módulo Rutas y Comunidad",
        subtitle: "Informe de entrega de las fases D, E y F (arquitectura v2.1)",
        englishLabel: "INFORME DE ENTREGA",
        metaLines: [
          "Proyecto: Cumbre30 — cumbregeo.cl (web) y APK en GitHub Releases",
          "Alcance: publicación y descubrimiento · comunidad y moderación · navegar",
          "Releases: v1.15.0 · v1.16.0 · v1.17.0 (versionCode 77)",
          "Fecha: 21 de noviembre de 2026",
        ],
        footerLeft: "Cumbre30 · informe técnico",
        footerRight: "2026-11-21",
        palette: P.cover,
      }),
    },
    // Sección 2 · Índice (romanos)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pieNumerado() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Índice", bold: true, size: 32, color: P.primary, font: FONT_H })],
        }),
        new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Nota: este índice se genera mediante códigos de campo. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos» para refrescar los números de página.",
            italics: true, size: 18, color: "888888", font: FONT_B,
          })],
        }),
        // Sin PageBreak: la sección 3 ya es NEXT_PAGE (doble salto = página en blanco)
      ],
    },
    // Sección 3 · Cuerpo (arábigos desde 1)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: encabezado() },
      footers: { default: pieNumerado() },
      children: cuerpo,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/Informe-fases-D-E-F-Rutas-y-Comunidad.docx", buf);
  console.log("DOCX generado:", buf.length, "bytes");
});
