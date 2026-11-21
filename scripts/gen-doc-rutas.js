// Auditoría + arquitectura: Módulo de Rutas y Comunidad Ciclista — Cumbre30
// Genera download/Auditoria_arquitectura_rutas_comunidad_Cumbre30.docx
// Portada: receta R1 (Pure Paragraph Left) + paleta FG-1 (Forest Mint, identidad verde).
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  TableLayoutType, PageBreak,
} = require("docx");
const fs = require("fs");

// ---------- Paleta (FG-1 Forest Mint — identidad verde de Cumbre30) ----------
const COVER = {
  bg: "0C1F1A", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
  metaColor: "90989F", accent: "3DDBB5", footerColor: "687078",
};
const T = { headerBg: "2A7A65", headerText: "FFFFFF", accentLine: "2A7A65", innerLine: "C5D8D0", surface: "EDF5F2" };
const PRIMARY = "173F35";   // verde oscuro para títulos de página
const BODY = "000000";      // negro puro (Perfil A, reporte)
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
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ---------- Receta R1 (Pure Paragraph Left) ----------
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
  // Soporte de negrita con marcador **...** SOLO en pares internos (convertido a TextRun bold).
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
  h1("1. Resumen ejecutivo"),
  p("Este documento responde al encargo de evolucionar el módulo actual de segmentos hacia una plataforma de rutas ciclistas con descubrimiento y comunidad. La conclusión central de la auditoría es favorable: **Cumbre30 ya resuelve los tres pilares técnicos más difíciles del producto pedido** — el motor de trazado de rutas (grafo propio del parque con reglas oficiales de circulación, respaldo OSRM/Overpass y respaldo absoluto v1.14.3), el motor GPS de registro de actividad (captura a 1 Hz con filtrado Kalman en el teléfono, métricas calculadas en el dispositivo y sincronización idempotente que nunca sube la pista cruda) y la infraestructura de cuenta y sincronización dual web/APK (sesiones Bearer, outbox offline en IndexedDB, autenticación local para el APK). El problema pendiente no es de motores sino de **modelo de datos y de producto**: los trazados viven solo en localStorage con metadatos mínimos, no existe el concepto de ruta publicada ni su ciclo de vida, y el registro de actividad no guarda ninguna relación con la ruta que se estaba siguiendo."),
  p("La recomendación es **evolucionar, no reescribir**: un módulo nuevo y aditivo, con su propio almacenamiento versionado local (c30.rutas-v2) y tablas nuevas en Prisma (Route, RouteVersion, RoutePoi, RoutePhoto, RouteFavorite, RouteComment, RouteRating, RouteReport), reutilizando el 70-80 % del código auditado. El módulo actual de trazados se conserva intacto y migra por lectura: nada se convierte automáticamente, los segmentos personales quedan privados por defecto y las actividades históricas no se alteran."),
  p("El plan de implementación se organiza en las seis fases solicitadas (A modelo de datos, B creación y edición, C biblioteca y fichas, D publicación y descubrimiento, E comunidad y moderación, F integración GPS y navegación), cada una con entregables verificables: código, compilación, pruebas funcionales, evidencia visual, problemas detectados y documentación técnica. La sección 9 detalla el alcance concreto de cada fase mapeado a los archivos reales del proyecto."),
];

const seccion2 = [
  h1("2. Alcance y método de la auditoría"),
  p("La auditoría se realizó mediante revisión estática del código fuente del proyecto en su versión **v1.14.3 (code 74)**, publicada el 21 de noviembre de 2026. Se revisaron tres dominios en profundidad: (a) el módulo de trazados del usuario y sus tres vías de creación (dibujo sobre el mapa, importación GPX y trazado por motor desde actividades o ubicación), (b) el motor GPS y el modelo de actividades registradas, y (c) el backend (schema Prisma, endpoints /api, autenticación) junto con el precedente de contenido comunitario existente (incidentes geolocalizados con votos)."),
  p("El alcance cubre también mapas y geometrías (MapView con Leaflet, lienzo nativo del APK, minimapa maplibre y vista previa de trazado) y los componentes visuales reutilizables. **Quedan fuera** del alcance: pagos y plan Pro (se mencionan solo como restricción de límites), la credencial Parquemet (se cita por su patrón de privacidad local) y la auditoría visual de diseño. Todas las referencias del documento son archivos y líneas reales del repositorio."),
  bullet("**Store de trazados:** src/lib/trazasUsuario.ts (único acceso a la clave c30.trazas)."),
  bullet("**Creación:** src/hooks/useCreadorTrazas.ts, src/components/TrazadoOverlay.tsx, src/components/MinimapPreview.tsx, src/lib/gpx.ts."),
  bullet("**Motor de rutas:** src/lib/routing.ts, src/lib/routingService.ts, src/lib/navSnap.ts, public/red-ciclista.json."),
  bullet("**Actividades:** src/hooks/useRideEngine.ts, src/lib/rideMetrics.ts, src/lib/history.ts, src/lib/idb.ts, src/lib/sync.ts, src/lib/cloudSync.ts, src/lib/rideOffroad.ts, src/lib/rideBackfill.ts."),
  bullet("**Segmentos:** src/lib/segments.ts, consumo en StatsTab.tsx e HistoryTab.tsx."),
  bullet("**Backend:** prisma/schema.prisma, src/app/api/*, src/lib/auth.ts, src/lib/offlineAuth.ts, src/lib/incidents.ts, src/hooks/useIncidentFeed.ts."),
  bullet("**Mapas:** src/components/MapView.tsx, NativeMapCanvas.tsx, MiniMap.tsx, src/lib/navCanvasLogic.ts, navStyle.ts."),
];

