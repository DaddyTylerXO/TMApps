import { useEffect, useRef, useState } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import coreEn from "@univerjs/preset-sheets-core/locales/en-US";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import filterEn from "@univerjs/preset-sheets-filter/locales/en-US";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import sortEn from "@univerjs/preset-sheets-sort/locales/en-US";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import validationEn from "@univerjs/preset-sheets-data-validation/locales/en-US";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import conditionalEn from "@univerjs/preset-sheets-conditional-formatting/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import type { EditorProps } from "../types";
import sheetWorkerURL from "./sheet-worker.ts?worker&url";
export default function Spreadsheet({
  document,
  onChange,
  onReady,
  onError,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<any>(null),
    latest = useRef(document.payload),
    change = useRef(onChange);
  const [chart, setChart] = useState(false);
  latest.current = document.payload;
  change.current = onChange;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    try {
      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(
            coreEn,
            filterEn,
            sortEn,
            validationEn,
            conditionalEn,
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: host.current!,
            workerURL: sheetWorkerURL,
            disableAutoFocus: true,
          }),
          UniverSheetsFilterPreset(),
          UniverSheetsSortPreset(),
          UniverSheetsDataValidationPreset(),
          UniverSheetsConditionalFormattingPreset(),
        ],
      });
      engine.current = { univer, univerAPI };
      const id = crypto.randomUUID();
      const workbook = univerAPI.createWorkbook(
        document.payload.workbook ||
          ({
            id: crypto.randomUUID(),
            name: document.title,
            locale: "enUS",
            sheetOrder: [id],
            sheets: {
              [id]: {
                id,
                name: "Sheet1",
                rowCount: 1000,
                columnCount: 26,
                cellData: {},
              },
            },
          } as any),
      );
      onReady?.({
        snapshot: async () => ({
          ...latest.current,
          workbook: workbook.save(),
        }),
        undo: () => {
          univerAPI.undo();
        },
        redo: () => {
          univerAPI.redo();
        },
      });
      const listener = univerAPI.addEvent(
        univerAPI.Event.CommandExecuted,
        (event: any) => {
          if (!event.id?.includes("mutation")) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (!disposed)
              change.current({ ...latest.current, workbook: workbook.save() });
          }, 180);
        },
      );
      return () => {
        disposed = true;
        clearTimeout(timer);
        listener.dispose();
        onReady?.(null);
        univer.dispose();
        engine.current = null;
      };
    } catch (e) {
      onError(e instanceof Error ? e.message : "Spreadsheet could not start.");
    }
  }, [document.id]);
  const chartData = () => {
    const book = engine.current?.univerAPI.getActiveWorkbook()?.save();
    const sheet = book?.sheets[book.sheetOrder[0]];
    return Object.values(sheet?.cellData || {})
      .slice(0, 12)
      .map((row: any, index) => ({
        label: String(row[0]?.v ?? index + 1),
        value: Number(row[1]?.v) || 0,
      }));
  };
  return (
    <div className="spreadsheet-editor">
      <div className="editor-help">
        <span>
          Formulas, formatting, sheets, sorting, filters and validation work
          locally.
        </span>
        <button onClick={() => setChart(!chart)}>Chart from columns A–B</button>
      </div>
      <div className="sheet-surface" ref={host} />
      {chart && (
        <div className="chart-panel">
          <h3>First sheet · A labels / B values</h3>
          <svg viewBox="0 0 500 230" aria-label="Column chart">
            {chartData().map((d, i) => (
              <g key={i}>
                <rect
                  x={i * 40 + 20}
                  y={190 - Math.min(160, Math.abs(d.value) * 10)}
                  width="28"
                  height={Math.min(160, Math.abs(d.value) * 10)}
                  fill="#97572B"
                />
                <text x={i * 40 + 20} y="215" fontSize="10">
                  {d.label.slice(0, 6)}
                </text>
                <text x={i * 40 + 20} y="20" fontSize="10">
                  {d.value}
                </text>
              </g>
            ))}
          </svg>
          <p>
            Preview chart; XLSX export currently preserves cells and formatting,
            not this chart.
          </p>
        </div>
      )}
    </div>
  );
}
