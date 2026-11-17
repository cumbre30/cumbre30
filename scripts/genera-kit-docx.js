// Kit de Redes Sociales Cumbre30 — documento editable (.docx).
// Contenido: guion del reel, piezas del kit, captions listos para
// publicar, bio, hashtags y calendario. Profile B (visual), escena
// copywriting (line 400), cover R1 con paleta FG-1 (mint, marca verde).
"use strict";
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, PageOrientation, TableLayoutType,
  SectionType,
} = require("docx");
const fs = require("fs");

// ── Paleta FG-1 (Forest Mint) + tokens de tabla ──
const P = {
  bg: "0C1F1A", accent: "3DDBB5",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  primary: "0C1F1A", body: "303030", secondary: "666666",
  tHeaderBg: "2A7A65", tHeaderText: "FFFFFF", tInnerLine: "C5D8D0", tSurface: "EDF5F2",
  highlight: "2A7A65",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Utilidades de portada (design-system.md) ──
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
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ── Cover R1 (Pure Paragraph Left) ──
function buildCoverR1(config) {
  const C = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
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
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: C.accent, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: C.cover.titleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Calibri" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Calibri" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Calibri" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: C.cover.footerColor, font: { ascii: "Calibri" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: C.cover.footerColor, font: { ascii: "Calibri" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}

// ── Helpers de cuerpo (Profile B, español, line 400) ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160, line: 400 },
    children: [new TextRun({ text, bold: true, color: P.primary, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120, line: 400 },
    children: [new TextRun({ text, bold: true, color: P.highlight, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function body(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 24, color: P.body })];
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: opts.before ?? 120, after: opts.after ?? 120, line: 400 },
    children: runs,
  });
}
function r(text, extra = {}) {
  return new TextRun({ text, size: 24, color: P.body, ...extra });
}
function rb(text) { return r(text, { bold: true, color: P.highlight }); }
function nota(text) {
  return new Paragraph({
    spacing: { before: 60, after: 160, line: 400 },
    children: [new TextRun({ text, size: 20, color: "999999", italics: true })],
  });
}
// Bloque de copy listo para copiar y pegar (borde izquierdo accent + fondo suave)
function copyBlock(lineas) {
  return lineas.map((ln, i) => new Paragraph({
    spacing: { before: i === 0 ? 120 : 0, after: i === lineas.length - 1 ? 200 : 40, line: 400 },
    indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 12 } },
    shading: { type: ShadingType.CLEAR, fill: P.tSurface },
    children: [new TextRun({ text: ln, size: 22, color: P.body })],
  }));
}
// Tabla zebra (Profile B)
function zebra(headers, rows, widths) {
  const mk = (text, bold, fill, color) => new TableCell({
    children: [new Paragraph({
      spacing: { line: 320 },
      children: [new TextRun({ text, size: 21, bold, color: color || P.body })],
    })],
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: undefined,
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.tHeaderBg },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.tHeaderBg },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.tInnerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t) => mk(t, true, P.tHeaderBg, P.tHeaderText)),
      }),
      ...rows.map((cells, idx) => new TableRow({
        cantSplit: true,
        children: cells.map((t) => mk(t, false, idx % 2 === 0 ? P.tSurface : "FFFFFF")),
      })),
    ],
  });
}
function tituloTabla(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 80, line: 400 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.secondary })],
  });
}

// ── Contenido ──
const cover = buildCoverR1({
  title: "Kit de Redes Sociales",
  subtitle: "Lanzamiento Cumbre30 v1.12.14 · Cerro San Cristóbal",
  englishLabel: "SOCIAL MEDIA KIT",
  metaLines: [
    "Cumbre GEO — cumbregeo.cl",
    "17 de noviembre de 2026",
    "Incluye: reel 24 s, 3 posts, 2 stories, avatar y kit de copy",
  ],
  footerLeft: "Cumbre30",
  footerRight: "Documento operativo de marketing",
  palette: P,
});

const contenido = [];