const seccion3 = [
  h1("3. Estado actual del módulo de trazados"),
  p("Esta sección describe lo que existe hoy, con sus datos técnicos verificables. La tabla 1 resume el inventario y su papel; las subsecciones detallan cada dominio."),
  tableTitle("Tabla 1: Inventario del módulo actual y su papel"),
  dataTable(
    ["Componente", "Archivo(s)", "Papel actual"],
    [
      ["Store de trazados", "src/lib/trazasUsuario.ts", "localStorage c30.trazas; add/remove/lectura reactiva; máx 50 trazados"],
      ["Creador de trazados", "src/hooks/useCreadorTrazas.ts", "Dibujo con 2 taps (ruta o segmento), importación GPX, vista previa y guardado"],
      ["Overlay de creación", "src/components/TrazadoOverlay.tsx", "Instrucciones por fase, chips km/+m/origen, importar GPX, diálogo de nombre"],
      ["Vista previa con mapa", "src/components/MinimapPreview.tsx", "maplibre estático: línea naranja, pins de inicio y fin, encuadre"],
      ["Motor de trazado", "src/lib/routing.ts + routingService.ts", "Grafo local del parque + OSRM/Overpass; reglas de accesos y direcciones; % ciclovía"],
      ["Estadísticas de segmentos", "src/lib/segments.ts", "Detección de intentos por geocercas sobre la pista GPS; récords personales"],
      ["Motor GPS de actividad", "src/hooks/useRideEngine.ts", "Captura 1 Hz nativa/web, filtrado, track, pausa, guardado"],
      ["Métricas de ride", "src/lib/rideMetrics.ts", "Métricas deterministas post-proceso sobre el track muestreado"],
      ["Persistencia de actividad", "src/lib/history.ts + idb.ts", "Resumen en localStorage, pista en IndexedDB, tope freemium"],
      ["Sincronización", "src/lib/sync.ts + cloudSync.ts", "POST idempotente por clientId; outbox offline del APK; merge bidireccional"],
      ["Panel Mis trazados", "MapView.tsx (571-649)", "Lista con visibilidad, badge tipo/GPX, Ver/Navegar/Eliminar"],
      ["Comunidad (precedente)", "src/lib/incidents.ts + /api/incidents", "Reportes geolocalizados con votos, soft-delete y política de denuncias"],
    ],
    [22, 30, 48]
  ),
  h2("3.1 Modelo de datos y persistencia local"),
  p("El trazado guardado (TrazaGuardada en trazasUsuario.ts:17-29) contiene exactamente: **id** (crypto.randomUUID generado al guardar), **kind** (ruta o segmento), **nombre** (recortado a 60 caracteres), **coords** (arreglo de {lat, lon}), **distKm**, **gainM** (0 cuando la ruta la calculó el motor, porque el grafo no trae elevación) y **createdAt** (ISO). No existen updatedAt, autor, descripción, visibilidad, dificultad, superficie ni versión de esquema. El límite es de **50 trazados** (MAX_TRAZAS) y cada operación reescribe el arreglo JSON completo; la lectura tolera registros corruptos filtrando solo por id y coords válidas."),
  p("El store usa useSyncExternalStore con snapshot cacheado, patrón correcto y reutilizable. La conversión derivada userSegmentDefs() (trazasUsuario.ts:105-129) transforma cada segmento en una definición para el motor de estadísticas: geocercas de 60 m en los extremos, dirección libre y ventanas temporales plausibles derivadas de la distancia. Es la pieza que conecta trazados personales con estadísticas, y funciona, pero produce un campo detail como string formateado, lo que acopla dato y presentación."),
  h2("3.2 Las tres formas de creación"),
  p("La creación por **dibujo** admite exactamente dos puntos: con destino «hacia aquí» la ruta nace del GPS actual y termina en el toque; con «desde aquí» el segundo toque fija el fin. El motor traza con computeRoute y la línea ya queda snappeada al grafo. La importación **GPX** (subirGpx, disponible en ambos modos desde v1.14.2) lee trkpt/rtept/wpt con parseGpxLine: dedupe bajo 2 metros, resample a **400 puntos máximo** y desnivel acumulado desde la etiqueta ele; la línea se respeta tal cual y no se snappea al grafo. La creación **a partir de actividades GPS** hoy es indirecta: no existe la acción «convertir este ride en ruta»; lo más cercano es que la navegación con destino al punto final de un trazado re-traza desde la ubicación actual."),
  p("Tras guardar, **no hay edición**: solo Ver (encuadre), Navegar (solo rutas) y Eliminar. No existe renombrar, retocar puntos, invertir sentido ni unir trazados. Tampoco existen puntos de interés por trazado, fotografías, descripción, modalidad, dificultad, estado borrador/publicado, ni exportación GPX de trazados (el generador GPX existente, buildRideGpxBlob en gpx.ts:21, sirve solo a rides). La máquina de estados del creador con token de cancelación (generaRef) es sólida y se reutiliza tal cual."),
  h2("3.3 Estadísticas y segmentos"),
  p("El motor de segmentos (segments.ts) es post-recorrido: detectEfforts (líneas 253-296) cruza la pista GPS del ride con geocercas de inicio/meta aplicando exigencias de desnivel mínimo y tiempo plausible, y computeSegmentStats (308-324) agrega por definición: mejor marca, conteo, última vez y top. Los segmentos oficiales son constantes hardcodeadas (SEGMENTS); los personales entran por userSegmentDefs con dirección libre. El consumo ocurre en StatsTab (sin gate Pro) e HistoryTab (los oficiales gated a Pro). No hay estadísticas en vivo durante el ride ni fantasma contra marca personal; todo es post-proceso, lo que simplifica la integración con el nuevo módulo."),
  h2("3.4 Motor GPS, actividades y navegación"),
  p("useRideEngine es el único productor de ubicación (instancia única en page.tsx:153). En APK usa el plugin nativo RideNative (servicio en primer plano a 1 Hz); en web, watchPosition de alta precisión. El pipeline por fix incluye filtro de Kalman con compuerta de outliers, rechazo de teleportes (distancias bajo 100 m con precisión sobre 60 m), altitud con EMA y ganancia con histéresis de 3 metros. El track se muestrea a un punto cada 5 s con tope de 600 puntos (adelgazado a la mitad al llenarse). La pausa es manual y congela todo el acumulado; el guardado ocurre al detener si supera 50 m o 10 s. Las métricas (rideMetrics.ts) son deterministas sobre el track: tiempo en movimiento (umbral 2,5 km/h), velocidad pico, promedio en llano, desnivel, VAM, paradas, antitrampa y watts estimados."),
  p("La persistencia es dual y bien pensada: resumen en localStorage (cumbre30-history-v1, tope freemium de 20 rides) y pista completa en IndexedDB (cumbre30-idb-v1). La sincronización al servidor envía **solo agregados**, con idempotencia por clientId; el APK encola en outbox IndexedDB y hace pull con fusión por clientId. La pista cruda **nunca sale del teléfono** (decisión de privacidad explícita en el código). La navegación (useNavEngine) convive con el ride en tiempo real y ya detecta desvío (umbral 140 m, enfriamiento 15 s) con re-trazado que empalma al punto más cercano; además existe NavDestPreset para seguir trazados precomputados. Lo que falta: la actividad no guarda ninguna relación con la ruta seguida (RideSummary no tiene rutaId), los eventos de desvío no se persisten, y routeProgress es sin estado (el índice más cercano puede retroceder en lazos, inservible para progreso acumulado sin envolverlo con estado)."),
  h2("3.5 Backend, autenticación y precedente comunitario"),
  p("El schema Prisma tiene 14 modelos y **ninguno es de rutas**: User, Session, PasswordReset, ProDelivery, Ride, RideMetric, CyclistProfile, ProfileConfig, Incident, Friendship, Achievement, Constancia, PushSub y RideShare. La autenticación es dual: web con sesión en tabla y cookie httpOnly (más Bearer), APK con cuenta local (PBKDF2, 30 días) más espejo en el servidor y outbox de sincronización. **No hay roles ni panel de administración**: el rol de admin se ejercita por claves de entorno comparadas de forma timing-safe. El incidente geolocalizado es el precedente directo de contenido comunitario: soft-delete, contadores de confirmación/resolución/denuncia, expiración a 30 días, cierre por 2 denuncias (política UGC de Play) y borrado propio por el autor. Sus debilidades conocidas (contadores sin libro mayor, sin límite de tasa, feed sin paginación) se corrigen en el diseño nuevo, no se copian."),
  p("No existe hoy subida de archivos al servidor: la credencial Parquemet queda como imagen local en localStorage y las fotos no tienen storage. RideShare es el precedente exacto del enlace público opt-in (código de 8 caracteres, solo estadísticas, nunca el trazado). La distribución de contenido centralizado usa avisos.json con caché TTL y respaldo offline, patrón aplicable al catálogo editorial de rutas destacadas."),
  h2("3.6 Mapas y componentes visuales"),
  p("El mapa grande (MapView, Leaflet) pinta trazados con doble polilínea (halo oscuro + línea) y colores por tipo (naranja sólido rutas, cian discontinuo segmentos), con tooltip y selección. El APK renderiza el mismo concepto en lienzo nativo (NativeMapCanvas) mediante navCanvasLogic.ts, capa compartida con el minimapa maplibre. MinimapPreview ya produce la vista previa con pins de inicio (rojo) y fin (verde) que la ficha de ruta reutilizará. La identidad visual y el i18n de trazados (familia tra.*) están completos en los tres idiomas."),
];

