import { createUniver } from "@univerjs/presets";
import { UniverSheetsCoreWorkerPreset } from "@univerjs/preset-sheets-core/worker";
createUniver({ presets: [UniverSheetsCoreWorkerPreset()] });
