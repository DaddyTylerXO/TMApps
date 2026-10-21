import { useEffect, useRef, useState } from "react";
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PenLine,
  MessageSquare,
  Combine,
  Download,
  Search,
} from "lucide-react";
import { api, type EditorProps } from "../types";
export default function Pdf({ document, onChange, onError }: EditorProps) {
  const [page, setPage] = useState(0),
    [info, setInfo] = useState<any>(null),
    [render, setRender] = useState<any>(null),
    [tool, setTool] = useState("read"),
    [marks, setMarks] = useState<number[][]>([]),
    [confirm, setConfirm] = useState(false),
    [text, setText] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [fields, setFields] = useState<any[]>([]);
  const image = useRef<HTMLImageElement>(null),
    start = useRef<any>(null);
  const binary = document.payload.binary;
  useEffect(() => {
    let cancelled = false;
    api("convert", {
      method: "pdfOperation",
      args: { binary, operation: "info" },
    })
      .then((v) => {
        if (!cancelled) {
          setInfo(v);
          setPage((p) => Math.min(p, v.pages - 1));
        }
      })
      .catch((e) => onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [binary]);
  useEffect(() => {
    if (!binary) return;
    let cancelled = false;
    setRender(null);
    api("convert", {
      method: "pdfOperation",
      args: { binary, operation: "render", page },
    })
      .then((v) => {
        if (!cancelled) setRender(v);
      })
      .catch((e) => onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [binary, page]);
  const operate = async (operation: string, extra: any = {}) => {
    setBusy(true);
    try {
      const value = await api("convert", {
        method: "pdfOperation",
        args: { binary, page, operation, ...extra },
      });
      if (value.binary) onChange({ ...document.payload, binary: value.binary });
      return value;
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const point = (event: React.PointerEvent) => {
    const rect = image.current!.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * render.width,
      ((event.clientY - rect.top) / rect.height) * render.height,
    ];
  };
  const applyRedactions = async () => {
    setBusy(true);
    try {
      let next = binary;
      for (const rect of marks) {
        const value = await api("convert", {
          method: "pdfOperation",
          args: { binary: next, page, operation: "redact", rect },
        });
        next = value.binary;
      }
      onChange({ ...document.payload, binary: next });
      setMarks([]);
      setConfirm(false);
      setTool("read");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pdf-editor">
      <div className="ribbon tools">
        <button
          className={tool === "read" ? "active" : ""}
          onClick={() => setTool("read")}
        >
          Read
        </button>
        <button disabled={busy} onClick={() => operate("rotate")}>
          <RotateCw size={16} />
          Rotate
        </button>
        <button
          className={tool === "annotation" ? "active" : ""}
          onClick={() => setTool("annotation")}
        >
          <MessageSquare size={16} />
          Add text
        </button>
        <button
          className={tool === "signature" ? "active" : ""}
          onClick={() => setTool("signature")}
        >
          <PenLine size={16} />
          Draw signature
        </button>
        <button
          className={tool === "redact" ? "active danger" : "danger"}
          onClick={() => setTool("redact")}
        >
          <ShieldCheck size={16} />
          Mark redaction
        </button>
        <button
          onClick={async () => {
            const a = await api("chooseAsset", {
              filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            if (a) await operate("merge", { other: a.binary });
          }}
        >
          <Combine size={16} />
          Merge PDF
        </button>
        <button
          onClick={async () => {
            const v = await operate("fields");
            if (v) setFields(v.fields);
          }}
        >
          Form fields
        </button>
        <button
          disabled={!marks.length || busy}
          onClick={() => setConfirm(true)}
        >
          Apply {marks.length || ""} redactions
        </button>
      </div>
      <div className="pdf-body">
        <aside className="pdf-pages">
          <h3>Pages</h3>
          {Array.from({ length: info?.pages || 0 }, (_, i) => (
            <button
              key={i}
              className={i === page ? "active" : ""}
              onClick={() => {
                setPage(i);
                setMarks([]);
              }}
            >
              <span className="page-symbol">{i + 1}</span>Page {i + 1}
            </button>
          ))}
          <button
            disabled={!info || info.pages < 2}
            onClick={() =>
              operate("order", {
                pages: Array.from({ length: info.pages }, (_, i) => i).filter(
                  (i) => i !== page,
                ),
              })
            }
          >
            Delete current page
          </button>
          <button
            disabled={!info || page === 0}
            onClick={() => {
              const order = Array.from({ length: info.pages }, (_, i) => i);
              [order[page - 1], order[page]] = [order[page], order[page - 1]];
              operate("order", { pages: order }).then(() => setPage(page - 1));
            }}
          >
            Move page up
          </button>
          <button
            onClick={async () => {
              const v = await api("convert", {
                method: "pdfOperation",
                args: { binary, operation: "order", pages: [page] },
              });
              if (v)
                await api("exportFile", {
                  title: document.title + " page " + (page + 1),
                  extension: "pdf",
                  binary: v.binary,
                });
            }}
          >
            <Download size={16} />
            Extract page
          </button>
        </aside>
        <div className="pdf-workspace">
          <div className="inline pdf-navigation">
            <button
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => {
                setPage(page - 1);
                setMarks([]);
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {page + 1} of {info?.pages || "…"}
            </span>
            <button
              aria-label="Next page"
              disabled={!info || page >= info.pages - 1}
              onClick={() => {
                setPage(page + 1);
                setMarks([]);
              }}
            >
              <ChevronRight size={16} />
            </button>
            <input
              aria-label="Search PDF text"
              placeholder="Search document text…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              onClick={() => {
                const index = info?.text.findIndex(
                  (t: string, i: number) =>
                    i > page && t.toLowerCase().includes(query.toLowerCase()),
                );
                const first = info?.text.findIndex((t: string) =>
                  t.toLowerCase().includes(query.toLowerCase()),
                );
                if (index >= 0) setPage(index);
                else if (first >= 0) setPage(first);
                else
                  onError(
                    "No matching text found. Scanned image text requires OCR, which is not available.",
                  );
              }}
            >
              <Search size={16} />
              Find
            </button>
          </div>
          {tool !== "read" && (
            <div className="editor-help">
              {tool === "redact"
                ? "Drag a rectangle around content, then choose Apply redactions."
                : tool === "signature"
                  ? "Draw your signature on the page. This is a drawn signature, not certificate-backed signing."
                  : "Enter text, then drag a rectangle to place it."}
              {tool === "annotation" && (
                <input
                  aria-label="Annotation text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              )}
            </div>
          )}
          {render ? (
            <div
              className={"pdf-page tool-" + tool}
              onPointerDown={(event) => {
                if (tool === "read") return;
                event.currentTarget.setPointerCapture(event.pointerId);
                start.current = { point: point(event), points: [point(event)] };
              }}
              onPointerMove={(event) => {
                if (tool === "signature" && start.current)
                  start.current.points.push(point(event));
              }}
              onPointerUp={async (event) => {
                if (!start.current) return;
                const last = point(event),
                  first = start.current.point,
                  points = start.current.points;
                start.current = null;
                if (tool === "signature") {
                  points.push(last);
                  if (points.length > 1) await operate("signature", { points });
                  return;
                }
                const rect = [
                  Math.min(first[0], last[0]),
                  Math.min(first[1], last[1]),
                  Math.max(first[0], last[0]),
                  Math.max(first[1], last[1]),
                ];
                if (rect[2] - rect[0] < 3 || rect[3] - rect[1] < 3) return;
                if (tool === "redact") setMarks([...marks, rect]);
                else if (text.trim())
                  await operate("annotation", { rect, text });
              }}
            >
              <img
                ref={image}
                alt={`PDF page ${page + 1}`}
                src={"data:image/png;base64," + render.png}
                draggable={false}
              />
              {marks.map((rect, i) => (
                <div
                  key={i}
                  className="redaction-mark"
                  style={{
                    left: (rect[0] / render.width) * 100 + "%",
                    top: (rect[1] / render.height) * 100 + "%",
                    width: ((rect[2] - rect[0]) / render.width) * 100 + "%",
                    height: ((rect[3] - rect[1]) / render.height) * 100 + "%",
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="loading">Rendering page…</div>
          )}
        </div>
        {fields.length > 0 && (
          <aside className="pdf-fields">
            <h3>Form fields</h3>
            {fields.map((f) => (
              <label key={f.name}>
                {f.name}
                <input
                  defaultValue={f.value}
                  onBlur={(e) =>
                    operate("form", { name: f.name, text: e.target.value })
                  }
                />
              </label>
            ))}
          </aside>
        )}
      </div>
      {confirm && (
        <div
          className="confirm-inline"
          role="alertdialog"
          aria-label="Apply PDF redactions"
        >
          <h3>Permanently remove marked PDF content?</h3>
          <p>
            The marked regions will be rewritten in the managed PDF. Images
            touched by a region are removed in full. Original imports, older
            revisions and exported copies may still contain the unredacted
            content.
          </p>
          <button onClick={() => setConfirm(false)}>Cancel</button>
          <button className="danger" disabled={busy} onClick={applyRedactions}>
            Apply permanent redactions
          </button>
        </div>
      )}
    </div>
  );
}