const seccion4 = [
  h1("4. Veredicto: reutilizar, trasladar y optimizar"),
  p("El criterio del veredicto es conservador: «reutilizar» significa usar el componente sin cambios funcionales; «trasladar» significa adaptarlo a un nuevo rol conservando su lógica probada; «optimizar» significa corregir debilidades medidas durante la auditoría. Nada del módulo actual se descarta."),
  h2("4.1 Reutilizar tal cual"),
  p("Las siguientes piezas entran al nuevo módulo sin cambios funcionales. Son el corazón técnico del producto y ya están probadas en producción."),
  tableTitle("Tabla 2: Componentes reutilizables sin cambios"),
  dataTable(
    ["Pieza", "Referencia", "Por qué se conserva"],
    [
      ["Motor de trazado", "routing.ts + routingService.ts", "Grafo propio con reglas del parque, direcciones, corte horario y % ciclovía; respaldo absoluto verificado en v1.14.3"],
      ["Motor GPS único", "useRideEngine.ts", "Requisito explícito: no se implementa otro servicio de ubicación; pausas y calidad de señal ya respetadas"],
      ["Métricas y backfill", "rideMetrics.ts + rideBackfill.ts", "Patrón on-device + re-subida idempotente aplicable a métricas nuevas de ruta"],
      ["Persistencia y sync", "history.ts, idb.ts, sync.ts, cloudSync.ts", "Resumen local + pista en IndexedDB + dedupe por clientId; outbox offline del APK"],
      ["Detección de intentos", "segments.ts (detectEfforts/computeSegmentStats)", "Base de validación de finalización y de segmentos comunitarios (dir libre ya pensada para el usuario)"],
      ["Creador y overlay", "useCreadorTrazas.ts + TrazadoOverlay.tsx", "Máquina de estados con cancelación; se extiende, no se reemplaza"],
      ["Vista previa", "MinimapPreview.tsx", "Misma imagen para crear y para la ficha pública"],
      ["Capas y pintado", "MapView.tsx + navCanvasLogic.ts", "Doble polilínea y estilos por tipo, en web y lienzo nativo"],
      ["Auth y CORS", "auth.ts, offlineAuth.ts, apiCors.ts, backend.ts", "Sesión dual web/APK; el módulo solo añade permisos de contenido"],
      ["Esqueleto UGC", "incidents.ts + /api/incidents + useIncidentFeed", "Soft-delete, votos, expiración y política Play como patrón de partida"],
      ["GPX", "gpx.ts (parse + build)", "Importar ya existe; exportar trazados reutiliza el generador"],
      ["Enlace público", "RideShare (schema + /api/rides/share)", "Patrón de compartir con código y mínimos datos"],
      ["Notificaciones", "PushSub + /api/push/*", "Infra VAPID lista para avisos de comunidad"],
    ],
    [20, 28, 52]
  ),
  h2("4.2 Trasladar y adaptar"),
  tableTitle("Tabla 3: Piezas que cambian de rol conservando su lógica"),
  dataTable(
    ["Pieza actual", "Trasladada a", "Adaptación necesaria"],
    [
      ["Store c30.trazas (trazasUsuario.ts)", "Capa de datos c30.rutas-v2", "Esquema versionado (v, updatedAt, autor, metadatos); c30.trazas queda como fuente de migración de solo lectura"],
      ["userSegmentDefs (detail en string)", "Mapeo del nuevo módulo", "Campos estructurados en vez de texto formateado; separación dato-presentación"],
      ["Navegar un trazado (destino = último punto)", "«Seguir la línea guardada»", "Extender useNavEngine con ruta fija: NavDestPreset ya trae empalme en re-trazado"],
      ["snapToRoute / projectSeg (navSnap.ts)", "Proyector de progreso con estado", "Recordar nearestIdx, avance monotónico, histéresis de salida/entrada para desvío y reincorporación"],
      ["Rejilla espacial (rideOffroad.ts)", "Proyección contra polilíneas libres", "Construir un grafo sintético desde la polilínea de la ruta o proyector propio"],
      ["Histéresis de geocerca (extrageofence 18 m)", "Detección de llegada a meta", "Patrón anti-parpadeo reutilizado para finalización de ruta"],
      ["Outbox de rides (cloudSync.ts)", "Outbox de rutas/favoritos/comentarios", "Ampliar tipos de operación encoladas; misma mecánica de reintento"],
      ["Votos por contadores (Incident)", "Libro mayor por usuario (nuevo)", "Tabla por (usuario, contenido) para dedup real de valoraciones y denuncias"],
    ],
    [30, 26, 44]
  ),
  h2("4.3 Optimizar"),
  tableTitle("Tabla 4: Debilidades medidas y corrección propuesta"),
  dataTable(
    ["Debilidad actual", "Evidencia", "Optimización"],
    [
      ["Cuota y rendimiento de localStorage", "Reescritura JSON completa por operación; rutas del motor sin límite de puntos", "Polyline encoding (compresión ~10x), límite de puntos por ruta y escrituras por registro"],
      ["Elevación de rutas del motor", "gainM fijado a 0 en el creador (useCreadorTrazas.ts:96)", "Resolver elevación al guardar (servicio de elevación o perfil del GPX) y conservarla como dato"],
      ["Feed sin paginación", "GET /api/incidents con take 300 fijo", "Paginación por cursor y consulta por bbox desde el día uno en /api/routes"],
      ["Dedup de votos solo por dispositivo", "useIncidentFeed.ts:59-73 (localStorage)", "Unicidad por (usuario, contenido) en el servidor"],
      ["Sin límite de tasa en contenido", "guard() solo usado en auth/licencia", "Aplicar rate limiter existente a todos los endpoints UGC"],
      ["Visibilidad y selección en estado de UI", "verTrazas/trazaSel como useState en MapView", "Persistir en el store del nuevo módulo"],
    ],
    [26, 34, 40]
  ),
  h2("4.4 Lo que falta construir"),
  p("Frente al producto pedido, estas capacidades no existen hoy y constituyen el grueso del trabajo nuevo: servidor de rutas (tablas y API con permisos), ciclo borrador-publicado con publicación explícita, catálogo con búsqueda geográfica y filtros, ficha pública completa (perfil altimétrico, superficie, dificultad física y técnica, tiempo estimado, fotos, POIs), favoritos, comentarios, valoraciones, reportes y moderación con libro mayor por usuario, perfiles de creador, enlaces públicos de ruta, edición post-guardado (renombrar, retocar, invertir, unir), puntos de interés y fotografías por ruta, historial de versiones, protección del punto de inicio y fin, y la ligadura actividad-ruta con la sección «Mis recorridos». Ninguno requiere tocar los motores existentes; todos se montan sobre ellos."),
];

