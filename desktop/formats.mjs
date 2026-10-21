import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { randomUUID } from "node:crypto";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";
import XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  removeNSPrefix: true,
});
const array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const flatten = (v) =>
  typeof v === "string" || typeof v === "number"
    ? String(v)
    : v && typeof v === "object"
      ? Object.entries(v)
          .filter(([k]) => !k.startsWith("@_"))
          .map(([, x]) => flatten(x))
          .join("")
      : "";
const MAX = 128 * 1024 * 1024;
export async function safeZip(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files);
  if (
    files.length > 20000 ||
    files.some(
      (f) =>
        f.name.includes("..") ||
        f.name.includes("\\") ||
        f.name.startsWith("/") ||
        (f.unsafeOriginalName && f.unsafeOriginalName !== f.name),
    ) ||
    files.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > MAX
  )
    throw Error("E102 · Unsafe or oversized document archive.");
  return zip;
}
export async function makeDocx({
  kind = "document",
  title = "Untitled",
  text = "",
  brandName = "",
  author = "",
}) {
  const h = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
  const p = (t) => new Paragraph({ children: [new TextRun(t)] });
  const blocks = text
    ? text.split(/\r?\n/).map(p)
    : {
        document: [h(title), p("")],
        advertisement: [
          h("Your headline"),
          p("Describe what you offer and why it matters."),
          h("Offer details"),
          p("Add a price, dates and terms."),
          h("Get in touch"),
          p("Add your contact information and call to action."),
        ],
        newsletter: [
          h(title === "Untitled" ? "Your newsletter" : title),
          p("Edition and publication date"),
          h("Top story"),
          p("Write your lead story here."),
          h("News and updates"),
          p("Add a second story or update."),
          h("What is next"),
          p("Add upcoming dates and contact details."),
        ],
        cv: [
          h("Your name"),
          p("Email | Phone | Location | Portfolio"),
          h("Profile"),
          p("Summarise your experience and strengths."),
          h("Experience"),
          p("Role | Organisation | Dates"),
          p("Describe achievements with evidence."),
          h("Education"),
          p("Qualification | Institution | Dates"),
          h("Skills"),
          p("Add skills relevant to the position."),
        ],
        "cover-letter": [
          p("Your name and contact details"),
          p("Date"),
          p("Recipient name, organisation and address"),
          p("Dear [recipient],"),
          p("Identify the role and explain why you are applying."),
          p("Describe relevant experience with specific evidence."),
          p("Explain your interest in the organisation and offer a next step."),
          p("Yours sincerely,"),
          p("Your name"),
        ],
      }[kind] || [h(title), p("")];
  const document = new Document({
    creator: author || "TMApps",
    title,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { after: 160 } },
        },
      },
    },
    sections: [
      {
        headers: { default: new Header({ children: [p(brandName)] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ children: ["Page ", PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: blocks,
      },
    ],
  });
  return (await Packer.toBuffer(document)).toString("base64");
}
export async function inspectDocx(binary) {
  const zip = await safeZip(Buffer.from(binary, "base64"));
  if (!zip.file("word/document.xml"))
    throw Error("E102 · This is not a DOCX document.");
  const warnings = [];
  const names = Object.keys(zip.files);
  if (names.some((n) => /vba|embeddings|activeX/i.test(n)))
    warnings.push(
      "Embedded objects, ActiveX and macros are not executed. Keep the original file.",
    );
  if (names.some((n) => /chart|diagram|vmlDrawing/i.test(n)))
    warnings.push(
      "Charts, diagrams and legacy drawings need visual review after export.",
    );
  const xml = await zip.file("word/document.xml").async("string");
  if (/<w:(altChunk|sdt|object)\b/.test(xml))
    warnings.push(
      "Advanced content controls or embedded content may not be editable. Export a copy and compare with the original.",
    );
  return warnings;
}
export async function importSheet(binary, extension) {
  const bytes = Buffer.from(binary, "base64");
  if (extension === "xlsx") await safeZip(bytes);
  const warnings = [
    "Macros, pivot tables, external connections and advanced charts are not supported. Keep the original workbook.",
  ];
  const workbook = {
    id: randomUUID(),
    name: "Workbook",
    appVersion: "1.0",
    locale: "enUS",
    sheetOrder: [],
    sheets: {},
    styles: {},
  };
  if (extension === "csv" || extension === "tsv") {
    const parsed = XLSX.read(bytes.toString("utf8"), {
      type: "string",
      FS: extension === "tsv" ? "\t" : ",",
    });
    for (const name of parsed.SheetNames) {
      const id = randomUUID();
      const rows = XLSX.utils.sheet_to_json(parsed.Sheets[name], {
        header: 1,
        raw: true,
      });
      const cellData = {};
      rows.forEach((row, r) => {
        cellData[r] = {};
        row.forEach(
          (v, c) => (cellData[r][c] = { v, t: typeof v === "number" ? 2 : 1 }),
        );
      });
      workbook.sheetOrder.push(id);
      workbook.sheets[id] = {
        id,
        name,
        rowCount: Math.max(1000, rows.length + 50),
        columnCount: 30,
        cellData,
      };
    }
    return { workbook, warnings: [] };
  }
  const excel = new ExcelJS.Workbook();
  await excel.xlsx.load(bytes);
  let total = 0;
  for (const sheet of excel.worksheets) {
    const id = randomUUID(),
      cellData = {},
      rowData = {},
      columnData = {};
    sheet.eachRow({ includeEmpty: false }, (row, r) => {
      if (r > 100000)
        throw Error("E102 · Workbook exceeds 100,000 rows per sheet.");
      cellData[r - 1] = {};
      if (row.height) rowData[r - 1] = { h: (row.height * 4) / 3 };
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (++total > 1000000 || c > 16384)
          throw Error(
            "E102 · Workbook exceeds the supported populated-cell limit.",
          );
        const raw = cell.value;
        let v = raw,
          f;
        if (raw && typeof raw === "object") {
          if (raw.formula) {
            f = "=" + raw.formula;
            v = raw.result ?? null;
          } else if (raw.sharedFormula) {
            f = cell.formula ? "=" + cell.formula : undefined;
            v = raw.result ?? null;
          } else if (raw.richText) v = raw.richText.map((t) => t.text).join("");
          else if (raw.text) v = raw.text;
          else if (raw.error) v = raw.error;
          else if (raw instanceof Date)
            v = (raw.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
          else v = String(cell.text);
        }
        const s = {};
        if (cell.font) {
          if (cell.font.name) s.ff = cell.font.name;
          if (cell.font.size) s.fs = cell.font.size;
          if (cell.font.bold) s.bl = 1;
          if (cell.font.italic) s.it = 1;
          if (cell.font.color?.argb)
            s.cl = { rgb: "#" + cell.font.color.argb.slice(-6) };
        }
        if (cell.fill?.fgColor?.argb)
          s.bg = { rgb: "#" + cell.fill.fgColor.argb.slice(-6) };
        if (cell.numFmt) s.n = { pattern: cell.numFmt };
        const styleId = randomUUID();
        workbook.styles[styleId] = s;
        cellData[r - 1][c - 1] = {
          v: v ?? null,
          t: typeof v === "number" ? 2 : typeof v === "boolean" ? 3 : 1,
          ...(f ? { f } : {}),
          s: styleId,
        };
      });
    });
    for (let c = 1; c <= sheet.columnCount; c++) {
      const column = sheet.getColumn(c);
      if (column.width) columnData[c - 1] = { w: column.width * 7 };
    }
    const mergeData = (sheet.model.merges || []).map((m) => {
      const r = XLSX.utils.decode_range(m);
      return {
        startRow: r.s.r,
        endRow: r.e.r,
        startColumn: r.s.c,
        endColumn: r.e.c,
      };
    });
    workbook.sheetOrder.push(id);
    workbook.sheets[id] = {
      id,
      name: sheet.name,
      rowCount: Math.max(1000, sheet.rowCount + 50),
      columnCount: Math.max(26, sheet.columnCount + 5),
      cellData,
      rowData,
      columnData,
      mergeData,
    };
  }
  if (!workbook.sheetOrder.length)
    throw Error("E102 · Workbook has no worksheets.");
  return { workbook, warnings };
}
export async function exportSheet(workbook, extension) {
  const book = new ExcelJS.Workbook();
  for (const id of workbook.sheetOrder) {
    const s = workbook.sheets[id];
    const sheet = book.addWorksheet(s.name);
    for (const [r, row] of Object.entries(s.cellData || {}))
      for (const [c, data] of Object.entries(row)) {
        if (!data) continue;
        const cell = sheet.getCell(Number(r) + 1, Number(c) + 1);
        cell.value = data.f
          ? { formula: data.f.replace(/^=/, ""), result: data.v ?? undefined }
          : (data.v ?? null);
        const style =
          typeof data.s === "object" ? data.s : workbook.styles?.[data.s] || {};
        cell.font = {
          name: style.ff || "Calibri",
          size: style.fs || 11,
          bold: !!style.bl,
          italic: !!style.it,
          ...(style.cl?.rgb
            ? { color: { argb: "FF" + style.cl.rgb.replace("#", "") } }
            : {}),
        };
        if (style.bg?.rgb)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF" + style.bg.rgb.replace("#", "") },
          };
        if (style.n?.pattern) cell.numFmt = style.n.pattern;
      }
    for (const m of s.mergeData || [])
      sheet.mergeCells(
        m.startRow + 1,
        m.startColumn + 1,
        m.endRow + 1,
        m.endColumn + 1,
      );
    for (const [c, d] of Object.entries(s.columnData || {}))
      if (d.w) sheet.getColumn(Number(c) + 1).width = d.w / 7;
    for (const [r, d] of Object.entries(s.rowData || {}))
      if (d.h) sheet.getRow(Number(r) + 1).height = (d.h * 3) / 4;
  }
  if (extension === "csv" || extension === "tsv")
    return Buffer.from(
      await book.csv.writeBuffer({
        sheetId: book.worksheets[0].id,
        formatterOptions: { delimiter: extension === "tsv" ? "\t" : "," },
      }),
    );
  book.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function exportSlides(payload) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: "Libraries",
    width: payload.width / 96,
    height: payload.height / 96,
  });
  pptx.layout = "Libraries";
  pptx.author = "TMApps";
  for (const source of payload.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: source.background.replace("#", "") };
    slide.addNotes(source.notes || "");
    for (const e of source.elements) {
      const options = { x: e.x / 96, y: e.y / 96, w: e.w / 96, h: e.h / 96 };
      if (e.type === "text")
        slide.addText(e.text || "", {
          ...options,
          fontFace: e.font || "Arial",
          fontSize: e.fontSize || 28,
          color: (e.colour || "#222222").replace("#", ""),
          bold: !!e.bold,
          hyperlink: e.link ? { url: e.link } : undefined,
          breakLine: false,
          margin: 0,
        });
      else if (e.type === "image") slide.addImage({ ...options, data: e.data });
      else if (e.type === "shape")
        slide.addShape(pptx.ShapeType.rect, {
          ...options,
          fill: { color: (e.colour || "#97572B").replace("#", "") },
          line: { color: (e.colour || "#97572B").replace("#", "") },
        });
      else if (e.type === "table")
        slide.addTable(
          e.rows || [
            ["Column 1", "Column 2"],
            ["Value", "Value"],
          ],
          { ...options, fontSize: 16, border: { pt: 1, color: "999999" } },
        );
      else if (e.type === "chart")
        slide.addChart(
          pptx.ChartType.bar,
          [
            {
              name: "Series",
              labels: e.labels || ["A", "B", "C"],
              values: e.values || [2, 5, 3],
            },
          ],
          options,
        );
      else if (["audio", "video"].includes(e.type))
        slide.addMedia({
          ...options,
          type: e.type,
          data: e.data,
          ext: e.extension,
        });
    }
  }
  return Buffer.from(await pptx.write({ outputType: "nodebuffer" }));
}
export async function importSlides(binary) {
  const zip = await safeZip(Buffer.from(binary, "base64"));
  const presentation = parser.parse(
    (await zip.file("ppt/presentation.xml")?.async("string")) || "",
  );
  if (!presentation.presentation) throw Error("E102 · Invalid PPTX file.");
  const size = presentation.presentation.sldSz;
  const width = Number(size?.["@_cx"] || 12192000) / 9525,
    height = Number(size?.["@_cy"] || 6858000) / 9525;
  const warnings = new Set([
    "Only basic text, pictures and rectangle shapes are imported. Review unsupported objects against the original.",
  ]);
  const slides = [];
  const entries = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort(
      (a, b) =>
        Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]),
    );
  if (entries.length > 1000) throw Error("E102 · Too many slides.");
  for (const name of entries) {
    const xml = await zip.file(name).async("string");
    const parsed = parser.parse(xml).sld;
    const relPath = name.replace("slides/", "slides/_rels/") + ".rels";
    const relationships = {};
    const rel = zip.file(relPath);
    if (rel)
      for (const r of array(
        parser.parse(await rel.async("string")).Relationships?.Relationship,
      ))
        relationships[r["@_Id"]] = r;
    const elements = [];
    for (const sp of array(parsed?.cSld?.spTree?.sp)) {
      const transform = sp.spPr?.xfrm;
      const off = transform?.off || {},
        ext = transform?.ext || {};
      const geometry = {
        x: Number(off["@_x"] || 0) / 9525,
        y: Number(off["@_y"] || 0) / 9525,
        w: Number(ext["@_cx"] || 3000000) / 9525,
        h: Number(ext["@_cy"] || 600000) / 9525,
      };
      const content = array(sp.txBody?.p)
        .map(
          (p) =>
            array(p.r)
              .map((r) => flatten(r.t))
              .join("") + (p.fld ? flatten(p.fld.t) : ""),
        )
        .join("\n");
      if (content)
        elements.push({
          id: randomUUID(),
          type: "text",
          text: content,
          ...geometry,
          fontSize: 28,
          colour: "#222222",
        });
      else if (sp.spPr?.prstGeom)
        elements.push({
          id: randomUUID(),
          type: "shape",
          ...geometry,
          colour: "#97572B",
        });
    }
    for (const pic of array(parsed?.cSld?.spTree?.pic)) {
      const embed = pic.blipFill?.blip?.["@_embed"];
      const r = relationships[embed];
      if (!r || r["@_TargetMode"] === "External") {
        warnings.add("External pictures were not fetched.");
        continue;
      }
      const resource = pathResolvePpt(name, r["@_Target"]);
      const file = zip.file(resource);
      if (!file) continue;
      const extension = resource.split(".").pop();
      if (!["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
        warnings.add("An unsupported image format was skipped.");
        continue;
      }
      const t = pic.spPr?.xfrm;
      elements.push({
        id: randomUUID(),
        type: "image",
        data: `data:image/${extension === "jpg" ? "jpeg" : extension};base64,${await file.async("base64")}`,
        x: Number(t?.off?.["@_x"] || 0) / 9525,
        y: Number(t?.off?.["@_y"] || 0) / 9525,
        w: Number(t?.ext?.["@_cx"] || 2000000) / 9525,
        h: Number(t?.ext?.["@_cy"] || 2000000) / 9525,
      });
    }
    if (parsed?.timing || parsed?.transition)
      warnings.add(
        "Imported animation and transitions require manual recreation.",
      );
    if (parsed?.cSld?.spTree?.graphicFrame)
      warnings.add(
        "Imported charts, tables, diagrams or embedded objects were not converted.",
      );
    slides.push({
      id: randomUUID(),
      background: "#ffffff",
      notes: "",
      transition: "none",
      elements,
    });
  }
  if (!slides.length) throw Error("E102 · Presentation has no slides.");
  return { payload: { width, height, slides }, warnings: [...warnings] };
}
function pathResolvePpt(name, target) {
  const parts = name.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}