// 1. Objetivo y mensajes clave
contenido.push(h1("1. Objetivo y mensajes clave"));
contenido.push(body([
  r("El objetivo de esta campaña es presentar Cumbre30 a la comunidad ciclista de Santiago como "), rb("el ciclocomputador gratuito del Cerro San Cristóbal"),
  r(": una app Android que registra el pedaleo con GPS real, navega hasta los destinos del parque, acompaña el límite de 30 km/h con alertas y ahora conecta sensores Bluetooth de pulso y rueda. La pieza central es un reel vertical de 24 segundos con subtítulos quemados, acompañado de tres posts de feed, dos stories y un avatar de perfil."),
]));
contenido.push(body([
  r("Tres mensajes se repiten en todas las piezas para construir recordación. "), rb("Primero, funciona sin señal"),
  r(": mapas, rutas, GPS y alertas operan 100 % offline dentro del parque, que es exactamente donde el ciclista pierde los datos móviles. "), rb("Segundo, te cuida"),
  r(": alertas de voz, pitidos y vibración al acercarse al límite de 30 km/h, tarjeta de emergencia con SOS y avisos oficiales del parque. "), rb("Tercero, es tuyo y gratis"),
  r(": sin suscripción para el uso diario, con historial de rides, GPX y desafíos por nivel."),
]));
contenido.push(body([
  r("El tono es cercano y directo, en español chileno neutro: se habla de «tú», se nombran lugares reales del parque (Plaza México, Pío Nono, La Pirámide, Piscina Antilén) y se evita el lenguaje corporativo. Cada caption cierra con un llamado a la acción claro hacia "), rb("cumbregeo.cl"),
  r(", donde vive la descarga del APK. Todos los textos de este documento están listos para copiar y pegar; se pueden ajustar sin cambiar la estructura."),
]));

// 2. Guion del reel
contenido.push(h1("2. Guion del reel (24 segundos)"));
contenido.push(body([
  r("El reel ya está renderizado (1080×1920, 30 fps, 6 escenas con transición suave). La decisión de producción: "), rb("sin voz en off"),
  r(" — la música lleva el ritmo y los textos quemados cuentan la historia, porque la mayoría de las vistas de reels ocurren sin sonido. La banda sonora es una pista original sintetizada a 110 BPM (libre de derechos de terceros), con un crescendo que cae justo en el cierre."),
]));
contenido.push(tituloTabla("Escenas del reel — tiempo, visual y texto en pantalla"));
contenido.push(zebra(
  ["Tiempo", "Visual", "Texto en pantalla"],
  [
    ["0:00–0:04", "Fotografía: ciclista subiendo al atardecer, Santiago al fondo (imagen generada)", "¿SUBES EL CERRO EN BICI? · Hay una app para eso."],
    ["0:04–0:08", "Pantalla Ride real: velocímetro, banner y minimapa", "GPS REAL EN TU PEDALEO · Velocidad, rumbo y mapa en vivo"],
    ["0:08–0:12", "Pantalla Ride con ruta a Pío Nono y chip de ciclovía", "RUTAS HASTA TU DESTINO · Plaza México · Pío Nono · La Pirámide"],
    ["0:12–0:16", "Pantalla Ride con alerta de velocidad", "LÍMITE 30 KM/H CON ALERTAS · Voz, pitidos y vibración en el parque"],
    ["0:16–0:20", "Panel de sensores Bluetooth con pulso y rueda (novedad v1.12.14)", "TU PULSO EN PANTALLA · Sensores Bluetooth: FC y rueda"],
    ["0:20–0:24", "Fotografía: manubrio con smartphone, amanecer (imagen generada)", "PEDALEA CON CUMBRE30 · Descárgala gratis · cumbregeo.cl"],
  ],
));
contenido.push(body([
  r("Para publicar en Instagram Reels y TikTok se recomienda subir el archivo tal cual (sin recortar), escribir el caption de la sección 4 y "), rb("añadir subtítulos nativos en la plataforma solo si se ajusta el texto"),
  r(": los quemados ya son legibles. La primera escena es el hook; si se publican versiones A/B, la variante puede empezar directamente por la pantalla Ride con la frase «Tu ciclocomputador del cerro, gratis» como primer texto."),
], { before: 200 }));

// 3. Piezas incluidas
contenido.push(h1("3. Piezas incluidas en el kit"));
contenido.push(body([
  r("El kit entrega doce piezas gráficas más el video, todas en las proporciones nativas de cada formato. Las capturas de pantalla son reales de la versión 1.12.14 y las dos fotografías de ambiente se generaron con IA para el hook y el cierre del reel; ninguna pieza usa imágenes de terceros."),
]));
contenido.push(tituloTabla("Inventario de piezas y uso sugerido"));
contenido.push(zebra(
  ["Archivo", "Formato", "Uso sugerido"],
  [
    ["reel-cumbre30.mp4", "1080×1920 · 24 s · con audio", "IG Reels, TikTok y stories destacadas"],
    ["post-1-lanzamiento.png", "1080×1350 (4:5)", "Post de lanzamiento en feed (ride)"],
    ["post-2-rutas.png", "1080×1350 (4:5)", "Post de funciones: navegación"],
    ["post-3-seguridad.png", "1080×1350 (4:5)", "Post de funciones: SOS y avisos"],
    ["story-1-cerro.png", "1080×1920", "Story con sticker de enlace"],
    ["story-2-novedad.png", "1080×1920", "Story de novedades v1.12.14"],
    ["avatar.png", "1080×1080", "Foto de perfil en todas las redes"],
    ["hero-ciclista.png / hero-manubrio.png", "IA · vertical", "Fondos para piezas futuras o portadas de eventos"],
  ],
));