const seccion5 = [
  h1("5. Modelo conceptual: ROUTE, ACTIVITY y SEGMENT"),
  p("El modelo diferenciado pedido se mapea de forma natural sobre lo existente. **ROUTE** es el itinerario planificado: nace como TrazaGuardada de kind ruta, pero en el nuevo módulo gana identidad de servidor, metadatos (descripción, modalidad, dificultad, superficie, POIs, fotos), ciclo de vida (borrador, publicado, retirado) e historial de versiones. **ACTIVITY** es el recorrido realizado: hoy es RideSummary y se conserva tal cual; la única extensión es una referencia opcional a la ruta seguida y un bloque de cumplimiento calculado en el teléfono (completada, desvío máximo, reincorporaciones). **SEGMENT** es el tramo especializado: se mantiene como elemento personal independiente (kind segmento, privado por defecto) y además puede referenciarse desde una ruta sin dejar de existir por sí mismo."),
  tableTitle("Tabla 5: Mapeo del modelo nuevo sobre el código existente"),
  dataTable(
    ["Concepto nuevo", "Base existente", "Extensión requerida"],
    [
      ["ROUTE (privada)", "TrazaGuardada kind=ruta", "Metadatos, borrador, edición, exportación, versión local v2"],
      ["ROUTE (pública)", "No existe", "Tablas Route/RouteVersion + publicación explícita + moderación"],
      ["ACTIVITY", "RideSummary + Ride (Prisma)", "Campo opcional routeRef + bloque de cumplimiento (on-device)"],
      ["SEGMENT personal", "TrazaGuardada kind=segmento", "Se conserva privado; sin conversión automática a ruta"],
      ["SEGMENT en ruta", "userSegmentDefs + SegmentDef", "Referencia ruta-segmento sin absorción; estadísticas compartidas"],
      ["POI de ruta", "Capas POI del mapa (solo lectura)", "POIs pertenecientes a una ruta con orden y nota"],
    ],
    [24, 34, 42]
  ),
  p("Tres reglas de oro, tomadas del encargo y verificadas contra el código: los segmentos personales **no se publican automáticamente** al compartir una ruta (la publicación de ruta solo sube la geometría y metadatos de la ruta); las **actividades históricas conservan sus datos originales** aunque cambie la geometría de una ruta (la referencia de un ride es a una versión concreta de la ruta, RouteVersion, nunca a la geometría mutable); y una ruta puede tener segmentos asociados **sin perder su independencia** (la relación es de referencia, no de contenido)."),
];

