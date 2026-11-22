// ============================================================
// helpers.mjs - constructores de estilos para el informe de
// auditoría (docx). Perfil A formal, español: cuerpo TNR 12pt
// negro, encabezados TNR bold con acento DM-1 oscurecido.
// ============================================================
import {
  Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
} from "docx";
import fs from "fs";
import * as sizeOfMod from "image-size";

export const P = {
  heading: "1B6B7A", // DM-1 oscurecido (regla dark-cover → light-table)
  body: "000000",
  secondary: "5A6B70",
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", innerLine: "C8DDE2", surface: "EDF3F5" },
  cover: {
    bg: "162235", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
    metaColor: "90989F", accent: "37DCF2", footerColor: "687078",
  },
};

const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const FONT_MONO = { ascii: "Courier New", eastAsia: "Courier New" };

export const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
export const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };

// ---------- encabezados ----------
export function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 30, color: P.heading, font: FONT })],
  });
}
export function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 26, color: P.heading, font: FONT })],
  });
}
export function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: P.body, font: FONT })],
  });
}

// ---------- cuerpo ----------
export function body(runsOrText, opts = {}) {
  const runs = typeof runsOrText === "string"
    ? [new TextRun({ text: runsOrText, size: 24, color: P.body, font: FONT })]
    : runsOrText;
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after ?? 120 },
    children: runs,
  });
}
export function r(text, o = {}) {
  return new TextRun({ text, size: o.size ?? 24, bold: o.bold ?? false,
    italics: o.italics ?? false, color: o.color ?? P.body, font: o.mono ? FONT_MONO : FONT });
}
/** Referencia de evidencia en línea (archivo · símbolo · líneas). */
export function ev(text) {
  return new TextRun({ text, size: 20, italics: true, color: P.secondary, font: FONT_MONO });
}
export function bullet(runsOrText, level = 0) {
  const runs = typeof runsOrText === "string"
    ? [new TextRun({ text: runsOrText, size: 24, color: P.body, font: FONT })]
    : runsOrText;
  return new Paragraph({ bullet: { level }, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 60 }, children: runs });
}

// ---------- tablas ----------
function cellPara(text, { bold = false, size = 19, color = P.body, mono = false, align = AlignmentType.LEFT } = {}) {
  return new Paragraph({
    alignment: align, spacing: { line: 276 },
    children: [new TextRun({ text: String(text), bold, size, color, font: mono ? FONT_MONO : FONT })],
  });
}

export function dataTable(headers, rows, widths, { size = 19, headerSize = 19 } = {}) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((t, i) => new TableCell({
      children: [cellPara(t, { bold: true, size: headerSize, color: P.table.headerText })],
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((t, i) => new TableCell({
      children: [cellPara(t, { size })],
      shading: ri % 2 === 0
        ? { type: ShadingType.CLEAR, fill: P.table.surface }
        : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 45, bottom: 45, left: 90, right: 90 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.headerBg },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.headerBg },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}

export function tableTitle(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 20, color: P.heading, font: FONT })],
  });
}

// ---------- figuras ----------
export function figure(pngPath, caption, displayWidth = 560) {
  const buf = fs.readFileSync(pngPath);
  const dims = (sizeOfMod.imageSize ?? sizeOfMod.default ?? sizeOfMod)(buf);
  const displayHeight = Math.round(displayWidth * (dims.height / dims.width));
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ data: buf, transformation: { width: displayWidth, height: displayHeight }, type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 160, line: 276 },
      children: [new TextRun({ text: caption, italics: true, size: 18, color: P.secondary, font: FONT })],
    }),
  ];
}

// ---------- portada R1 (receta validada, adaptada a texto latino) ----------
function estimateTextWidth(text, pt) {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const isCJK = code >= 0x2e80;
    w += isCJK ? pt * 20 : pt * 11;
  }
  return w;
}
function splitLatinTitle(title, maxWidthTw, pt) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (estimateTextWidth(cand, pt) <= maxWidthTw || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 1 && lines[lines.length - 1].length <= 4) {
    const last = lines.pop();
    lines[lines.length - 1] += ` ${last}`;
  }
  return lines;
}
export function calcTitleLayout(title, maxWidthTw, preferredPt = 40, minPt = 24) {
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    lines = splitLatinTitle(title, maxWidthTw, titlePt);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitLatinTitle(title, maxWidthTw, minPt); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = params;
  const SAFETY = 1200;
  const usable = pageHeight - SAFETY;
  const contentH = titleLineCount * (titlePt * 23 + 200)
    + (hasSubtitle ? (12 * 23 + 600) : 0)
    + (hasEnglishLabel ? (9 * 23 + 600) : 0)
    + metaLineCount * (10 * 23 + 100)
    + fixedHeight + 3 * 300;
  const remaining = Math.max(usable - contentH, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(remaining * 0.45);
  const rawBottom = Math.floor(remaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}
export function buildCoverR1(config) {
  const C = P.cover;
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
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18,
        color: C.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: C.titleColor,
        font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: C.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: C.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: "fixed",
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