// 4. Captions listos para publicar
contenido.push(h1("4. Captions listos para publicar"));
contenido.push(body([
  r("Los cuatro captions principales están escritos para pegar tal cual. Se puede editar la primera línea (el hook) manteniendo el resto, y siempre conviene dejar el enlace al final o usar el sticker de enlace en stories. Los emojis son parte del copy: al pegarlos se conservan en todas las plataformas."),
]));

contenido.push(h2("4.1 Post de lanzamiento (con post-1)"));
contenido.push(...copyBlock([
  "¿Subes el Cerro San Cristóbal en bici? 🚴 Hay una app para eso.",
  "Cumbre30 es el ciclocomputador del parque: GPS real, velocidad, rumbo y mapa en vivo — y funciona sin datos móviles, justo donde los necesitas. Además te acompaña con alertas al acercarte al límite de 30 km/h.",
  "Descárgala gratis → cumbregeo.cl (link en la bio)",
  "#Cumbre30 #CerroSanCristóbal #CiclismoSantiago #ParqueMetropolitano #BikeLife #MTB #SantiagoDeChile",
]));

contenido.push(h2("4.2 Post de rutas (con post-2)"));
contenido.push(...copyBlock([
  "¿A dónde pedalamos hoy? 🗺️ Con Cumbre30 navegas hasta tu destino: Plaza México, Pío Nono, Pedro de Valdivia Norte, La Pirámide, Piscina Antilén…",
  "La ruta marca los tramos de ciclovía, avisa en cada curva y llega hasta la boca del acceso. Tu próximo ride empieza en cumbregeo.cl 📲",
  "#Cumbre30 #RutasEnBici #CerroSanCristóbal #CiclismoUrbano #SantiagoChile",
]));

contenido.push(h2("4.3 Post de seguridad (con post-3)"));
contenido.push(...copyBlock([
  "Pedalea tranquilo 🛡️ Cumbre30 te acompaña con alertas de voz, pitidos y vibración cuando te acercas a los 30 km/h dentro del parque.",
  "Suma tarjeta de emergencia con SOS, aviso a tus contactos si algo pasa, y los avisos oficiales del parque: cierres, luces y restricciones. La seguridad también se entrena → cumbregeo.cl",
  "#Cumbre30 #CiclismoSeguro #CerroSanCristóbal #BiciSantiago",
]));

contenido.push(h2("4.4 Caption del reel (IG Reels y TikTok)"));
contenido.push(...copyBlock([
  "POV: subes el cerro en bici y llevas el ciclocomputador completo en el bolsillo 🚴⛰️",
  "GPS, alertas de 30 km/h, tus zonas de pulso y rutas hasta Plaza México. Gratis para Android → cumbregeo.cl",
  "#Cumbre30 #CerroSanCristóbal #cycling #MTB #Santiago",
]));

contenido.push(h2("4.5 Post para X (Twitter)"));
contenido.push(...copyBlock([
  "Lanzamos Cumbre30 v1.12.14 🚴: minimapa con base OpenStreetMap estándar, sensores Bluetooth en el banner del ride y precisión GPS mejorada.",
  "El ciclocomputador del Cerro San Cristóbal, gratis para Android → cumbregeo.cl",
]));

// 5. Bio de perfiles
contenido.push(h1("5. Bio de perfiles"));
contenido.push(body([
  r("La bio es la primera impresión y debe caber en el límite de cada red (150 caracteres en Instagram). El formato recomendado mantiene la misma estructura en todas las cuentas: qué es, qué hace y dónde descargarla. El avatar del kit acompaña estas bios."),
]));
contenido.push(...copyBlock([
  "IG / TikTok: 🚴 El ciclocomputador del Cerro San Cristóbal · GPS, rutas y alertas 30 km/h · Gratis en Android 👇",
  "X (Twitter): El ciclocomputador del Cerro San Cristóbal. GPS, rutas, alertas de 30 km/h y tu pulso en pantalla. Gratis para Android → cumbregeo.cl",
  "Facebook (descripción corta): App gratuita de ciclismo para el Parque Metropolitano de Santiago: GPS, rutas y alertas de seguridad. Descarga en cumbregeo.cl",
]));

