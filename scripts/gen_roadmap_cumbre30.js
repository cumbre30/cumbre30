// ============================================================
// Informe: "Nuevas funcionalidades para potenciar Cumbre30"
// Genera el .docx con receta de portada R1 (paleta DM-1), TOC en
// sección propia (números romanos) y cuerpo (números arábigos).
// Ejecutar: node /home/z/my-project/scripts/gen_roadmap_cumbre30.js
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableLayoutType, SectionType, TableOfContents,
} = require("docx");
const fs = require("fs");
const path = require("path");
let imageSizeOf;
try {
  const m = require("image-size");
  imageSizeOf = m.imageSize || m.default || m;
} catch (e) {
  imageSizeOf = null;
}

const SCORES = JSON.parse(fs.readFileSync(path.join(__dirname, "out", "scores.json"), "utf-8"));
const CHART_PNG = path.join(__dirname, "out", "figura1_prioridad.png");
const OUT = "/home/z/my-project/download/Cumbre30-analisis-nuevas-funcionalidades.docx";

// ── Paleta DM-1 (Deep Cyan: tecnología) + tokens de tabla ──
const P = {
  bg: "162235", accent: "37DCF2",
  titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078",
  headings: "0A1628", body: "000000",
  tHeaderBg: "1B6B7A", tHeaderText: "FFFFFF", tInnerLine: "C8DDE2", tAccentLine: "1B6B7A", tSurface: "EDF3F5",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };

// ── Utilidades de portada (adapta calcTitleLayout a texto latino) ──
function estimateTextWidth(text, pt) {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isCJK = (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f);
    w += isCJK ? pt * 20 : pt * 11;
  }
  return w;
}

// Divide por palabras acumulando ancho real (títulos en español)
function splitLatinLines(title, maxWidthTw, pt) {
  const words = title.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const cand = cur ? cur + " " + word : word;
    if (estimateTextWidth(cand, pt) <= maxWidthTw || !cur) cur = cand;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 36, minPt = 24) {
  let titlePt = preferredPt;
  let lines = splitLatinLines(title, maxWidthTwips, titlePt);
  // Preferir 2 líneas; si no cabe, aceptar hasta 3
  while (titlePt > minPt && lines.length > 2) {
    titlePt -= 2;
    lines = splitLatinLines(title, maxWidthTwips, titlePt);
  }
  if (lines.length > 3) {
    titlePt = minPt;
    lines = splitLatinLines(title, maxWidthTwips, titlePt);
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

// ── Receta R1: portada de párrafos, alineada a la izquierda ──
function buildCoverR1(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 36, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing }, children: [] }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Arial", eastAsia: "Arial" }, characterSpacing: 40,
      })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Arial", eastAsia: "Arial" },
      })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({
        text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { ascii: "Arial", eastAsia: "Arial" },
      })],
    }));
  }

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 24, color: P.metaColor,
        font: { ascii: "Arial", eastAsia: "Arial" },
      })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing }, children: [] }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial", eastAsia: "Arial" } }),
      new TextRun({ text: "                                        ", size: 16, color: P.footerColor, font: { ascii: "Arial", eastAsia: "Arial" } }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial", eastAsia: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}

// ── Constructores de cuerpo ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.headings, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 30, color: P.headings, font: FONT })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT })],
    ...opts,
  });
}
function bodyRuns(runs) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 120 },
    children: runs,
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT })],
  });
}
function caption(text) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.headings, font: FONT })],
  });
}
function figCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 160, line: 312 },
    children: [new TextRun({ text, size: 21, color: "555555", font: FONT })],
  });
}

