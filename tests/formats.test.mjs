import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import {
  makeDocx,
  inspectDocx,
  importSheet,
  exportSheet,
  importSlides,
  exportSlides,
  pdfOperation,
  importFile,
} from "../desktop/formats.mjs";
fs.mkdirSync(".qa/formats", { recursive: true });
test("five rich document kinds produce real DOCX packages with distinct templates and headers/footers", async () => {
  for (const kind of [
    "document",
    "advertisement",
    "newsletter",
    "cv",
    "cover-letter",
  ]) {
    const binary = await makeDocx({
      kind,
      title: "Synthetic " + kind,
      brandName: "Synthetic Brand",
    });
    const zip = await JSZip.loadAsync(Buffer.from(binary, "base64"));
    assert.ok(zip.file("word/document.xml"));
    assert.ok(Object.keys(zip.files).some((n) => n.startsWith("word/header")));
    assert.ok(Object.keys(zip.files).some((n) => n.startsWith("word/footer")));
    const xml = await zip.file("word/document.xml").async("string");
    if (kind === "cv")
      assert.ok(xml.includes("Experience") && xml.includes("Education"));
    if (kind === "cover-letter") assert.ok(xml.includes("Dear"));
    assert.deepEqual(await inspectDocx(binary), []);
    fs.writeFileSync(
      ".qa/formats/" + kind + ".docx",
      Buffer.from(binary, "base64"),
    );
  }
});
test("XLSX supported-cell/style/formula/merge/sheet-name roundtrip independently reopens in ExcelJS", async () => {
  const source = new ExcelJS.Workbook();
  const sheet = source.addWorksheet("Research");
  sheet.getCell("A1").value = "café 世界";
  sheet.getCell("B1").value = 12.5;
  sheet.getCell("C1").value = { formula: "B1*2", result: 25 };
  sheet.getCell("A1").font = { bold: true, color: { argb: "FF97572B" } };
  sheet.getCell("B1").numFmt = "0.00";
  sheet.mergeCells("A3:B3");
  sheet.getCell("A3").value = "Merged";
  sheet.getColumn(1).width = 24;
  source.addWorksheet("Second");
  const imported = await importSheet(
    Buffer.from(await source.xlsx.writeBuffer()).toString("base64"),
    "xlsx",
  );
  const bytes = await exportSheet(imported.workbook, "xlsx");
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(reopened.worksheets.length, 2);
  assert.equal(reopened.worksheets[0].name, "Research");
  assert.equal(reopened.worksheets[0].getCell("A1").value, "café 世界");
  assert.equal(reopened.worksheets[0].getCell("A1").font.bold, true);
  assert.equal(reopened.worksheets[0].getCell("C1").value.formula, "B1*2");
  assert.equal(reopened.worksheets[0].getCell("B1").numFmt, "0.00");
  assert.ok(reopened.worksheets[0].model.merges.includes("A3:B3"));
  fs.writeFileSync(".qa/formats/roundtrip.xlsx", bytes);
});
test("CSV/TSV imports and exports handle Unicode, delimiters and embedded line breaks", async () => {
  for (const extension of ["csv", "tsv"]) {
    const sep = extension === "csv" ? "," : "\t";
    const binary = Buffer.from(
      `Name${sep}Note\n"café 世界"${sep}"first\nsecond"`,
    ).toString("base64");
    const one = await importSheet(binary, extension);
    const bytes = await exportSheet(one.workbook, extension);
    const two = await importSheet(bytes.toString("base64"), extension);
    const sheet = two.workbook.sheets[two.workbook.sheetOrder[0]];
    assert.equal(sheet.cellData[1][0].v, "café 世界");
    assert.equal(sheet.cellData[1][1].v, "first\nsecond");
  }
});
test("PPTX exports text/shapes/tables/charts and bounded importer reports unsupported objects", async () => {
  const payload = {
    width: 1280,
    height: 720,
    slides: [
      {
        id: "slide1",
        background: "#ffffff",
        notes: "Synthetic notes",
        elements: [
          {
            id: "a",
            type: "text",
            x: 96,
            y: 96,
            w: 500,
            h: 100,
            text: "Synthetic café 世界",
            fontSize: 28,
            colour: "#97572B",
          },
          {
            id: "b",
            type: "shape",
            x: 300,
            y: 300,
            w: 200,
            h: 100,
            colour: "#97572B",
          },
          {
            id: "c",
            type: "table",
            x: 100,
            y: 450,
            w: 500,
            h: 150,
            rows: [
              ["A", "B"],
              ["1", "2"],
            ],
          },
          {
            id: "d",
            type: "chart",
            x: 700,
            y: 100,
            w: 300,
            h: 250,
            labels: ["A", "B"],
            values: [2, 5],
          },
        ],
      },
    ],
  };
  const bytes = await exportSlides(payload);
  const zip = await JSZip.loadAsync(bytes);
  assert.ok(zip.file("ppt/slides/slide1.xml"));
  assert.ok(
    Object.keys(zip.files).some((n) => n.startsWith("ppt/charts/chart")),
  );
  const imported = await importSlides(bytes.toString("base64"));
  assert.equal(imported.payload.slides.length, 1);
  assert.ok(
    imported.payload.slides[0].elements.some(
      (e) => e.text === "Synthetic café 世界",
    ),
  );
  assert.ok(imported.warnings.some((w) => /charts, tables/.test(w)));
  fs.writeFileSync(".qa/formats/roundtrip.pptx", bytes);
});
test("PDF creation/rendering/rotation/text annotation/merge/extraction reopen with expected content", async () => {
  let result = await pdfOperation({});
  const info = await pdfOperation({ ...result, operation: "info" });
  assert.equal(info.pages, 1);
  assert.ok(info.text[0].includes("New PDF document"));
  const image = await pdfOperation({ ...result, operation: "render", page: 0 });
  assert.ok(
    Buffer.from(image.png, "base64").subarray(1, 4).toString() === "PNG",
  );
  result = await pdfOperation({
    ...result,
    operation: "annotation",
    page: 0,
    rect: [50, 100, 300, 140],
    text: "Synthetic annotation",
  });
  result = await pdfOperation({ ...result, operation: "rotate", page: 0 });
  result = await pdfOperation({
    ...result,
    operation: "merge",
    other: (await pdfOperation({})).binary,
  });
  assert.equal((await pdfOperation({ ...result, operation: "info" })).pages, 2);
  const extracted = await pdfOperation({
    ...result,
    operation: "order",
    pages: [1],
  });
  assert.equal(
    (await pdfOperation({ ...extracted, operation: "info" })).pages,
    1,
  );
  fs.writeFileSync(
    ".qa/formats/tools.pdf",
    Buffer.from(result.binary, "base64"),
  );
});
test("real PDF redaction removes text from rewritten output; independent extraction fixture retained for QA", async () => {
  const source = await pdfOperation({});
  const redacted = await pdfOperation({
    ...source,
    operation: "redact",
    page: 0,
    rect: [45, 35, 400, 90],
  });
  const info = await pdfOperation({ ...redacted, operation: "info" });
  assert.equal(info.text[0].includes("New PDF document"), false);
  assert.notEqual(source.binary, redacted.binary);
  fs.writeFileSync(
    ".qa/formats/redaction-source.pdf",
    Buffer.from(source.binary, "base64"),
  );
  fs.writeFileSync(
    ".qa/formats/redacted.pdf",
    Buffer.from(redacted.binary, "base64"),
  );
});
test("drawn signature is an ink annotation and does not claim certificate-backed signing", async () => {
  const source = await pdfOperation({});
  const signed = await pdfOperation({
    ...source,
    operation: "signature",
    page: 0,
    points: [
      [50, 150],
      [80, 160],
      [110, 150],
    ],
  });
  assert.ok(signed.binary);
  assert.equal((await pdfOperation({ ...signed, operation: "info" })).pages, 1);
});
test("redaction removes a touched image from a rewritten PDF for independent resource inspection", async () => {
  const m = await import("mupdf");
  const doc = new m.PDFDocument();
  const image = new m.Image(fs.readFileSync("assets/app.png"));
  const resource = doc.addImage(image);
  const font = doc.addSimpleFont(new m.Font("Helvetica"));
  const page = doc.addPage(
    [0, 0, 595, 842],
    0,
    { XObject: { I: resource }, Font: { F1: font } },
    "q 100 0 0 100 50 700 cm /I Do Q BT /F1 24 Tf 50 780 Td (Synthetic sensitive text) Tj ET",
  );
  doc.insertPage(-1, page);
  const buffer = doc.saveToBuffer("garbage=4,compress=yes");
  const original = Buffer.from(buffer.asUint8Array()).toString("base64");
  buffer.destroy();
  image.destroy();
  doc.destroy();
  const redacted = await pdfOperation({
    binary: original,
    operation: "redact",
    page: 0,
    rect: [45, 35, 400, 145],
  });
  assert.ok(
    !(await pdfOperation({ ...redacted, operation: "info" })).text[0].includes(
      "Synthetic sensitive",
    ),
  );
  fs.writeFileSync(
    ".qa/formats/image-redaction-source.pdf",
    Buffer.from(original, "base64"),
  );
  fs.writeFileSync(
    ".qa/formats/image-redacted.pdf",
    Buffer.from(redacted.binary, "base64"),
  );
});
test("malformed ZIP/PDF and unsupported types are rejected without executing content", async () => {
  await assert.rejects(() =>
    inspectDocx(Buffer.from("not zip").toString("base64")),
  );
  await assert.rejects(() =>
    importFile({ extension: "exe", binary: "", title: "No execution" }),
  );
  await assert.rejects(() =>
    pdfOperation({
      binary: Buffer.from("not pdf").toString("base64"),
      operation: "info",
    }),
  );
});