// 6. Hashtags
contenido.push(h1("6. Sets de hashtags"));
contenido.push(body([
  r("Se manejan tres sets combinables: los de marca siempre van, los temáticos rotan según el foco del post y los locales anclan la búsqueda en Santiago. Se recomienda no repetir el mismo bloque completo en cada publicación para evitar que el algoritmo lo lea como spam; intercambiar dos o tres hashtags entre el set temático y el local es suficiente."),
]));
contenido.push(...copyBlock([
  "Marca (siempre): #Cumbre30 #CumbreGEO",
  "Parque y ciclismo: #CerroSanCristóbal #ParqueMetropolitano #CiclismoSantiago #BikeLife #MTBChile #Ciclovía",
  "Locales: #SantiagoDeChile #Providencia #Recoleta #PedaleaSantiago",
]));

// 7. Calendario
contenido.push(h1("7. Calendario de publicación (10 días)"));
contenido.push(body([
  r("El calendario arranca el miércoles 18 de noviembre con el reel y el post de lanzamiento en horario de mayor actividad (tarde-noche), y luego alterna funciones del producto, stories de refuerzo y una segunda ola del reel. Los horarios son sugeridos y se pueden ajustar según las métricas de la primera semana."),
]));
contenido.push(tituloTabla("Plan de publicación — 18 al 27 de noviembre de 2026"));
contenido.push(zebra(
  ["Fecha", "Pieza", "Canal", "Hora", "Objetivo"],
  [
    ["Mié 18", "Reel (24 s)", "IG Reels + TikTok", "18:30", "Lanzamiento y alcance"],
    ["Mié 18", "post-1 lanzamiento", "IG feed + Facebook", "19:15", "Presentar la app"],
    ["Jue 19", "story-1 cerro", "IG Stories", "12:30", "Recordatorio con enlace"],
    ["Vie 20", "post-2 rutas", "IG feed", "12:45", "Función navegación"],
    ["Sáb 21", "Post X de lanzamiento", "X (Twitter)", "10:00", "Comunidad ciclista"],
    ["Dom 22", "story-2 novedad v1.12.14", "IG Stories", "17:00", "Novedades del release"],
    ["Lun 23", "post-3 seguridad", "IG feed + Facebook", "20:15", "Función SOS y avisos"],
    ["Mar 24", "Reel (segunda ola)", "IG Reels + TikTok", "18:30", "Reimpactar con otro caption"],
    ["Mié 25", "Interacción con la comunidad", "Todas las redes", "19:00", "Responder y compartir rides con #Cumbre30"],
    ["Jue 26", "post-2 rotado con nuevo hook", "IG feed", "12:45", "Sostener la frecuencia semanal"],
  ],
));

// 8. Recomendaciones
contenido.push(h1("8. Recomendaciones de publicación"));
contenido.push(body([
  r("Sobre el video: no recortar el reel — los textos quemados están alineados al marco 9:16 y el audio termina con un golpe suave que cierra el mensaje. Si la plataforma exige portada, usar el primer frame (ciclista con Santiago de fondo). La pista musical es original y sintetizada, por lo que el reel puede monetizarse sin reclamos de derechos."),
]));
contenido.push(body([
  r("Sobre las métricas: en las primeras 48 horas conviene mirar tres señales — retención a los 3 segundos (calidad del hook), compartidos (afinidad de la comunidad) y clics al enlace de la bio (intención de descarga). Si la retención cae antes del segundo 4, la variante A/B del hook es el primer ajuste a probar; si los clics son bajos con buen alcance, conviene reforzar el sticker de enlace en las stories en vez de repetir el feed."),
]));
contenido.push(body([
  r("Sobre el contenido futuro: las dos imágenes generadas quedan disponibles como fondos para piezas de eventos (por ejemplo, el Día del Ciclista o los desafíos del parque), y las capturas de pantalla se pueden regenerar fácilmente con el mismo procedimiento cada vez que salga una versión con funciones nuevas, manteniendo el kit siempre al día con la app real."),
]));

// ── Documento ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: P.body },
        paragraph: { spacing: { line: 400 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 400, after: 160, line: 400 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 28, bold: true, color: P.highlight },
        paragraph: { spacing: { before: 280, after: 120, line: 400 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: cover,
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Kit de Redes Sociales — Cumbre30", size: 18, color: "888888" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })],
          })],
        }),
      },
      children: contenido,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/kit-redes-cumbre30/kit-textos-cumbre30.docx";
  fs.writeFileSync(out, buf);
  console.log("DOCX_OK", out, buf.length, "bytes");
});