// ---------- Contenido: secciones 6 a 10 ----------
const seccion6 = [
  h1("6. Arquitectura propuesta"),
  p("La arquitectura mantiene el principio que ya rige la app: cálculo pesado y datos sensibles en el teléfono, servidor para identidad y contenido compartido. El módulo añade una capa de datos local versionada (rutas privadas) y una capa de servidor (rutas publicadas y comunidad), conectadas por la misma mecánica de sincronización con outbox que hoy usan rides y logros."),
  h2("6.1 Datos: tablas nuevas y almacenamiento local"),
  tableTitle("Tabla 6: Tablas Prisma nuevas del módulo"),
  dataTable(
    ["Tabla", "Campos clave", "Propósito"],
    [
      ["Route", "id, ownerId, nombre, descripcion, modalidad, dificultadFisica, dificultadTecnica, superficie, distKm, gainM, minEle, maxEle, coords (polyline), status (borrador/publicado/retirado), inicioAprox, finAprox, timestamps, soft-delete", "Ruta publicada; geometría comprimida con polyline encoding"],
      ["RouteVersion", "routeId, v, geometrySnapshot, metaSnapshot, publishedAt", "Historial de versiones exigido; los rides referencian la versión que corrieron"],
      ["RoutePoi", "routeId, orden, lat, lon, tipo, nombre, nota", "Puntos de interés ordenados sobre el trazado"],
      ["RoutePhoto", "routeId, url, orden, credit", "Fotografías de la ficha (storage externo, ver 6.5)"],
      ["RouteFavorite", "userId, routeId (único por par)", "Guardar/favoritos"],
      ["RouteComment", "routeId, userId, body, soft-delete", "Comentarios; respuesta opcional por parentId"],
      ["RouteRating", "routeId, userId (único por par), 1-5, updatedAt", "Valoración editable, una por usuario"],
      ["RouteReport", "routeId, reporterId, motivo, nota, estado", "Denuncias con libro mayor; alimenta la cola de moderación"],
      ["User.role", "columna nueva: user/moderador/admin", "Moderación delegable sin claves de entorno"],
    ],
    [18, 44, 38]
  ),
  p("En el teléfono, el nuevo store **c30.rutas-v2** replica el patrón de trazasUsuario (useSyncExternalStore) con esquema versionado: cada registro lleva v de esquema, id estable, autor local, timestamps completos y geometría comprimida. El store antiguo c30.trazas se convierte en fuente de migración de solo lectura (sección 8). Las rutas borrador son siempre locales; solo al publicar existe copia en servidor."),
  h2("6.2 API y sincronización"),
  tableTitle("Tabla 7: Endpoints nuevos (todos con sesión salvo lectura pública)"),
  dataTable(
    ["Endpoint", "Métodos", "Notas"],
    [
      ["/api/routes", "GET, POST", "GET público con paginación por cursor, bbox y filtros (modalidad, distancia, dificultad); POST crea borrador/pública del propietario"],
      ["/api/routes/[id]", "GET, PATCH, DELETE", "PATCH/DELETE solo propietario (o moderador); DELETE = retirar (soft-delete)"],
      ["/api/routes/[id]/publish", "POST, DELETE", "Publicación explícita y despublicación; crea RouteVersion"],
      ["/api/routes/[id]/favorite", "POST, DELETE", "Favorito único por usuario"],
      ["/api/routes/[id]/comments", "GET, POST, DELETE", "Libro mayor; borrado propio o moderador"],
      ["/api/routes/[id]/rating", "PUT", "1-5 único por usuario, editable"],
      ["/api/routes/[id]/report", "POST", "Denuncia con motivo; oculta contenido al alcanzar umbral (política Play)"],
      ["/api/moderation", "GET, PUT", "Cola de reportes; requiere rol moderador (con transición por x-admin-key)"],
      ["/api/routes/[id]/share", "POST, GET", "Enlace público con código, patrón RideShare"],
    ],
    [30, 18, 52]
  ),
  p("Todas las operaciones de escritura usan el rate limiter existente (rateLimit.ts) y el CORS de Capacitor ya configurado. El APK sin /api consume por backendOrigin() y encola en el outbox ampliado a rutas, favoritos y comentarios; la resolución de conflictos es servidor-autoridad con last-write-wins por updatedAt y dedupe por clientId, el mismo contrato que ya cumplen los rides."),
  h2("6.3 Navegación del módulo: cuatro secciones"),
  p("Las cuatro secciones pedidas se materializan como pestañas del módulo con la identidad verde existente y componentes actuales: **Descubrir** (nueva DiscoveryTab: catálogo con búsqueda por mapa y texto, filtros por modalidad, distancia y dificultad; fichas en tarjetas con MinimapPreview); **Mis rutas** (evolución natural del panel Mis trazados: borradores, publicadas, favoritas, con visibilidad persistida); **Crear ruta** (el creador actual extendido, misma pantalla y fases conocidas); **Mis recorridos** (HistoryTab filtrado/agrupado por ruta seguida, con progreso y cumplimiento por ejecución). El APK hereda todo por ser el mismo bundle, con el lienzo nativo ya compartido vía navCanvasLogic."),
  h2("6.4 Creación y edición de rutas"),
  p("Sobre useCreadorTrazas se añaden: **múltiples waypoints** (el motor ya soporta vias internamente en routeWithVias), **POIs por ruta** (long-press en la fase de puntos, mismo gesto que ya crea incidentes), **descripción, fotografías y metadatos** (modalidad, dificultad física y técnica, superficie sugerida por el grafo y editable), y **guardado como borrador** por defecto. La edición post-guardado incorpora renombrar, retocar puntos (arrastre del vértice con re-trazado del tramo por el motor), invertir sentido, unir dos rutas y eliminar POIs. La exportación GPX de trazados reutiliza buildRideGpxBlob con metadatos de ruta. La creación desde una actividad GPS se formaliza como «guardar este recorrido como ruta»: toma la pista del ride (IndexedDB), la simplifica con las reglas ya existentes de parseGpxLine y abre la vista previa estándar."),
  h2("6.5 Ficha de ruta y descubrimiento"),
  p("La ficha pública presenta exactamente los campos del encargo: nombre, descripción, creador (perfil con username existente), distancia, desnivel positivo y negativo, altitud mínima y máxima (del GPX o resueltas al guardar), perfil altimétrico (render ya existente en la app de rides), superficie, dificultades, modalidad, tiempo estimado orientativo (modelo de velocidad por pendiente ya presente en rideMetrics), mapa con MinimapPreview, POIs, fotografías, última actualización (RouteVersion) e información comunitaria (valoración media, comentarios, cuántos la completaron). Acciones: Guardar (favorito local+servidor), Iniciar recorrido (sección 6.6) y Compartir (enlace con código). Las fotografías exigen incorporar storage: se propone Vercel Blob con validación de tipo/tamaño en el endpoint de upload, el primer uso de archivos en el servidor de Cumbre30."),
  h2("6.6 Integración GPS: seguimiento de rutas"),
  p("«Iniciar recorrido» liga la navegación existente con el registro de actividad en un único flujo: se activa el ride normal (useRideEngine no se toca) y se fija la ruta como **preset** en useNavEngine (NavDestPreset ya existe, con empalme en re-trazado). Sobre esa base se añade un **proyector de progreso con estado** (adaptación de snapToRoute/routeProgress): índice más cercano persistido, avance monotónico, histéresis de salida (desvío sostenido) y entrada (reincorporación). Los eventos de desvío y reincorporación se registran en la bitácora del ride y **se persisten** con la actividad, cosa que hoy no ocurre. La finalización usa la geocerca de meta con la histéresis del patrón extrageofence; las pausas normales y las pérdidas de señal no generan desvíos ni invalidan nada (el pipeline ya congela en pausa y descarta fixes de mala calidad). Al detener, el resumen lleva routeRef (id + versión) y el bloque de cumplimiento calculado en el teléfono: completada sí/no, desvío máximo, reincorporaciones, porcentaje recorrido. El servidor recibe solo esos agregados, nunca la pista, manteniendo la política de privacidad vigente."),
  h2("6.7 Comunidad y moderación"),
  p("Favoritos, valoraciones (única por usuario, editable) y comentarios (con borrado propio y del moderador) sobre RouteComment/RouteRating con libro mayor. Los reportes admiten motivos tipificados (incorrecta, peligrosa, cerrada, spam) y al alcanzar el umbral la ruta pasa a estado oculto pendiente de revisión, con banner de estado y notificación al autor por la infraestructura push existente. La cola de moderación (/api/moderation) exige rol en la base de datos; durante la transición se mantiene el acceso por x-admin-key para el propietario del producto. La búsqueda geográfica usa consultas por bbox con índice en Postgres; el catálogo editorial (rutas destacadas) se distribuye con el patrón avisos.json mientras no haya panel."),
];

