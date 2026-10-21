export type Kind =
  | "document"
  | "book"
  | "checklist"
  | "advertisement"
  | "newsletter"
  | "cv"
  | "cover-letter"
  | "pdf"
  | "slides"
  | "spreadsheet";
export type DocumentRecord = {
  id: string;
  kind: Kind;
  title: string;
  folder: string;
  tags: string[];
  favourite: boolean;
  created: string;
  modified: string;
  opened: string;
  sideNotes: string;
  template: string;
  deleted: string | null;
  revision: number;
  payload: any;
};
export type Settings = {
  theme: string;
  largeText: boolean;
  highContrast: boolean;
  autosave: boolean;
  autosaveSeconds: number;
  deletionMode: "trash" | "permanent";
  setupComplete: boolean;
  kbSearch: boolean;
  author: string;
  brandName: string;
  brandColour: string;
  shortcuts: Record<string, string>;
  editor: Record<string, any>;
  closeToTray: boolean;
  notifications: boolean;
};
export type State = {
  documents: DocumentRecord[];
  folders: string[];
  templates: { id: string; name: string; kind: Kind }[];
  settings: Settings;
  recovered: boolean;
};
export type EditorHandle = {
  snapshot: () => Promise<any>;
  exportDocx?: () => Promise<string>;
  undo?: () => void;
  redo?: () => void;
};
export type EditorProps = {
  document: DocumentRecord;
  settings: Settings;
  onChange: (payload: any) => void;
  onReady?: (handle: EditorHandle | null) => void;
  onError: (message: string) => void;
};
export const TYPES: {
  kind: Kind;
  name: string;
  description: string;
  icon: string;
  colour: string;
}[] = [
  {
    kind: "document",
    name: "General Document",
    description: "Write, format and create",
    icon: "file",
    colour: "#d6b28e",
  },
  {
    kind: "book",
    name: "Book",
    description: "Sections, pages and ideas",
    icon: "book",
    colour: "#caa5cc",
  },
  {
    kind: "checklist",
    name: "Check List",
    description: "Small steps. Clear progress.",
    icon: "check",
    colour: "#adc7a4",
  },
  {
    kind: "advertisement",
    name: "AD",
    description: "Make your message stand out",
    icon: "ad",
    colour: "#e4b597",
  },
  {
    kind: "newsletter",
    name: "Newsletter",
    description: "Stories worth sharing",
    icon: "news",
    colour: "#b9c3dc",
  },
  {
    kind: "cv",
    name: "CV",
    description: "Put your experience first",
    icon: "cv",
    colour: "#c1c7a3",
  },
  {
    kind: "cover-letter",
    name: "Cover Letter",
    description: "A thoughtful introduction",
    icon: "letter",
    colour: "#dac29b",
  },
  {
    kind: "pdf",
    name: "PDF",
    description: "Read, organise, sign and redact",
    icon: "pdf",
    colour: "#d9a29e",
  },
  {
    kind: "slides",
    name: "Slide Show",
    description: "Turn ideas into a presentation",
    icon: "slides",
    colour: "#d2afda",
  },
  {
    kind: "spreadsheet",
    name: "Spreadsheet",
    description: "Find the story in your numbers",
    icon: "sheet",
    colour: "#a6c8b6",
  },
];
declare global {
  interface Window {
    libraries: {
      invoke: (
        method: string,
        args?: any,
      ) => Promise<{ value?: any; error?: string; backupWarning?: boolean }>;
      onCommand: (callback: (command: string) => void) => () => void;
    };
  }
}
export async function api<T = any>(method: string, args?: any): Promise<T> {
  if (!window.libraries)
    throw Error("Open TMA-Libraries from its desktop executable.");
  const result = await window.libraries.invoke(method, args);
  if (result.error) throw Error(result.error);
  return result.value;
}
export async function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export function binaryBlob(base64: string, type: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}
