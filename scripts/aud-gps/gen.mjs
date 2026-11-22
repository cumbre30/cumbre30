// ============================================================
// gen.mjs - ensambla AUDITORÍA DE BRECHAS DEL MOTOR GPS - CUMBRE30
// Estructura: portada R1 (DM-1) · índice (sin numeración) · cuerpo
// vertical (1-3 y 4 intro) · matriz horizontal (4) · cuerpo vertical
// (5-13 + anexo). Postfijo: parche de instrText de página.
// ============================================================
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, PageNumber, NumberFormat, SectionType, PageOrientation,
  TableOfContents,
} from "docx";
import fs from "fs";
import { P, buildCoverR1, h1 } from "./helpers.mjs";
import { seccion1, seccion2, seccion3 } from "./contenido1.mjs";
import { seccion4Intro, seccion4Landscape, seccion5, seccion6, seccion7, seccion8 } from "./contenido2.mjs";
import { seccion9, seccion10, seccion11, seccion12, seccion13, anexo } from "./contenido3.mjs";

const OUT = "/home/z/my-project/download/Auditoria_Brechas_Motor_GPS_Cumbre30.docx";

const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const pgSizePortrait = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function headerBar() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Auditoría de brechas del motor GPS — Cumbre30", size: 18, color: "808080", font: FONT })],
    })],
  });
}
function footerNum() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
    })],
  });
}

// ---------- portada ----------
const cover = buildCoverR1({
  title: "Auditoría de Brechas del Motor GPS",
  subtitle: "Cumbre30 — diagnóstico técnico integral y hoja de ruta hacia un ciclocomputador profesional",
  englishLabel: "GPS ENGINE GAP AUDIT",
  metaLines: [
    "Producto: Cumbre30 (APK Android + web)",
    "Motor auditado: useRideEngine + RideLocationService + pipeline de métricas",
    "Versión auditada: v1.22.0 (code 83) · 2026-11-22",
    "Modalidad: inspección estática de código, sin modificaciones",
  ],
  footerLeft: "Informe técnico interno",
  footerRight: "Noviembre 2026",
});

// ---------- índice ----------
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Índice", bold: true, size: 32, font: FONT, color: P.heading })],
  }),
  new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Nota: este índice se genera mediante campos de Word. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos» para refrescar la numeración de páginas.",
      italics: true, size: 18, color: "888888", font: FONT,
    })],
  }),
  // Sin PageBreak final: el cuerpo siguiente es una sección NEXT_PAGE
  // propia; un salto adicional provocaría página en blanco.
];

// ---------- cuerpo ----------
const cuerpo1 = [...seccion1(), ...seccion2(), ...seccion3(), ...seccion4Intro()];
const matriz = seccion4Landscape();
const cuerpo2 = [...seccion5(), ...seccion6(), ...seccion7(), ...seccion8(), ...seccion9(), ...seccion10(), ...seccion11(), ...seccion12(), ...seccion13(), ...anexo()];

const doc = new Document({
  creator: "Cumbre30",
  title: "Auditoría de Brechas del Motor GPS — Cumbre30",
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT, size: 30, bold: true, color: P.heading },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: FONT, size: 26, bold: true, color: P.heading },
        paragraph: { spacing: { before: 260, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: FONT, size: 24, bold: true, color: "000000" },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // 1) Portada — margen 0, sin numeración ni encabezado
    {
      properties: { page: { size: pgSizePortrait, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: cover,
    },
    // 2) Índice — sección propia, sin número de página (regla opcional del scene report)
    {
      properties: { type: SectionType.NEXT_PAGE, page: { size: pgSizePortrait, margin: pgMargin } },
      children: tocChildren,
    },
    // 3) Cuerpo vertical (secciones 1-3 + intro de la 4) — arábigos desde 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSizePortrait, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: headerBar() },
      footers: { default: footerNum() },
      children: cuerpo1,
    },
    // 4) Matriz horizontal (sección 4) — numeración continúa
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          // docx-js intercambia ancho/alto cuando orientation=LANDSCAPE:
          // se pasa la base A4 vertical y el resultado XML es horizontal.
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 1100, bottom: 1100, left: 1300, right: 1300 },
        },
      },
      headers: { default: headerBar() },
      footers: { default: footerNum() },
      children: matriz,
    },
    // 5) Cuerpo vertical (secciones 5-13 + anexo) — numeración continúa
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSizePortrait, margin: pgMargin },
      },
      headers: { default: headerBar() },
      footers: { default: footerNum() },
      children: cuerpo2,
    },
  ],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log("DOCX generado:", OUT, buf.length, "bytes");