const seccion7 = [
  h1("7. Privacidad y seguridad"),
  p("La política se construye sobre tres decisiones de privacidad que ya son código: la pista GPS de las actividades nunca sale del teléfono, la credencial Parquemet queda en el dispositivo, y el compartido de rides expone solo estadísticas. El módulo las extiende al contenido de rutas."),
  bullet("**Privadas por defecto:** toda ruta nace borrador local; publicar es una acción explícita con confirmación y resumen de qué se comparte."),
  bullet("**Protección de inicio y fin:** al publicar, la app ofrece (por defecto activado) redondear el origen y el destino a la vía pública más cercana dentro de un umbral configurable (150-200 m), usando el snap del grafo; el punto exacto queda solo en la copia local del creador."),
  bullet("**Control de acceso:** lectura pública solo de rutas con status publicado; edición y eliminación restringidas al propietario; retirada (despublicación) y borrado con soft-delete conservando trazabilidad."),
  bullet("**Archivos GPX:** la importación sigue siendo local (el archivo nunca se sube salvo que el usuario publique la ruta derivada); el export de trazados requiere sesión y opt-in."),
  bullet("**Moderación:** denuncias con motivo y libro mayor, ocultamiento automático por umbral, cola con rol, y separación clara entre datos oficiales (normativa del parque, ya clasificada en capas) y contenido comunitario, siempre con etiqueta distinta."),
  bullet("**Marco legal de los mapas:** la atribución OSM/ODbL y la advertencia de carácter orientativo ya están en la app (familia i18n de atribución); el módulo la reutiliza y añade en la ficha la nota de que ninguna restricción presentada es autorización legal."),
  bullet("**Historial de versiones:** toda edición de una ruta publicada crea RouteVersion; las referencias de actividades y favoritos quedan ancladas a versiones, y la geometría antigua permanece auditable."),
];

