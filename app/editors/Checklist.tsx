import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { EditorProps } from "../types";
export default function Checklist({ document, onChange }: EditorProps) {
  const [input, setInput] = useState("");
  const p = document.payload;
  const items = p.items || [];
  const done = items.filter((i: any) => i.done).length;
  const add = () => {
    if (!input.trim()) return;
    onChange({
      ...p,
      items: [
        ...items,
        { id: crypto.randomUUID(), text: input.trim(), done: false },
      ],
    });
    setInput("");
  };
  return (
    <div className="checklist paper">
      <span className="eyebrow">ONE STEP AT A TIME</span>
      <h1>{document.title}</h1>
      <label className="toggle">
        <input
          type="checkbox"
          checked={p.showProgress !== false}
          onChange={(e) => onChange({ ...p, showProgress: e.target.checked })}
        />
        Show progress
      </label>
      {p.showProgress !== false && (
        <div className="check-progress">
          <progress max={items.length || 1} value={done} />
          <span>
            {done} of {items.length} complete · {items.length - done} remaining
          </span>
        </div>
      )}
      <div className="check-items">
        {items.map((item: any, index: number) => (
          <div className="check-row" key={item.id || index}>
            <input
              aria-label={`Complete ${item.text}`}
              type="checkbox"
              checked={item.done}
              onChange={(e) =>
                onChange({
                  ...p,
                  items: items.map((i: any, j: number) =>
                    j === index ? { ...i, done: e.target.checked } : i,
                  ),
                })
              }
            />
            <input
              aria-label="Checklist item text"
              value={item.text}
              className={item.done ? "completed" : ""}
              onChange={(e) =>
                onChange({
                  ...p,
                  items: items.map((i: any, j: number) =>
                    j === index ? { ...i, text: e.target.value } : i,
                  ),
                })
              }
            />
            <button
              aria-label={`Remove ${item.text}`}
              className="icon quiet"
              onClick={() =>
                onChange({
                  ...p,
                  items: items.filter((_: any, j: number) => j !== index),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="New checklist item"
          placeholder="What needs to be done?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="primary">
          <Plus size={16} />
          Add item
        </button>
      </form>
    </div>
  );
}
