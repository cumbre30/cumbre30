// Informe de Fase B — Rutas y Comunidad Ciclista — Cumbre30
// Genera download/Fase_B_creacion_edicion_rutas_Cumbre30.docx
// Ensamblaje: helpers probados (receta R1 + FG-1) + contenido de fase-b-contenido.js
const fs = require("fs");
const docx = require("docx");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, SectionType, TableOfContents, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, TableLayoutType,
} = docx;

// ---------- Helpers (copiados del generador v2.1 probado) ----------
const COVER = {
  bg: "0C1F1A", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
  metaColor: "90989F", accent: "3DDBB5", footerColor: "687078",
};
const T = { headerBg: "2A7A65", headerText: "FFFFFF", accentLine: "2A7A65", innerLine: "C5D8D0", surface: "EDF5F2" };
const PRIMARY = "173F35";
const BODY = "000000";
const GRAY = "808080";
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

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
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: { top: NB, bottom: NB, left: NB, right: NB }, verticalAlign: "top",
        children,
      })],
    })],
  })];
}

const FONT = { ascii: "Times New Roman" };
function h1(text) {
  return new Paragraph({
    heading: docx.HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: PRIMARY, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: docx.HeadingLevel.HEADING_2,
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
// ---------- Contenido: informe de fase B ----------
const evalContenido = new Function("h1", "h2", "p", "bullet", "tableTitle", "dataTable", "docx",
  fs.readFileSync(__dirname + "/fase-b-contenido.js", "utf8") + "\n; return { bodyChildren };");
const { bodyChildren } = evalContenido(h1, h2, p, bullet, tableTitle, dataTable, docx);

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
    children: [new TextRun({ text: "Cumbre30 · Rutas y Comunidad Ciclista — Informe de fase B", size: 18, color: GRAY, font: FONT })],
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
        title: "Fase B Completada",
        subtitle: "Rutas y Comunidad Ciclista · Creación y edición — editor de rutas, borradores y export GPX",
        englishLabel: "CUMBRE30",
        metaLines: [
          "Producto: Cumbre30 · web cumbregeo.cl + APK Android (Vercel + Neon)",
          "Arquitectura: v2.1 aprobada · fase A aplicada en producción (2026-11-21) · release v1.15.0 (code 75) preparado",
          "Documento: entrega fase B — suite 33 verificaciones + prueba in-vivo en navegador real",
          "Estado: para verificación del cliente — al aprobar inicia la fase C",
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
            text: "Nota: este índice se genera mediante códigos de campo. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos».",
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
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/Fase_B_creacion_edicion_rutas_Cumbre30.docx";
  fs.writeFileSync(out, buf);
  console.log("OK", out, buf.length, "bytes");
});