const seccion8 = [
  h1("8. Compatibilidad y migración"),
  p("La migración es aditiva y por lectura, sin conversores destructivos. En el primer arranque tras la fase A, el nuevo store c30.rutas-v2 **importa** los registros de c30.trazas: conserva id, kind, nombre, coords, distKm, gainM, createdAt y origen; agrega v de esquema, updatedAt igual a createdAt, autor local y estado borrador. Los kind segmento entran como segmentos personales (privados); **no se convierten en rutas**. El store antiguo no se borra: queda como respaldo de solo lectura y la escritura nueva vive en el store v2, de modo que un rollback a la versión anterior de la app no pierde nada."),
  p("Las actividades históricas no se tocan: RideSummary no cambia de forma, solo suma un campo opcional routeRef (los rides viejos no lo tienen y toda la lógica lo trata como ausente, patrón idéntico al de metricsTried). Si más adelante se edita la geometría de una ruta pública, los rides existentes siguen apuntando a su RouteVersion original y sus datos permanecen idénticos. En el APK, el export estático no incluye /api: las rutas privadas funcionan igual que hoy (local), y la lectura del catálogo y la publicación usan backendOrigin() con outbox offline, exactamente como ya hacen rides, logros y perfil. El orden de despliegue protege la app vigente: primero tablas y API (fase A, sin UI), luego creación/edición (B), biblioteca (C), publicación (D), comunidad (E) y por último la integración GPS (F), siempre con versiones compatibles hacia atrás y release separado por fase."),
];

const seccion9 = [
  h1("9. Plan de implementación por fases"),
  p("Cada fase entrega lo comprometido en el encargo: código implementado, compilación verificada (tsc y build web), pruebas funcionales in-vivo con evidencia visual, lista de problemas detectados y documentación técnica. El detalle de alcance es el siguiente."),
  tableTitle("Tabla 8: Fases A-F con alcance y piezas que reutilizan"),
  dataTable(
    ["Fase", "Alcance concreto", "Reutiliza"],
    [
      ["A. Modelo de datos y migración", "Tablas Prisma nuevas (tabla 6), User.role; store c30.rutas-v2 versionado; migración por lectura desde c30.trazas; API /api/routes básica con auth y rate limit; outbox ampliado", "trazasUsuario (patrón store), cloudSync (outbox), auth/apiCors, rateLimit"],
      ["B. Creación y edición", "Multi-waypoint, POIs, descripción y metadatos, borrador por defecto; edición post-guardado (renombrar, retocar, invertir, unir); export GPX de trazados; crear desde actividad GPS", "useCreadorTrazas, TrazadoOverlay, MinimapPreview, computeRoute, gpx.ts"],
      ["C. Biblioteca y fichas", "Cuatro secciones del módulo; Mis rutas con visibilidad persistida; ficha completa con perfil altimétrico y POIs; acciones Guardar/Iniciar/Compartir", "MapView (pintado y panel), MinimapPreview, render de perfil de rides, i18n tra.*"],
      ["D. Publicación y descubrimiento", "Publicación explícita con protección de inicio/fin; RouteVersion; catálogo con búsqueda bbox y filtros; enlaces públicos con código", "RideShare (patrón enlace), avisos.json (destacados), snapInfo (redondeo)"],
      ["E. Comunidad y moderación", "Favoritos, comentarios, valoraciones y reportes con libro mayor; cola de moderación con rol; notificaciones al autor; upload de fotos (Vercel Blob)", "Incident (patrón UGC), push VAPID, adminKey, rateLimit"],
      ["F. Integración GPS y navegación", "Preset de línea guardada en useNavEngine; proyector con estado; eventos de desvío/reincorporación persistidos; routeRef y bloque de cumplimiento; Mis recorridos por ruta", "NavDestPreset, snapToRoute/routeProgress, extrageofence, RideSummary, segments.ts"],
    ],
    [22, 48, 30]
  ),
  p("Las fases A y B pueden entregarse juntas si se desea un demo temprano de creación y edición (todo local, sin servidor). La fase F es la única que toca el comportamiento en marcha y por eso va al final, con el motor GPS intacto: se limita a consumir la ruta activa y a registrar eventos. Cada fase termina con un release interno etiquetado y verificable, siguiendo el proceso v1.14.x ya establecido (bump de appVersion, verificación de export del APK y smoke test del servidor)."),
];

