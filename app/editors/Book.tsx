import { useState, useRef } from "react";
import { Plus, BookOpen, Trash2 } from "lucide-react";
import RichDocument from "./RichDocument";
import { api, type EditorProps, type EditorHandle } from "../types";
export default function Book(props: EditorProps) {
  const { document, onChange, onReady, onError } = props;
  const p = document.payload;
  const [sectionId, setSection] = useState(p.sections[0]?.id);
  const [pageId, setPage] = useState(p.sections[0]?.pages[0]?.id);
  const child = useRef<EditorHandle | null>(null);
  const payload = useRef(p);
  payload.current = p;
  const section =
    p.sections.find((s: any) => s.id === sectionId) || p.sections[0];
  const page =
    section?.pages.find((x: any) => x.id === pageId) || section?.pages[0];
  const [search, setSearch] = useState("");
  const update = (next: any) => {
    payload.current = next;
    onChange(next);
  };
  const updatePage = (value: any) =>
    update({
      ...payload.current,
      sections: payload.current.sections.map((s: any) =>
        s.id === section.id
          ? {
              ...s,
              pages: s.pages.map((x: any) =>
                x.id === page.id ? { ...x, ...value } : x,
              ),
            }
          : s,
      ),
    });
  const flush = async () => {
    if (page && child.current) updatePage(await child.current.snapshot());
  };
  return (
    <div className="book-editor">
      <div className="section-tabs">
        {p.sections.map((s: any) => (
          <button
            key={s.id}
            className={s.id === section.id ? "active" : ""}
            style={{ borderTopColor: s.colour }}
            onClick={async () => {
              await flush();
              setSection(s.id);
              setPage(s.pages[0]?.id);
            }}
          >
            {s.title}
          </button>
        ))}
        <button
          aria-label="Add section"
          onClick={async () => {
            await flush();
            const id = crypto.randomUUID();
            update({
              ...payload.current,
              sections: [
                ...payload.current.sections,
                {
                  id,
                  title: "New section",
                  colour: "#97572B",
                  pages: [
                    {
                      id: crypto.randomUUID(),
                      title: "Untitled page",
                      text: "",
                    },
                  ],
                },
              ],
            });
            setSection(id);
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="book-body">
        <aside className="book-pages">
          <label>
            Section title
            <input
              value={section.title}
              onChange={(e) =>
                update({
                  ...p,
                  sections: p.sections.map((s: any) =>
                    s.id === section.id ? { ...s, title: e.target.value } : s,
                  ),
                })
              }
            />
          </label>
          <label>
            Section colour
            <input
              type="color"
              value={section.colour}
              onChange={(e) =>
                update({
                  ...p,
                  sections: p.sections.map((s: any) =>
                    s.id === section.id ? { ...s, colour: e.target.value } : s,
                  ),
                })
              }
            />
          </label>
          <input
            aria-label="Search page titles"
            placeholder="Find a page…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {section.pages
            .filter((x: any) =>
              x.title.toLowerCase().includes(search.toLowerCase()),
            )
            .map((x: any) => (
              <button
                className={page?.id === x.id ? "active" : ""}
                key={x.id}
                onClick={async () => {
                  await flush();
                  setPage(x.id);
                }}
              >
                <BookOpen size={16} />
                {x.title}
              </button>
            ))}
          <button
            onClick={async () => {
              await flush();
              const id = crypto.randomUUID();
              update({
                ...payload.current,
                sections: payload.current.sections.map((s: any) =>
                  s.id === section.id
                    ? {
                        ...s,
                        pages: [
                          ...s.pages,
                          { id, title: "Untitled page", text: "" },
                        ],
                      }
                    : s,
                ),
              });
              setPage(id);
            }}
          >
            <Plus size={16} />
            Add page
          </button>
          {page && (
            <button
              className="danger"
              onClick={async () => {
                const next = section.pages.filter((x: any) => x.id !== page.id);
                update({
                  ...p,
                  sections: p.sections.map((s: any) =>
                    s.id === section.id ? { ...s, pages: next } : s,
                  ),
                });
                setPage(next[0]?.id);
              }}
            >
              <Trash2 size={16} />
              Remove page
            </button>
          )}
        </aside>
        <div className="book-page">
          {page ? (
            <>
              <input
                className="page-title"
                aria-label="Page title"
                value={page.title}
                onChange={(e) => updatePage({ title: e.target.value })}
              />
              <RichDocument
                key={page.id}
                {...props}
                document={{
                  ...document,
                  id: page.id,
                  kind: "document",
                  title: page.title,
                  payload: page,
                }}
                onChange={updatePage}
                onReady={(handle) => {
                  child.current = handle;
                  onReady?.(
                    handle
                      ? {
                          exportDocx: () => handle.exportDocx!(),
                          snapshot: async () => {
                            const value = await handle.snapshot();
                            return {
                              ...payload.current,
                              sections: payload.current.sections.map(
                                (s: any) =>
                                  s.id === section.id
                                    ? {
                                        ...s,
                                        pages: s.pages.map((x: any) =>
                                          x.id === page.id
                                            ? { ...x, ...value }
                                            : x,
                                        ),
                                      }
                                    : s,
                              ),
                            };
                          },
                        }
                      : null,
                  );
                }}
              />
            </>
          ) : (
            <div className="empty">Add a page to this section.</div>
          )}
        </div>
      </div>
    </div>
  );
}
