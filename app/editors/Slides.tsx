import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Play,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ImagePlus,
  Type,
  Square,
  Table,
  ChartColumn,
  Music,
  Video,
  ArrowLeft,
} from "lucide-react";
import { api, type EditorProps } from "../types";
export default function Slides({
  document,
  onChange,
  onReady,
  onError,
}: EditorProps) {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [present, setPresent] = useState(false);
  const p = document.payload;
  const slide = p.slides[index] || p.slides[0];
  const current = useRef(p),
    past = useRef<any[]>([]),
    future = useRef<any[]>([]),
    drag = useRef<any>(null);
  current.current = p;
  const update = (next: any, history = true) => {
    if (history) {
      past.current.push(current.current);
      if (past.current.length > 15) past.current.shift();
      future.current = [];
    }
    onChange(next);
  };
  const changeSlide = (value: any, history = true) =>
    update(
      {
        ...current.current,
        slides: current.current.slides.map((s: any) =>
          s.id === slide.id ? { ...s, ...value } : s,
        ),
      },
      history,
    );
  const changeElement = (value: any, history = true) =>
    changeSlide(
      {
        elements: slide.elements.map((e: any) =>
          e.id === selected ? { ...e, ...value } : e,
        ),
      },
      history,
    );
  useEffect(() => {
    onReady?.({
      snapshot: async () => current.current,
      undo: () => {
        const value = past.current.pop();
        if (value) {
          future.current.push(current.current);
          onChange(value);
        }
      },
      redo: () => {
        const value = future.current.pop();
        if (value) {
          past.current.push(current.current);
          onChange(value);
        }
      },
    });
    return () => onReady?.(null);
  }, [document.id]);
  useEffect(() => {
    if (!present) return;
    const listener = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        setIndex((i) => Math.min(p.slides.length - 1, i + 1));
        e.preventDefault();
      }
      if (["ArrowLeft", "PageUp"].includes(e.key))
        setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [present, p.slides.length]);
  const add = async (type: string) => {
    let element: any = {
      id: crypto.randomUUID(),
      type,
      x: 100,
      y: 120,
      w: 500,
      h: 90,
      colour: "#292320",
      text: "Your text",
      fontSize: 32,
    };
    if (type === "image" || type === "video" || type === "audio") {
      const a = await api(
        "chooseAsset",
        type === "image"
          ? undefined
          : {
              filters: [
                {
                  name: type,
                  extensions:
                    type === "video" ? ["mp4", "webm"] : ["mp3", "wav", "ogg"],
                },
              ],
            },
      );
      if (!a) return;
      element = {
        ...element,
        w: type === "audio" ? 400 : 550,
        h: type === "audio" ? 80 : 300,
        data: `data:${type}/${a.extension};base64,${a.binary}`,
        extension: a.extension,
      };
    }
    if (type === "shape")
      element = { ...element, w: 250, h: 160, colour: "#97572B" };
    if (type === "table")
      element = {
        ...element,
        w: 600,
        h: 200,
        rows: [
          ["Column 1", "Column 2"],
          ["Value", "Value"],
        ],
      };
    if (type === "chart")
      element = {
        ...element,
        w: 500,
        h: 300,
        labels: ["A", "B", "C"],
        values: [2, 5, 3],
      };
    changeSlide({ elements: [...slide.elements, element] });
    setSelected(element.id);
  };
  const selectedElement = slide.elements.find((e: any) => e.id === selected);
  const render = (e: any, interactive: boolean) => {
    const shared = { x: e.x, y: e.y, width: e.w, height: e.h };
    return (
      <g
        key={e.id}
        className={interactive && selected === e.id ? "selected-element" : ""}
        onPointerDown={
          interactive
            ? (event) => {
                event.stopPropagation();
                setSelected(e.id);
                drag.current = {
                  id: e.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  x: e.x,
                  y: e.y,
                  svg: event.currentTarget.ownerSVGElement,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (event) => {
                if (!drag.current || drag.current.id !== e.id) return;
                const rect = drag.current.svg.getBoundingClientRect();
                const dx =
                    ((event.clientX - drag.current.startX) * p.width) /
                    rect.width,
                  dy =
                    ((event.clientY - drag.current.startY) * p.height) /
                    rect.height;
                changeSlide(
                  {
                    elements: slide.elements.map((x: any) =>
                      x.id === e.id
                        ? {
                            ...x,
                            x: Math.max(0, drag.current.x + dx),
                            y: Math.max(0, drag.current.y + dy),
                          }
                        : x,
                    ),
                  },
                  false,
                );
              }
            : undefined
        }
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {e.type === "shape" && <rect {...shared} fill={e.colour} />}
        {e.type === "image" && (
          <image
            {...shared}
            href={e.data}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        {e.type === "text" && (
          <foreignObject {...shared}>
            <div
              style={{
                fontSize: e.fontSize,
                fontFamily: e.font || "Arial",
                fontWeight: e.bold ? "bold" : "normal",
                color: e.colour,
                whiteSpace: "pre-wrap",
                overflow: "hidden",
                height: "100%",
              }}
            >
              {e.text}
            </div>
          </foreignObject>
        )}
        {e.type === "table" && (
          <foreignObject {...shared}>
            <table className="slide-table">
              <tbody>
                {e.rows.map((r: string[], i: number) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </foreignObject>
        )}
        {e.type === "chart" && (
          <g transform={`translate(${e.x},${e.y})`}>
            {e.values.map((v: number, i: number) => (
              <g key={i}>
                <rect
                  x={i * (e.w / e.values.length) + 10}
                  y={e.h - Math.min(e.h - 30, Math.abs(v) * 20)}
                  width={e.w / e.values.length - 20}
                  height={Math.min(e.h - 30, Math.abs(v) * 20)}
                  fill={e.colour}
                />
                <text
                  x={i * (e.w / e.values.length) + 10}
                  y={e.h + 20}
                  fontSize="18"
                >
                  {e.labels[i]}
                </text>
              </g>
            ))}
          </g>
        )}
        {["audio", "video"].includes(e.type) && (
          <foreignObject {...shared}>
            {present ? (
              e.type === "video" ? (
                <video
                  src={e.data}
                  controls
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <audio src={e.data} controls />
              )
            ) : (
              <div className="media-placeholder">
                {e.type === "video" ? "▶ Video" : "♫ Audio"} · available in
                presentation mode
              </div>
            )}
          </foreignObject>
        )}
        {interactive && selected === e.id && (
          <rect
            {...shared}
            fill="none"
            stroke="#97572B"
            strokeWidth="3"
            strokeDasharray="6 3"
          />
        )}
      </g>
    );
  };
  const canvas = (
    <svg
      className={
        "slide-canvas " + (present ? "present-" + slide.transition : "")
      }
      key={slide.id}
      viewBox={`0 0 ${p.width} ${p.height}`}
      style={{ background: slide.background }}
      onPointerDown={() => setSelected(null)}
    >
      {slide.elements.map((e: any) => render(e, !present))}
    </svg>
  );
  if (present)
    return (
      <div className="presentation">
        <button className="present-exit" onClick={() => setPresent(false)}>
          <ArrowLeft size={16} />
          Exit presentation · Esc
        </button>
        {canvas}
        <div className="present-controls">
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Previous
          </button>
          <span>
            {index + 1} / {p.slides.length}
          </span>
          <button
            disabled={index === p.slides.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  return (
    <div className="slides-editor">
      <div className="ribbon tools">
        <button onClick={() => add("text")}>
          <Type size={17} />
          Text
        </button>
        <button onClick={() => add("image")}>
          <ImagePlus size={17} />
          Picture
        </button>
        <button onClick={() => add("shape")}>
          <Square size={17} />
          Shape
        </button>
        <button onClick={() => add("table")}>
          <Table size={17} />
          Table
        </button>
        <button onClick={() => add("chart")}>
          <ChartColumn size={17} />
          Chart
        </button>
        <button onClick={() => add("audio")}>
          <Music size={17} />
          Audio
        </button>
        <button onClick={() => add("video")}>
          <Video size={17} />
          Video
        </button>
        <button className="primary" onClick={() => setPresent(true)}>
          <Play size={17} />
          Present
        </button>
      </div>
      <div className="print-slides" aria-hidden="true">
        {p.slides.map((s:any)=><svg key={s.id} viewBox={`0 0 ${p.width} ${p.height}`} style={{background:s.background}}>{s.elements.map((e:any)=>render(e,false))}</svg>)}
      </div>
      <div className="slides-body">
        <aside className="slide-thumbnails">
          {p.slides.map((s: any, i: number) => (
            <button
              className={i === index ? "active" : ""}
              key={s.id}
              onClick={() => {
                setIndex(i);
                setSelected(null);
              }}
            >
              <span>{i + 1}</span>
              <svg
                viewBox={`0 0 ${p.width} ${p.height}`}
                style={{ background: s.background }}
              >
                {s.elements
                  .filter((e: any) =>
                    ["text", "shape", "image"].includes(e.type),
                  )
                  .map((e: any) =>
                    e.type === "text" ? (
                      <text
                        key={e.id}
                        x={e.x}
                        y={e.y + 30}
                        fontSize={e.fontSize}
                        fill={e.colour}
                      >
                        {e.text?.slice(0, 35)}
                      </text>
                    ) : e.type === "shape" ? (
                      <rect
                        key={e.id}
                        x={e.x}
                        y={e.y}
                        width={e.w}
                        height={e.h}
                        fill={e.colour}
                      />
                    ) : (
                      <image
                        key={e.id}
                        x={e.x}
                        y={e.y}
                        width={e.w}
                        height={e.h}
                        href={e.data}
                      />
                    ),
                  )}
              </svg>
            </button>
          ))}
          <button
            onClick={() => {
              const id = crypto.randomUUID();
              update({
                ...p,
                slides: [
                  ...p.slides,
                  {
                    id,
                    background: "#ffffff",
                    notes: "",
                    transition: "none",
                    elements: [],
                  },
                ],
              });
              setIndex(p.slides.length);
            }}
          >
            <Plus size={16} />
            New slide
          </button>
        </aside>
        <div className="slide-workspace">
          <div className="inline">
            <button
              onClick={() => {
                const copy = {
                  ...structuredClone(slide),
                  id: crypto.randomUUID(),
                };
                update({
                  ...p,
                  slides: [
                    ...p.slides.slice(0, index + 1),
                    copy,
                    ...p.slides.slice(index + 1),
                  ],
                });
                setIndex(index + 1);
              }}
            >
              <Copy size={16} />
              Duplicate
            </button>
            <button
              aria-label="Move slide up"
              disabled={index === 0}
              onClick={() => {
                const slides = [...p.slides];
                [slides[index - 1], slides[index]] = [
                  slides[index],
                  slides[index - 1],
                ];
                update({ ...p, slides });
                setIndex(index - 1);
              }}
            >
              <ChevronUp size={16} />
            </button>
            <button
              aria-label="Move slide down"
              disabled={index === p.slides.length - 1}
              onClick={() => {
                const slides = [...p.slides];
                [slides[index + 1], slides[index]] = [
                  slides[index],
                  slides[index + 1],
                ];
                update({ ...p, slides });
                setIndex(index + 1);
              }}
            >
              <ChevronDown size={16} />
            </button>
            <button
              disabled={p.slides.length === 1}
              onClick={() => {
                update({
                  ...p,
                  slides: p.slides.filter((_: any, i: number) => i !== index),
                });
                setIndex(Math.max(0, index - 1));
              }}
            >
              <Trash2 size={16} />
              Delete slide
            </button>
          </div>
          {canvas}
          <label>
            Speaker notes
            <textarea
              value={slide.notes}
              onChange={(e) => changeSlide({ notes: e.target.value })}
            />
          </label>
        </div>
        <aside className="slide-properties">
          <h3>{selectedElement ? "Object" : "Slide"} properties</h3>
          {selectedElement ? (
            <>
              <label>
                Text
                <textarea
                  value={selectedElement.text || ""}
                  onChange={(e) => changeElement({ text: e.target.value })}
                />
              </label>
              {["x", "y", "w", "h", "fontSize"].map((key) => (
                <label key={key}>
                  {
                    (
                      {
                        x: "Left",
                        y: "Top",
                        w: "Width",
                        h: "Height",
                        fontSize: "Font size",
                      } as any
                    )[key]
                  }
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={Math.round(selectedElement[key] || 0)}
                    onChange={(e) =>
                      changeElement({ [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <label>
                Colour
                <input
                  type="color"
                  value={selectedElement.colour || "#222222"}
                  onChange={(e) => changeElement({ colour: e.target.value })}
                />
              </label>
              {selectedElement.type === "table" && (
                <label>
                  Table rows (comma separated)
                  <textarea
                    value={selectedElement.rows
                      .map((r: string[]) => r.join(","))
                      .join("\n")}
                    onChange={(e) =>
                      changeElement({
                        rows: e.target.value
                          .split("\n")
                          .map((r) => r.split(",")),
                      })
                    }
                  />
                </label>
              )}
              {selectedElement.type === "chart" && (
                <>
                  <label>
                    Labels
                    <input
                      value={selectedElement.labels.join(",")}
                      onChange={(e) =>
                        changeElement({ labels: e.target.value.split(",") })
                      }
                    />
                  </label>
                  <label>
                    Values
                    <input
                      value={selectedElement.values.join(",")}
                      onChange={(e) =>
                        changeElement({
                          values: e.target.value.split(",").map(Number),
                        })
                      }
                    />
                  </label>
                </>
              )}
              <button
                className="danger"
                onClick={() => {
                  changeSlide({
                    elements: slide.elements.filter(
                      (e: any) => e.id !== selected,
                    ),
                  });
                  setSelected(null);
                }}
              >
                Remove object
              </button>
            </>
          ) : (
            <>
              <label>
                Background
                <input
                  type="color"
                  value={slide.background}
                  onChange={(e) => changeSlide({ background: e.target.value })}
                />
              </label>
              <label>
                Transition
                <select
                  value={slide.transition}
                  onChange={(e) => changeSlide({ transition: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="fade">Fade</option>
                  <option value="appear">Appear</option>
                </select>
              </label>
              <label>
                Slide size
                <select
                  value={p.width / p.height > 1.5 ? "wide" : "standard"}
                  onChange={(e) =>
                    update({
                      ...p,
                      width: e.target.value === "wide" ? 1280 : 960,
                      height: 720,
                    })
                  }
                >
                  <option value="wide">Widescreen 16:9</option>
                  <option value="standard">Standard 4:3</option>
                </select>
              </label>
              <p>
                Drag an object to move it. Select it to change text, size and
                colour.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