let pdfModule;
async function pdf() {
  return (pdfModule ??= await import("mupdf"));
}
function outputPdf(doc) {
  const buffer = doc.saveToBuffer("garbage=4,compress=yes,clean=yes");
  try {
    return Buffer.from(buffer.asUint8Array()).toString("base64");
  } finally {
    buffer.destroy();
  }
}
export async function pdfOperation(args) {
  const m = await pdf();
  const doc = args.binary
    ? m.Document.openDocument(
        Buffer.from(args.binary, "base64"),
        "application/pdf",
      )
    : new m.PDFDocument();
  try {
    if (!(doc instanceof m.PDFDocument)) throw Error("E102 · Invalid PDF.");
    doc.disableJS();
    if (doc.needsPassword())
      throw Error(
        "E102 · Password-protected PDF import is not supported in this build.",
      );
    if (!args.binary) {
      const font = doc.addSimpleFont(new m.Font("Helvetica"));
      const page = doc.addPage(
        [0, 0, 595, 842],
        0,
        { Font: { F1: font } },
        "BT /F1 24 Tf 50 780 Td (New PDF document) Tj ET",
      );
      doc.insertPage(-1, page);
      return { binary: outputPdf(doc) };
    }
    if (doc.countPages() > 2000) throw Error("E102 · PDF exceeds 2,000 pages.");
    if (args.operation === "info")
      return {
        pages: doc.countPages(),
        text: Array.from({ length: doc.countPages() }, (_, i) => {
          const p = doc.loadPage(i);
          try {
            const t = p.toStructuredText();
            try {
              return t.asText();
            } finally {
              t.destroy();
            }
          } finally {
            p.destroy();
          }
        }),
      };
    if (args.operation === "render") {
      const page = doc.loadPage(args.page || 0);
      try {
        const bounds = page.getBounds();
        const scale = Math.min(1.5, 1000 / (bounds[2] - bounds[0]));
        const pix = page.toPixmap(
          m.Matrix.scale(scale, scale),
          m.ColorSpace.DeviceRGB,
          false,
          true,
        );
        try {
          return {
            png: Buffer.from(pix.asPNG()).toString("base64"),
            width: bounds[2] - bounds[0],
            height: bounds[3] - bounds[1],
          };
        } finally {
          pix.destroy();
        }
      } finally {
        page.destroy();
      }
    }
    if (args.operation === "rotate") {
      const page = doc.findPage(args.page);
      const rotation = page.get("Rotate").asNumber() || 0;
      page.put("Rotate", (rotation + 90) % 360);
    }
    if (args.operation === "order") {
      if (
        !Array.isArray(args.pages) ||
        !args.pages.length ||
        args.pages.some(
          (p) => !Number.isInteger(p) || p < 0 || p >= doc.countPages(),
        )
      )
        throw Error("E102 · Invalid page selection.");
      doc.rearrangePages(args.pages);
    }
    if (args.operation === "merge") {
      const other = m.Document.openDocument(
        Buffer.from(args.other, "base64"),
        "application/pdf",
      );
      try {
        if (other.needsPassword())
          throw Error("E102 · The second PDF is password protected.");
        for (let i = 0; i < other.countPages(); i++)
          doc.graftPage(-1, other, i);
      } finally {
        other.destroy();
      }
    }
    if (
      ["annotation", "redact", "signature", "form"].includes(args.operation)
    ) {
      const page = doc.loadPage(args.page || 0);
      try {
        if (args.operation === "form") {
          const fields = page.getWidgets();
          const widget = fields.find((w) => w.getName() === args.name);
          if (!widget) throw Error("E102 · Form field not found.");
          widget.setTextValue(String(args.text || ""));
          widget.update();
        } else if (args.operation === "signature") {
          const annot = page.createAnnotation("Ink");
          annot.setInkList([args.points]);
          annot.setColor([0.2, 0.15, 0.1]);
          annot.setBorderWidth(2);
          annot.update();
        } else {
          const annot = page.createAnnotation(
            args.operation === "redact" ? "Redact" : args.type || "FreeText",
          );
          annot.setRect(args.rect);
          if (args.operation === "redact") {
            annot.setColor([0, 0, 0]);
            annot.update();
            page.applyRedactions(
              true,
              m.PDFPage.REDACT_IMAGE_REMOVE,
              m.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED,
              m.PDFPage.REDACT_TEXT_REMOVE,
            );
          } else {
            annot.setContents(String(args.text || ""));
            annot.setDefaultAppearance("Helv", 12, [0.3, 0.15, 0.05]);
            annot.update();
          }
        }
      } finally {
        page.destroy();
      }
    }
    if (args.operation === "fields") {
      const p = doc.loadPage(args.page || 0);
      try {
        return {
          fields: p
            .getWidgets()
            .map((w) => ({
              name: w.getName(),
              value: w.getValue(),
              type: w.getFieldType(),
            })),
        };
      } finally {
        p.destroy();
      }
    }
    return { binary: outputPdf(doc) };
  } finally {
    doc.destroy();
  }
}
export async function importFile({ extension, binary, title }) {
  if (extension === "docx")
    return {
      kind: "document",
      title,
      payload: { binary },
      warnings: await inspectDocx(binary),
    };
  if (["xlsx", "csv", "tsv"].includes(extension)) {
    const { workbook, warnings } = await importSheet(binary, extension);
    return { kind: "spreadsheet", title, payload: { workbook }, warnings };
  }
  if (extension === "pptx") {
    const result = await importSlides(binary);
    return { kind: "slides", title, ...result };
  }
  if (extension === "pdf") {
    await pdfOperation({ binary, operation: "info" });
    return { kind: "pdf", title, payload: { binary }, warnings: [] };
  }
  if (extension === "txt")
    return {
      kind: "document",
      title,
      payload: {
        binary: await makeDocx({
          title,
          text: Buffer.from(binary, "base64").toString("utf8"),
        }),
      },
      warnings: [],
    };
  throw Error("E102 · Unsupported file type.");
}
export async function exportFile({ kind, payload, extension }) {
  if (["docx", "pdf"].includes(extension) && payload.binary)
    return Buffer.from(payload.binary, "base64");
  if (kind === "spreadsheet") return exportSheet(payload.workbook, extension);
  if (kind === "slides") return exportSlides(payload);
  if (extension === "json")
    return Buffer.from(JSON.stringify(payload, null, 2));
  throw Error("E102 · This export format is not supported for the document.");
}