// Tabla estilo Horizontal-Only con tokens DM-1
function dataTable(headerCells, dataRows, widths) {
  const mkHeader = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headerCells.map((text, i) => new TableCell({
      children: [new Paragraph({
        spacing: { line: 276 },
        children: [new TextRun({ text, bold: true, size: 21, color: P.tHeaderText, font: FONT })],
      })],
      shading: { type: ShadingType.CLEAR, fill: P.tHeaderBg },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const mkRows = dataRows.map((cells, ri) => new TableRow({
    cantSplit: true,
    children: cells.map((text, i) => new TableCell({
      children: [new Paragraph({
        spacing: { line: 276 },
        children: [new TextRun({ text: String(text), size: 21, color: P.body, font: FONT })],
      })],
      shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: P.tSurface } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.tAccentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.tAccentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.tInnerLine },
      insideVertical: NB,
    },
    rows: [mkHeader, ...mkRows],
  });
}

// ============================================================
// Contenido del informe (español, sin comillas curvas ni Markdown)
// ============================================================

const s1 = [
  h1("1. Resumen ejecutivo"),
  body("El 14 de noviembre de 2026, Cumbre30 alcanzó la versión 1.8.7 (versionCode 33) con cinco funcionalidades nuevas en producción: detección de caída con cuenta regresiva, avisos operativos en tiempo real leídos de un archivo de configuración, constancia PDF verificable en línea con membrete y código QR, canal de Parquemet en el reporte ciudadano y selector de idioma en español, inglés y portugués con voces de síntesis por idioma. El commit b0cf484 está en la rama principal, el árbol de trabajo está limpio y los endpoints nuevos responden correctamente en producción: la página /verificar devuelve 200, la API de constancias responde 400 cuando se consulta sin identificador (comportamiento esperado) y el archivo de avisos queda servido desde el sitio."),
  body("Este documento responde a la pregunta de qué otras funcionalidades conviene implementar para potenciar la aplicación. El análisis parte del código vigente (módulos de src/lib, componentes y rutas API), del catálogo público de funcionalidades del sitio /geo y de la restricción estructural del producto: un ciclocomputador offline primero, que guarda los rides en el teléfono y debe seguir funcionando sin señal en el Cerro San Cristóbal. Cada propuesta indica qué aporta al ciclista, cómo se implementaría sobre los módulos existentes y cuánto esfuerzo estimado requiere."),
  body("La conclusión central es que la siguiente iteración (v1.8.8) debería concentrarse en seis mejoras de alto impacto y esfuerzo contenido: contactos de emergencia enlazados a la detección de caída, zonas de esfuerzo con los sensores Bluetooth que ya se leen, moderación comunitaria de las incidencias, notificaciones locales de avisos, rachas de actividad y un modo de ahorro de batería. Las cinco primeras posiciones de la matriz de priorización del capítulo 5 corresponden a funcionalidades de esa primera ola. La inteligencia aplicada a fotos y resúmenes, la exportación a Strava y el ranking de segmentos conforman una segunda ola; el respaldo en la nube, el ride compartido en vivo, los comandos por voz y el mapa de calor anual quedan en una tercera ola de apuestas mayores."),
];

const s2 = [
  h1("2. Estado actual de la aplicación"),
  body("Cumbre30 es un ciclocomputador de apoyo al ciclista para el Parque Metropolitano de Santiago, construido con Next.js y Capacitor y distribuido como APK de Android de unos 61 MB y como aplicación web instalable (PWA). Funciona sin datos móviles: la navegación traza rutas reales por calle y ciclovía sobre un grafo OSM propio de unas 58.000 aristas del sector, y el registro de velocidad, distancia, tiempo y desnivel corre íntegramente en el teléfono. El modelo de producto es local por diseño: la cuenta puede existir sin servidor (claves derivadas con PBKDF2 de 100.000 iteraciones), los logros se evalúan en el dispositivo y los rides solo salen del teléfono cuando el usuario decide sincronizarlos."),
  body("Sobre esa base, la aplicación ya cubre el ciclo completo de una salida: navegación con instrucciones de voz y hora de llegada, límite de 30 km/h con geocercas, alertas sonoras y bajadas fiscalizadas, capas del parque (accesos, cumbres, senderos enduro, corredores direccionales y paseo metropolitano), reporte y consulta de incidencias, retos diarios, semanales y mensuales con pines, credencial QR Pedalea Seguro, SOS ampliado con números de emergencia y ubicación, clima, horario del parque y sensores Bluetooth de pulso y cadencia. Las funciones Pro agregan temas, velocímetro personalizable, segmentos con récord personal y una página de planes con pagos por MercadoPago. La versión 1.8.7 añadió además el soporte de idiomas con voces localizadas y la constancia verificable de cada ride."),
  caption("Tabla 1: Funcionalidades entregadas en la versión 1.8.7 y su verificación"),
  dataTable(
    ["Funcionalidad entregada", "Componentes principales", "Verificación realizada"],
    [
      ["Detección de caída", "src/lib/fallDetect.ts, FallOverlay.tsx, useRideEngine.ts, activación en ConfigTab.tsx", "Compila sin errores de tipo; overlay con cuenta regresiva y voz"],
      ["Avisos operativos en tiempo real", "public/avisos.json, src/lib/avisos.ts, banner en la pantalla Ride con voz y refresco de 5 minutos", "La petición GET a /avisos.json devuelve 200 en producción"],
      ["Constancia verificable en línea", "src/lib/constancia.ts, membrete Cumbre30 y QR en ridePdf.ts, ruta /api/constancias, página /verificar", "/verificar devuelve 200; la API responde 400 sin identificador, como se espera"],
      ["Canal Parquemet en reporte ciudadano", "apiUrl() en el envío de incidencias, acción de compartir con Parquemet en MiniMap.tsx y MapView.tsx", "Presente en web y APK; no requiere cambios de servidor"],
      ["Selector de idioma es/en/pt", "src/lib/i18n.ts, voces TTS por idioma, clima y horario traducidos, selector en ConfigTab", "Verificación de tipos y build aprobados en el commit b0cf484"],
    ],
    [24, 44, 32],
  ),
  body("La fortaleza de este diseño es también su principal deuda técnica: casi todo el valor vive en el teléfono. Un usuario que cambia de dispositivo pierde su historial, y las estadísticas agregadas, los rankings o los avisos urgentes no pueden existir sin un canal que opere cuando la aplicación está cerrada. Esa tensión entre autonomía local y continuidad es justamente la que ordena las propuestas de los capítulos siguientes.", { spacing: { line: 312, before: 160, after: 120 } }),
];

const s3 = [
  h1("3. Criterios y método de priorización"),
  body("Las funcionalidades se evaluaron con cinco criterios. Impacto mide cuánto mejora la experiencia, la seguridad o la motivación del ciclista del parque. Esfuerzo estima el tamaño técnico de la implementación sobre el código actual, en una escala de 1 a 5, considerando el desarrollo y las pruebas en APK. Sinergia premia lo que reutiliza módulos ya maduros (fallDetect, sensors, segments, incidents, avisos) en lugar de abrir frentes nuevos. Coherencia protege los principios del producto: privacidad por defecto, funcionamiento sin conexión y datos personales mínimos. Riesgo descuenta lo que depende de servicios externos, permisos sensibles del sistema o decisiones de terceros."),
  body("El índice de prioridad combina los dos primeros criterios en una fórmula simple: el impacto multiplicado por 2, menos el esfuerzo, con ambas escalas de 1 a 5. Un índice de 8 representa una mejora mayor que se puede construir con rapidez; un índice de 3 señala una apuesta que conviene solo cuando las anteriores estén consolidadas. Las escalas son estimaciones del equipo de desarrollo a partir de la revisión del código: todavía no existen métricas de uso real de la aplicación, y el capítulo final recomienda instrumentarlas para re-priorizar con datos."),
  body("Cada funcionalidad se asigna además a una ola de ejecución. La Ola 1 agrupa lo que puede salir en la versión 1.8.8: impacto alto o medio, esfuerzo contenido y ninguna dependencia externa. La Ola 2 reúne lo que necesita servidor o servicios de inteligencia artificial. La Ola 3 contiene las apuestas estructurales, cuyo diseño conviene iniciar temprano aunque la construcción llegue después. Esta separación evita que un proyecto grande bloquee mejoras rápidas que ya pueden publicarse."),
];

const s4 = [
  h1("4. Propuestas por eje funcional"),
  body("Este capítulo desarrolla las catorce funcionalidades propuestas, agrupadas en siete ejes. Para cada una se describe el beneficio esperado, la forma de implementarla sobre los módulos existentes y su clasificación en la matriz del capítulo 5. Los nombres de archivo corresponden al código vigente en la versión 1.8.7."),

  h2("4.1 Seguridad y emergencia: contactos ICE y ride en vivo"),
  body("La funcionalidad con mayor índice de prioridad completa el circuito que la detección de caída dejó a mitad de camino. Hoy el overlay muestra una cuenta regresiva y pregunta si el ciclista está bien; la mejora agrega una lista de contactos de emergencia (ICE, por sus siglas en inglés) configurable en ConfigTab y, si la cuenta regresiva expira sin respuesta, el envío automático de un mensaje con las coordenadas GPS actuales y un enlace de mapa, por SMS (esquema sms:) o por WhatsApp (esquema wa.me), redactado en el idioma activo. La implementación reutiliza fallDetect.ts y alertEngine.ts, no requiere servidor ni permisos adicionales a los ya declarados, y funciona igual en web y en APK porque los esquemas de mensajería los resuelve el sistema operativo."),
  body("El ride en vivo compartido es la segunda pieza del eje: un enlace temporal que un contacto de confianza puede abrir en el navegador para ver la posición del ciclista durante la salida. Requiere un endpoint ligero en Vercel que reciba la posición mientras el ride está activo y una página de espectador con mapa, con expiración automática al terminar el pedaleo. Por su dependencia de servidor y sus implicancias de privacidad se asigna a la Ola 3, con consentimiento explícito por cada ride."),

  h2("4.2 Notificaciones push y locales"),
  body("Los avisos operativos solo alcanzan al usuario con la aplicación abierta y un refresco cada cinco minutos. El paso siguiente es notificar cuando la aplicación está cerrada, en dos niveles. En el APK, notificaciones locales de Capacitor programadas con el horario vigente del parque (apertura, aviso previo al cierre) y con los avisos que el equipo marque como importantes; funcionan sin conexión porque se programan con la información ya descargada. En la web, Web Push con claves VAPID desde el servidor de Vercel, reservado a avisos urgentes como el cierre anticipado del parque por condiciones meteorológicas. Ambos niveles se apoyan en el mismo formato de avisos.json, de modo que el flujo de contenido no cambia."),

  h2("4.3 Comunidad: moderación de incidencias y ranking de segmentos"),
  body("El feed de incidencias vale tanto como su frescura. La moderación comunitaria permite a cualquier ciclista confirmar un reporte (sigue ahí) o cerrarlo (ya resuelto), con un decaimiento automático por antigüedad para que un bache reparado no persista en el mapa. La implementación toca incidents.ts, localIncidents.ts y useIncidentFeed.ts: los votos se acumulan en el servidor cuando hay conexión y se resuelven localmente cuando no la hay, igual que hoy funciona el reporte. Esta mejora refuerza además el canal Parquemet incorporado en la 1.8.7, porque los reportes confirmados por varias personas llegan con mayor respaldo."),
  body("El ranking de segmentos convierte los récords personales de segments.ts en una tabla semanal por tramo, con el alias público que elija el usuario y sin datos que identifiquen a menores. Es la funcionalidad de mayor esfuerzo de su eje porque exige sincronizar tiempos validados y prevenir trampas, pero activa la comunidad que ya existe en torno a los retos y da sentido competitivo a los corredores fiscalizados del parque."),

  h2("4.4 Inteligencia artificial aplicada: fotos, resúmenes y ayuda"),
  body("El reporte ciudadano con foto es el candidato natural para un modelo de visión (VLM): al adjuntar la imagen, un endpoint en Vercel clasifica el tipo de problema (bache, animal suelto, obstáculo, vía bloqueada) y su severidad, y prellena el formulario con una descripción sugerida en el idioma activo. El ciclista confirma o corrige antes de enviar, de modo que la inteligencia artificial reduce fricción sin quitar control. La llamada se hace solo con la foto y el contexto mínimo; no se envían datos de la cuenta."),
  body("El mismo enfoque sirve para dos piezas de contenido. Un resumen semanal generado con un modelo de lenguaje sobre las estadísticas mensuales existentes (kilómetros, salidas, desnivel, excesos del límite de 30) entrega un texto motivador para compartir al cierre de cada semana. Un asistente de ayuda, alimentado con las reglas del parque, el horario y las preguntas frecuentes de HelpTab, responde consultas en los tres idiomas de la aplicación. En los tres casos el procesamiento ocurre en el servidor y el costo por consulta es acotado; se recomienda registrar el volumen de uso para calibrar el presupuesto."),

  h2("4.5 Datos e integraciones: zonas de esfuerzo y Strava"),
  body("sensors.ts ya lee el pulso cardíaco y la velocidad de rueda por Web Bluetooth en Chrome y Edge, con degradación elegante donde no hay soporte. La mejora conecta ese flujo con el motor de ride: frecuencia cardíaca en pantalla, zonas de esfuerzo calculadas por edad y una alerta por voz cuando el ciclista permanece por encima de su umbral durante más de un tiempo configurable. Es la mejora Pro más natural del listado: el hardware ya está soportado y el trabajo es de integración y presentación."),
  body("La exportación a Strava atiende a la fracción más comprometida de la base de usuarios. El historial ya exporta GPX desde history.ts y gpx.ts; la propuesta agrega dos caminos: subir el archivo directamente a Strava con su API oficial (el usuario autoriza su propia cuenta y el token queda en el dispositivo) y generar archivo FIT cuando el destino lo prefiera. Ninguno de los dos caminos pasa por servidores de Cumbre GEO, lo que mantiene la promesa de privacidad del producto."),

  h2("4.6 Experiencia y rendimiento: batería, voz y mapa de calor"),
  body("El modo de ahorro de batería reduce la frecuencia del GPS a 1 Hz, apaga el minimapa y prioriza la guía por voz cuando el nivel de batería baja de un umbral o cuando el usuario lo activa manualmente para salidas largas. Es un cambio contenido en useRideEngine.ts y RideView.tsx con efecto directo en la duración de las salidas de cumbre, que son las más largas del parque."),
  body("Los comandos por voz usan el reconocimiento de habla del navegador o del APK para consultas puntuales sin mirar la pantalla: velocidad actual, distancia recorrida o pausa del ride. Complementan la voz sintética que la 1.8.7 localizó. El mapa de calor anual, por último, pinta sobre la red del parque la intensidad de los pedaleos del año; es una vista de datos que ya existen en el historial, con valor de retención y de compartibilidad en redes sociales."),

  h2("4.7 Nube y continuidad: respaldo y restauración"),
  body("El respaldo en la nube es la apuesta estructural del plan. Hoy un cambio de teléfono o una pérdida implica reiniciar el historial, los logros y las estadísticas, porque sync.ts solo sube el ride activo y los logros nuevos. La propuesta es un respaldo cifrado de extremo a extremo: los rides se empaquetan y cifran en el dispositivo con una clave derivada de la contraseña, el servidor guarda el paquete sin poder leerlo y la restauración es explícita al iniciar sesión en un equipo nuevo. El esfuerzo es el mayor del listado porque toca el modelo de datos local, la sincronización y las pruebas de migración, pero es también el ítem de mayor valor de fidelidad a largo plazo, y conviene diseñar su esquema temprano aunque la construcción llegue en la Ola 3."),
];

const sorted = SCORES;
const tabla2Rows = sorted.map((r, i) => [
  String(i + 1), r.nombre, r.eje, String(r.impacto), String(r.esfuerzo), String(r.indice), String(r.ola),
]);

const s5 = [
  h1("5. Matriz de priorización"),
  body("La tabla 2 ordena las catorce funcionalidades por su índice de prioridad. Las cinco primeras posiciones corresponden a la Ola 1, lo que valida la estrategia de concentrar el próximo release en mejoras de seguridad, comunidad y datos personales de alto impacto y esfuerzo contenido. El respaldo en la nube ilustra el caso de alto impacto con alto esfuerzo: su índice de 5 es competitivo, pero su escala lo deja en la Ola 3 para no bloquear el resto."),
  caption("Tabla 2: Matriz de priorización (impacto y esfuerzo en escala de 1 a 5; índice = impacto × 2 − esfuerzo)"),
  dataTable(
    ["N.º", "Funcionalidad", "Eje", "Imp.", "Esf.", "Índ.", "Ola"],
    tabla2Rows,
    [8, 38, 20, 9, 9, 8, 8],
  ),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 200, after: 40 },
    children: [buildChartParagraph()],
  }),
  figCaption("Figura 1: Índice de prioridad por funcionalidad, coloreado según su ola de ejecución"),
  body("La lectura de la figura confirma tres grupos. El bloque superior (contactos ICE, moderación de incidencias y zonas de esfuerzo) combina impacto alto con esfuerzo bajo y debería encabezar la versión 1.8.8. El bloque intermedio (notificaciones, rachas, inteligencia artificial de fotos, Strava y respaldo) comparte índice 5 pero demanda capacidades distintas: buena parte necesita servidor, por eso se reparte entre las Olas 2 y 3 según su dependencia técnica. El bloque inferior (ranking, ride en vivo, comandos por voz y mapa de calor) suma valor de profundidad una vez consolidada la base."),
];

const s6 = [
  h1("6. Roadmap por olas de ejecución"),
  body("El plan se organiza en tres olas alineadas con releases concretos. Cada ola termina con un release de APK (actualizando appVersion.ts y android/app/build.gradle) y con la lista de novedades del catálogo /geo, siguiendo el proceso que ya se usó para la versión 1.8.7."),
  caption("Tabla 3: Roadmap propuesto por olas de ejecución"),
  dataTable(
    ["Ola", "Versión", "Funcionalidades incluidas", "Dependencias y riesgos"],
    [
      ["Ola 1", "v1.8.8", "Contactos ICE con alerta por caída; moderación comunitaria de incidencias; zonas de esfuerzo con sensor Bluetooth; notificaciones locales del APK; rachas de actividad; modo de ahorro de batería", "Sin dependencias externas; pruebas de permisos de mensajería en el APK; los avisos programados requieren el horario vigente del parque"],
      ["Ola 2", "v1.9.0", "Clasificación de fotos de incidencias con VLM; resumen semanal con IA; ranking de segmentos; exportación a Strava o FIT; Web Push para avisos urgentes", "Endpoints en Vercel con claves de API de uso acotado; actualización de las políticas de datos; validación antitrampa en el ranking"],
      ["Ola 3", "2.0", "Respaldo y restauración cifrados en la nube; ride en vivo compartido; comandos por voz; mapa de calor anual de pedaleos", "Diseño del esquema de sincronización y cifrado; revisión de privacidad del seguimiento en vivo; soporte de iOS cuando corresponda"],
    ],
    [9, 12, 42, 37],
  ),
  body("La Ola 1 tiene un orden de ejecución sugerido: primero los contactos ICE, porque completan la seguridad y reutilizan la detección de caída recién entregada; después la moderación de incidencias, que mejora datos existentes sin interfaces nuevas; luego las zonas de esfuerzo, las notificaciones locales, las rachas y el modo de batería. Ningún ítem de la ola bloquea a otro, por lo que pueden desarrollarse en ramas paralelas y consolidarse en una única versión.", { spacing: { line: 312, before: 160, after: 120 } }),
  body("La Ola 2 exige decisiones de plataforma antes de codificar: proveedor y presupuesto de inteligencia artificial, claves VAPID para Web Push y las reglas de validación del ranking. Se recomienda una sesión de diseño al cierre de la Ola 1 y prototipar primero la clasificación de fotos, que es la que más reduce fricción en el flujo ciudadano que Parquemet ya recibe."),
  body("La Ola 3 debe empezar por el diseño del esquema de respaldo, porque condiciona la migración de datos de todas las versiones futuras. El ride en vivo y el mapa de calor pueden prototiparse en la web sin tocar el APK, mientras que los comandos por voz dependen de la calidad del reconocimiento en español de Chile y conviene probarlos con usuarios reales antes de comprometer la funcionalidad."),
];

const s7 = [
  h1("7. Conclusiones y recomendaciones"),
  body("La aplicación parte de una base sólida: un ciclocomputador sin conexión completo, un catálogo de 33 funcionalidades y, desde hoy, seguridad activa ante caídas, avisos en vivo, constancias verificables, un canal directo con Parquemet y tres idiomas con voces. El camino para potenciarla no pasa por agregar funciones aisladas, sino por cerrar los circuitos que quedaron abiertos: la caída que aún no avisa a nadie, la incidencia que nadie confirma ni cierra, el sensor que ya se lee y todavía no se muestra, el aviso que no llega mientras la aplicación está cerrada."),
  body("Con ese criterio, las recomendaciones accionables son cuatro:"),
  bullet("Ejecutar la Ola 1 completa en la v1.8.8, con el orden sugerido en el capítulo 6, y publicarla con el mismo proceso de release y novedades de la 1.8.7."),
  bullet("Instrumentar métricas propias de uso (rides por semana, uso de incidencias, activación de sensores, idiomas elegidos) durante la Ola 1, para re-priorizar la Ola 2 con datos y no solo con estimaciones."),
  bullet("Mantener la privacidad como diferenciador: todo dato nuevo que suba al servidor debe ser opcional, mínimo y explicado en pantalla; el respaldo cifrado de la Ola 3 marca el estándar a imitar."),
  bullet("Iniciar el diseño del esquema de respaldo en la nube durante la Ola 2, aunque su construcción quede para la 2.0, porque condiciona la migración de datos futura."),
  body("Con esas cuatro acciones, Cumbre30 consolida en el corto plazo lo que ya la distingue (seguridad y autonomía) y abre, con riesgo controlado, las capacidades de comunidad, inteligencia y continuidad que sostendrán su crecimiento hacia la versión 2.0.", { spacing: { line: 312, before: 120, after: 120 } }),
];

// Figura 1 con relación de aspecto real
function buildChartParagraph() {
  const buf = fs.readFileSync(CHART_PNG);
  let w = 2000, h = 1200;
  if (imageSizeOf) {
    const d = imageSizeOf(buf);
    if (d && d.width && d.height) { w = d.width; h = d.height; }
  }
  const displayWidth = 480;
  const displayHeight = Math.round(displayWidth * (h / w));
  return new ImageRun({
    data: buf,
    transformation: { width: displayWidth, height: displayHeight },
    type: "png",
  });
}

// ── Pie de página con número (dos instancias: romano y arábigo) ──
function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
    })],
  });
}
function docHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Cumbre30 · Análisis de nuevas funcionalidades", size: 18, color: "808080", font: FONT })],
    })],
  });
}

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const coverConfig = {
  title: "Nuevas funcionalidades para potenciar Cumbre30",
  subtitle: "Análisis y roadmap de producto · versión base 1.8.7 (versionCode 33)",
  englishLabel: "CUMBRE GEO · ROADMAP 2026",
  metaLines: [
    "Producto: Cumbre30 — ciclocomputador de apoyo al ciclista",
    "Ámbito: Cerro San Cristóbal · Parque Metropolitano de Santiago",
    "Fecha: 14 de noviembre de 2026",
    "Preparado por: equipo de desarrollo Cumbre GEO",
  ],
  footerLeft: "Cumbre GEO",
  footerRight: "Documento interno de producto",
  palette: P,
};

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT, size: 32, bold: true, color: P.headings },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: FONT, size: 30, bold: true, color: P.headings },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    {
      // Sección 1: portada (margen 0, sin numeración ni pie)
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    {
      // Sección 2: índice (números romanos)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Índice", bold: true, size: 32, color: P.headings, font: FONT })],
        }),
        new TableOfContents("Tabla de contenido", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Nota: este índice se genera mediante códigos de campo. Para actualizar los números de página después de editar, haga clic derecho sobre el índice y elija Actualizar campos.",
            italics: true, size: 18, color: "888888", font: FONT,
          })],
        }),
      ],
    },
    {
      // Sección 3: cuerpo (números arábigos desde 1)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageFooter() },
      children: [...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log("OK:", OUT, buf.length, "bytes");
}).catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
