import { useEffect, useRef, useState } from "react";
import { SuperDoc } from "superdoc";
import "superdoc/style.css";
import { api, binaryBlob, toBase64, type EditorProps } from "../types";
export default function RichDocument({
  document,
  settings,
  onChange,
  onReady,
  onError,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<any>(null),
    latest = useRef(document.payload),
    change = useRef(onChange),
    ready = useRef(onReady);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Home");
  const toolbarId = useRef("toolbar-" + crypto.randomUUID());
  latest.current = document.payload;
  change.current = onChange;
  ready.current = onReady;
  useEffect(() => {
    let cancelled = false;
    let superdoc: any;
    const init = async () => {
      let binary = document.payload.binary;
      if (!binary)
        binary = await api("convert", {
          method: "makeDocx",
          args: {
            kind: document.kind,
            title: document.title,
            text: document.payload.legacyText || document.payload.text || "",
            brandName: settings.brandName,
            author: settings.author,
          },
        });
      if (cancelled) return;
      const mark = () => {
        if (!cancelled) change.current({ ...latest.current, edited: true });
      };
      superdoc = new SuperDoc({
        selector: host.current!,
        document: binaryBlob(
          binary,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        toolbar: "#" + toolbarId.current,
        documentMode: "editing",
        telemetry: { enabled: false },
        user: { name: settings.author || "Local author" },
        onReady: () => {
          if (cancelled) return;
          setLoading(false);
          ready.current?.({
            exportDocx: async () =>
              toBase64(await superdoc.export({ triggerDownload: false })),
            snapshot: async () => ({
              ...latest.current,
              binary: await toBase64(
                await superdoc.export({ triggerDownload: false }),
              ),
              legacyText: undefined,
              text: undefined,
            }),
            undo: () => superdoc.activeEditor?.commands?.undo?.(),
            redo: () => superdoc.activeEditor?.commands?.redo?.(),
          });
        },
        onEditorUpdate: mark,
        onContentError: () =>
          onError(
            "This document contains content the editor could not load. Keep the original and review compatibility limits.",
          ),
        modules: { toolbar: true, comments: true },
      } as any);
      instance.current = superdoc;
    };
    init().catch((e) => onError(e.message));
    return () => {
      cancelled = true;
      ready.current?.(null);
      superdoc?.destroy();
      instance.current = null;
    };
  }, [document.id]);
  const command = (name: string, ...args: any[]) => {
    const editor = instance.current?.activeEditor;
    if (editor?.commands?.[name]) editor.commands[name](...args);
    else
      onError("This control is not supported by the current editor selection.");
  };
  return (
    <div className="rich-editor">
      <div className="ribbon-tabs" role="tablist" aria-label="Document tools">
        {["Home", "Insert", "Layout", "Review"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="rich-ribbon">
        <div
          id={toolbarId.current}
          className={tab === "Home" ? "" : "hidden"}
        />
        {tab === "Insert" && (
          <>
            <button
              onClick={() =>
                command("insertTable", {
                  rows: 3,
                  cols: 3,
                  withHeaderRow: true,
                })
              }
            >
              Insert table
            </button>
            <button
              onClick={async () => {
                const a = await api("chooseAsset");
                if (a)
                  command("setImage", {
                    src: `data:image/${a.extension};base64,${a.binary}`,
                  });
              }}
            >
              Picture
            </button>
            <button onClick={() => command("setHorizontalRule")}>
              Divider
            </button>
            <button onClick={() => command("insertContent", "😊")}>
              Emoji
            </button>
            <span>
              Links, headers and footers are available through the editor
              toolbar and page controls.
            </span>
          </>
        )}
        {tab === "Layout" && (
          <>
            <button onClick={() => command("insertPageBreak")}>
              Page break
            </button>
            <span>
              Use the page header/footer areas to edit repeating content. Export
              a copy to review pagination.
            </span>
          </>
        )}
        {tab === "Review" && (
          <>
            <button
              onClick={() => instance.current?.setDocumentMode?.("editing")}
            >
              Editing
            </button>
            <button
              onClick={() => instance.current?.setDocumentMode?.("suggesting")}
            >
              Suggest changes
            </button>
            <span>
              Comments are available in the document margin. Side notes are
              stored with your library document.
            </span>
          </>
        )}
      </div>
      {loading && <div className="loading">Preparing document…</div>}
      <div className="rich-surface" ref={host} />
    </div>
  );
}