const seccion10 = [
  h1("10. Riesgos y decisiones abiertas"),
  tableTitle("Tabla 9: Riesgos identificados y mitigación"),
  dataTable(
    ["Riesgo", "Impacto", "Mitigación propuesta"],
    [
      ["Cuota de localStorage con rutas largas", "Pérdida de datos o fallos de guardado en el APK", "Polyline encoding + límite de puntos por ruta + migración de escrituras por registro (fase A)"],
      ["Elevación ausente en rutas del motor (gainM=0)", "Ficha con desnivel vacío y dificultad física imprecisa", "Resolver elevación al guardar vía servicio de elevación o ajuste del grafo; campo null explícito mientras tanto, nunca 0 ficticio"],
      ["UGC y política de Play Store", "Riesgo de cumplimiento por contenido de usuarios", "Esqueleto de incidents ya cumple (umbral 2 denuncias, soft-delete); se traslada a rutas con cola de moderación"],
      ["Exposición de domicilios en rutas públicas", "Privacidad del creador", "Redondeo de inicio/fin a vía pública por defecto (opt-out claro) y vista previa de qué se publica"],
      ["Moderación sin equipo dedicado", "Carga operativa y tiempo de respuesta", "Ocultamiento automático por umbral + rol moderador opcional; el propietario revisa la cola con su clave durante la transición"],
      ["Conflictos multi-dispositivo en rutas locales", "Ediciones perdidas al sincronizar", "Servidor-autoridad para publicadas; last-write-wins por updatedAt y dedupe por clientId en el outbox"],
      ["Seguir la línea guardada en zonas sin cobertura del grafo", "Navegación degradada fuera del sector con datos ricos", "El preset guía por geometría; el re-trazado empalma por el motor; aviso visible cuando la ruta sale del grafo (patrón de avisos existente)"],
      ["Reescritura accidental del funcionamiento vigente", "Regresiones en trazados y rides actuales", "Fases aditivas con release separado; c30.trazas intocado como respaldo; pruebas de regresión del creador y del ride en cada fase"],
    ],
    [26, 26, 48]
  ),
  p("Dos decisiones quedan abiertas para el propietario del producto y no bloquean el inicio de la fase A: (1) el umbral exacto de protección de inicio/fin y si la redondeación se aplica también a rutas compartidas por enlace, y (2) el storage de fotografías — la propuesta es Vercel Blob por integración directa con el despliegue actual, pero cualquier storage S3-compatible sirve sin cambiar el diseño. Con la aprobación de este documento, la fase A puede comenzar de inmediato sobre la v1.14.3 publicada."),
];

// ---------- Ensamblaje del documento ----------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function pageFooter(marker) {
  // marker: zero-width space solo en el footer de numeración romana (para el parche post-gen)
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
    children: [new TextRun({ text: "Cumbre30 · Rutas y Comunidad Ciclista — Auditoría y arquitectura", size: 18, color: GRAY, font: FONT })],
  })],
});

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman" }, size: 24, color: BODY },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
      heading2: { run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 240, after: 120, line: 312 } } },
    },
  },
  sections: [
    { // Sección 1: portada — sin número de página
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Rutas y Comunidad Ciclista",
        subtitle: "Auditoría técnica del módulo actual y arquitectura propuesta del nuevo módulo",
        englishLabel: "CUMBRE30",
        metaLines: [
          "Producto: Cumbre30 · web cumbregeo.cl + APK Android (Capacitor)",
          "Base auditada: v1.14.3 · code 74 (21 de noviembre de 2026)",
          "Documento: Fase 0 — Auditoría y arquitectura propuesta",
          "Contenido: veredicto reutilizar / trasladar / optimizar, modelo ROUTE-ACTIVITY-SEGMENT, datos, API, GPS y plan por fases A-F",
        ],
        footerLeft: "Cumbre30",
        footerRight: "Uso interno del proyecto",
        palette: COVER,
      }),
    },
    { // Sección 2: índice — numeración romana
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
    { // Sección 3: cuerpo — numeración arábiga desde 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: bodyHeader },
      footers: { default: pageFooter(false) },
      children: [
        ...seccion1, ...seccion2, ...seccion3, ...seccion4, ...seccion5,
        ...seccion6, ...seccion7, ...seccion8, ...seccion9, ...seccion10,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/Auditoria_arquitectura_rutas_comunidad_Cumbre30.docx";
  fs.writeFileSync(out, buf);
  console.log("OK", out, buf.length, "bytes");
});
