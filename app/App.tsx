import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Folder,
  FolderPlus,
  Home,
  Files,
  Star,
  Clock,
  Trash2,
  Settings as SettingsIcon,
  Search,
  Plus,
  ArrowUpRight,
  ChevronDown,
  FileText,
  BookOpen,
  ListChecks,
  Megaphone,
  Newspaper,
  Contact,
  Mail,
  FileType,
  Presentation,
  Sheet,
  MoreHorizontal,
  Grid2X2,
  List,
  PanelRight,
  Save,
  Download,
  Undo2,
  Redo2,
  X,
  ArrowLeft,
  Import,
  HelpCircle,
  Check,
  RotateCcw,
  Ellipsis,
  WifiOff,
} from "lucide-react";
import {
  api,
  TYPES,
  type DocumentRecord,
  type EditorHandle,
  type Kind,
  type Settings as SettingsType,
  type State,
} from "./types";
import Settings from "./Settings";
import { Help, RELEASES } from "./Help";
const RichDocument = lazy(() => import("./editors/RichDocument"));
const Book = lazy(() => import("./editors/Book"));
const Spreadsheet = lazy(() => import("./editors/Spreadsheet"));
const Slides = lazy(() => import("./editors/Slides"));
const Pdf = lazy(() => import("./editors/Pdf"));
const Checklist = lazy(() => import("./editors/Checklist"));
const icons: any = {
  file: FileText,
  book: BookOpen,
  check: ListChecks,
  ad: Megaphone,
  news: Newspaper,
  cv: Contact,
  letter: Mail,
  pdf: FileType,
  slides: Presentation,
  sheet: Sheet,
};
const typeFor = (kind: Kind) => TYPES.find((t) => t.kind === kind)!;
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon quiet"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function TypeIcon({ kind, size = 22 }: { kind: Kind; size?: number }) {
  const t = typeFor(kind);
  const Icon = icons[t.icon];
  return (
    <span className="type-icon" style={{ color: t.colour }}>
      <Icon size={size} />
    </span>
  );
}
export default function App() {
  const [state, setState] = useState<State | null>(null),
    [view, setView] = useState("home"),
    [active, setActive] = useState<DocumentRecord | null>(null),
    [tabs, setTabs] = useState<{ id: string; title: string; kind: Kind }[]>([]),
    [query, setQuery] = useState(""),
    [grid, setGrid] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Opening your workspace…"),
    [busy, setBusy] = useState(false),
    [details, setDetails] = useState(false),
    [newName, setNewName] = useState(""),
    [tourStep, setTourStep] = useState(0),
    [history, setHistory] = useState<any[]>([]),
    [menu, setMenu] = useState<string | null>(null),
    [legacy, setLegacy] = useState(false);
  const activeRef = useRef(active),
    stateRef = useRef(state),
    handle = useRef<EditorHandle | null>(null),
    generation = useRef(0),
    savedGeneration = useRef(0),
    savePromise = useRef<Promise<boolean> | null>(null),
    searchRef = useRef<HTMLInputElement>(null),
    settingsRef = useRef<any>(null);
  activeRef.current = active;
  stateRef.current = state;
  const refresh = useCallback(async () => {
    const next = await api<State>("state");
    setState(next);
    return next;
  }, []);
  useEffect(() => {
    refresh()
      .then((next) => {
        setStatus(
          next.recovered
            ? "Recovered from the last valid database backup. Review recent changes."
            : "All changes saved locally",
        );
        if (!next.settings.setupComplete) setModal("welcome");
      })
      .catch((e) => setError(e.message));
    api("legacyStatus")
      .then((v) => setLegacy(v.available))
      .catch(() => {});
  }, []);
  const update = (value: Partial<DocumentRecord>) => {
    const d = activeRef.current;
    if (!d) return;
    generation.current++;
    const next = { ...d, ...value };
    activeRef.current = next;
    setActive(next);
    setStatus(
      stateRef.current?.settings.autosave
        ? "Unsaved changes · autosave pending"
        : "Unsaved changes · save when ready",
    );
  };
  const save = useCallback(async (): Promise<boolean> => {
    if (savePromise.current) return savePromise.current;
    const d = activeRef.current;
    if (!d || generation.current === savedGeneration.current) return true;
    const run = (async () => {
      try {
        const stamp = generation.current;
        const payload = handle.current
          ? await handle.current.snapshot()
          : d.payload;
        const result = await window.libraries.invoke("save", { ...d, payload });
        if (result.error) throw Error(result.error);
        const saved = result.value as DocumentRecord;
        const latest = activeRef.current;
        if (latest?.id === saved.id) {
          const next =
            generation.current === stamp
              ? saved
              : {
                  ...latest,
                  revision: saved.revision,
                  modified: saved.modified,
                };
          activeRef.current = next;
          setActive(next);
        }
        savedGeneration.current = stamp;
        setStatus(
          result.backupWarning
            ? "Saved locally · recovery backup could not refresh; export a private copy."
            : generation.current === stamp
              ? "All changes saved locally"
              : "Saved · newer edits pending",
        );
        setTabs((t) =>
          t.map((x) => (x.id === saved.id ? { ...x, title: saved.title } : x)),
        );
        await refresh();
        return true;
      } catch (e) {
        setError((e as Error).message);
        setStatus("Save failed · keep this window open and retry");
        return false;
      } finally {
        savePromise.current = null;
      }
    })();
    savePromise.current = run;
    return run;
  }, []);
  useEffect(() => {
    if (!state?.settings.autosave) return;
    const timer = setInterval(() => {
      void save();
    }, state.settings.autosaveSeconds * 1000);
    return () => clearInterval(timer);
  }, [state?.settings.autosave, state?.settings.autosaveSeconds]);
  const beforeNavigate = async () => {
    if (!(await save())) return false;
    if (generation.current !== savedGeneration.current) {
      setError(
        "New edits arrived while saving. Let saving finish before switching documents.",
      );
      return false;
    }
    return true;
  };
  const openDocument = async (id: string) => {
    if (!(await beforeNavigate())) return;
    setBusy(true);
    try {
      const d = await api<DocumentRecord>("get", id);
      if (d.deleted) {
        setView("trash");
        return;
      }
      await api("opened", id);
      handle.current = null;
      generation.current = savedGeneration.current = 0;
      activeRef.current = d;
      setActive(d);
      setTabs((t) =>
        t.some((x) => x.id === d.id)
          ? t
          : [...t, { id: d.id, title: d.title, kind: d.kind }],
      );
      setView("editor");
      setStatus("All changes saved locally");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const navigate = async (next: string) => {
    if (!(await beforeNavigate())) return;
    handle.current = null;
    activeRef.current = null;
    setActive(null);
    setView(next);
    setQuery("");
    setMenu(null);
  };
  const create = async (kind: Kind) => {
    if (!(await beforeNavigate())) return;
    setBusy(true);
    try {
      const type = typeFor(kind);
      const title = "Untitled " + type.name.toLowerCase();
      let payload: any;
      if (
        [
          "document",
          "advertisement",
          "newsletter",
          "cv",
          "cover-letter",
        ].includes(kind)
      )
        payload = {
          binary: await api("convert", {
            method: "makeDocx",
            args: {
              kind,
              title,
              brandName: state?.settings.brandName,
              author: state?.settings.author,
            },
          }),
        };
      if (kind === "pdf")
        payload = await api("convert", { method: "pdfOperation", args: {} });
      const d = await api<DocumentRecord>("create", {
        kind,
        title,
        folder: view.startsWith("folder:") ? view.slice(7) : "",
        payload,
        template: kind,
      });
      setModal(null);
      await openDocument(d.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const importFile = async () => {
    if (!(await beforeNavigate())) return;
    setBusy(true);
    try {
      const data = await api("importFile");
      if (!data) return;
      if (data.warnings?.length) {
        settingsRef.current = data;
        setModal("import-review");
      } else {
        const d = await api("create", {
          kind: data.kind,
          title: data.title,
          payload: data.payload,
        });
        await openDocument(d.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (d: DocumentRecord, permanent = false) => {
    try {
      if (activeRef.current?.id === d.id && !(await beforeNavigate())) return;
      const ok = await api(permanent ? "purge" : "delete", d.id);
      if (!ok) return;
      setTabs((t) => t.filter((x) => x.id !== d.id));
      if (activeRef.current?.id === d.id) {
        activeRef.current = null;
        setActive(null);
        handle.current = null;
        setView("all");
        generation.current = savedGeneration.current = 0;
      }
      await refresh();
      setMenu(null);
      setStatus(
        permanent || state?.settings.deletionMode === "permanent"
          ? "Managed document permanently deleted"
          : "Document moved to Trash · restore it any time",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const exportActive = async (extension: string) => {
    if (!(await save()) || !activeRef.current) return;
    setBusy(true);
    try {
      const d = activeRef.current;
      let payload = handle.current
        ? await handle.current.snapshot()
        : d.payload;
      if (extension === "notebook") {
        await api("exportArchive", d.id);
      } else if (extension === "docx" && d.kind === "book") {
        const binary = await handle.current?.exportDocx?.();
        if (!binary)
          throw Error("The selected book page is not ready to export.");
        await api("exportFile", {
          title: d.title + " selected page",
          extension: "docx",
          binary,
        });
      } else if (extension === "pdf" && d.kind !== "pdf") {
        await api("print", { pdf: true });
      } else
        await api("exportFile", {
          kind: d.kind,
          payload,
          title: d.title,
          extension,
        });
      setModal(null);
      setStatus(
        "Export finished or cancelled · original imports remain unchanged",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(
    () =>
      window.libraries?.onCommand((command) => {
        if (command === "save") void save();
        else if (command === "new") setModal("new");
        else if (command === "search") searchRef.current?.focus();
        else if (command === "settings") void navigate("settings");
        else if (command === "help") setModal("help");
        else if (command === "close" || command === "quit")
          void (async () => {
            if (await beforeNavigate()) await api("close");
          })();
      }),
    [],
  );
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!stateRef.current) return;
      const key = [
        event.ctrlKey || event.metaKey ? "Ctrl" : "",
        event.altKey ? "Alt" : "",
        event.shiftKey ? "Shift" : "",
        event.key.length === 1 ? event.key.toUpperCase() : event.key,
      ]
        .filter(Boolean)
        .join("+");
      for (const [action, binding] of Object.entries(
        stateRef.current.settings.shortcuts,
      )) {
        if (key.toLowerCase() === binding.toLowerCase()) {
          event.preventDefault();
          if (action === "save") void save();
          if (action === "new") setModal("new");
          if (action === "search") searchRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.theme = state.settings.highContrast
      ? "contrast"
      : state.settings.theme;
    document.documentElement.classList.toggle(
      "large-text",
      state.settings.largeText,
    );
  }, [state?.settings]);
  if (!state)
    return (
      <div className="startup">
        <div className="brandmark">
          <Folder />
        </div>
        <h1>TMA-Libraries</h1>
        <p>{error || status}</p>
      </div>
    );
  const selectedFolder = view.startsWith("folder:") ? view.slice(7) : "";
  const filtered = state.documents
    .filter((d) => (view === "trash" ? !!d.deleted : !d.deleted))
    .filter((d) =>
      view === "favourites"
        ? d.favourite
        : view === "recent"
          ? !!d.opened
          : selectedFolder
            ? d.folder === selectedFolder
            : true,
    )
    .filter((d) =>
      (d.title + " " + d.tags.join(" ") + " " + d.folder)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      view === "recent"
        ? Date.parse(b.opened) - Date.parse(a.opened)
        : Date.parse(b.modified) - Date.parse(a.modified),
    );
  const nav = [
    ["home", "Home", Home],
    ["all", "All documents", Files],
    ["favourites", "Favourites", Star],
    ["recent", "Recent", Clock],
    ["trash", "Trash", Trash2],
  ] as const;
  const row = (d: DocumentRecord) => (
    <div className="document-row" key={d.id}>
      <button
        className="document-open"
        disabled={!!d.deleted}
        onClick={() => openDocument(d.id)}
      >
        <TypeIcon kind={d.kind} />
        <span>
          <strong>{d.title}</strong>
          <small>
            {typeFor(d.kind).name}
            {d.folder ? " · " + d.folder : ""}
          </small>
        </span>
      </button>
      <div className="tags">
        {d.tags.slice(0, 3).map((tag, i) => (
          <span key={tag} className={"tag tag-" + (i % 3)}>
            {tag}
          </span>
        ))}
      </div>
      <span className="modified">
        {new Date(d.modified).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })}
      </span>
      {d.deleted ? (
        <div className="inline">
          <button
            onClick={async () => {
              try {
                await api("restore", d.id);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <RotateCcw size={15} />
            Restore
          </button>
          <button
            className="icon danger"
            aria-label={`Permanently delete ${d.title}`}
            onClick={() => remove(d, true)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ) : (
        <div className="row-actions">
          <span aria-label={d.favourite ? "Favourite" : ""}>
            {d.favourite && <Star size={15} fill="currentColor" />}
          </span>
          <button
            className="icon quiet"
            aria-label={`Actions for ${d.title}`}
            onClick={() => setMenu(menu === d.id ? null : d.id)}
          >
            <MoreHorizontal size={19} />
          </button>
          {menu === d.id && (
            <div className="row-menu">
              <button onClick={() => openDocument(d.id)}>Open document</button>
              <button className="danger" onClick={() => remove(d)}>
                <Trash2 size={16} />
                {state.settings.deletionMode === "trash"
                  ? "Move to Trash"
                  : "Permanently delete"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
  const tour = [
    "Start with Home. Choose one of the ten document types or import an existing supported file.",
    "Use folders, favourites, coloured tags and Recent to find your work. Delete sends managed documents to Trash by default.",
    "Every type has its own editor. Use the ribbon for document tools, and Side notes for thoughts that do not belong on the page.",
    "Work saves locally. Export a private workspace backup regularly. Settings contains appearance, accessibility, deletion preferences and offline Help.",
  ];
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            void navigate("home");
          }}
        >
          <span className="brandmark">
            <Folder size={24} fill="white" />
          </span>
          <span>
            TMA-Libraries<small>YOUR CREATIVE WORKSPACE</small>
          </span>
        </a>
        <button
          className="new-button"
          disabled={busy}
          onClick={() => setModal("new")}
        >
          <Plus size={19} />
          New document
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">LIBRARY</span>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              className={view === id ? "nav-item active" : "nav-item"}
              key={id}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {id === "trash" && (
                <span className="count">
                  {state.documents.filter((d) => d.deleted).length || ""}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label folder-label">
          FOLDERS
          <button
            className="icon quiet"
            aria-label="New folder"
            onClick={() => {
              setNewName("");
              setModal("folder");
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="folder-list">
          {state.folders.map((f) => (
            <button
              key={f}
              className={selectedFolder === f ? "nav-item active" : "nav-item"}
              onClick={() => navigate("folder:" + f)}
            >
              <Folder size={17} />
              <span>{f}</span>
            </button>
          ))}
          {!state.folders.length && (
            <p className="sidebar-hint">
              A little room for every project.
              <br />
              Create your first folder.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <button
            className={view === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("settings")}
          >
            <SettingsIcon size={19} />
            Settings
          </button>
          <button className="nav-item" onClick={() => setModal("help")}>
            <HelpCircle size={19} />
            Help & knowledge base
          </button>
          <div className="local-status">
            <span className="status-dot" />
            Local workspace<small>Offline editing available</small>
          </div>
        </div>
      </aside>
      <main className="main-workspace">
        <div className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            {view === "editor"
              ? typeFor(active!.kind).name
              : view === "settings"
                ? "Settings"
                : selectedFolder ||
                  (
                    {
                      home: "Home",
                      all: "All documents",
                      favourites: "Favourites",
                      recent: "Recent",
                      trash: "Trash",
                    } as any
                  )[view]}
          </div>
          <div className="search">
            <Search size={18} />
            <input
              ref={searchRef}
              aria-label="Search library"
              placeholder="Search titles, tags and folders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>Ctrl F</kbd>
          </div>
          <button
            className="avatar"
            aria-label="Author settings"
            onClick={() => navigate("settings")}
          >
            {state.settings.author
              ? state.settings.author.slice(0, 2).toUpperCase()
              : "TL"}
          </button>
        </div>
        {tabs.length > 0 && (
          <div className="document-tabs">
            {tabs.map((t) => (
              <div
                key={t.id}
                className={
                  active?.id === t.id && view === "editor"
                    ? "document-tab active"
                    : "document-tab"
                }
              >
                <button onClick={() => openDocument(t.id)}>
                  <TypeIcon kind={t.kind} size={15} />
                  <span>{t.title}</span>
                  {active?.id === t.id &&
                    generation.current !== savedGeneration.current && <i />}
                </button>
                <button
                  aria-label={`Close ${t.title}`}
                  className="tab-close"
                  onClick={async () => {
                    if (active?.id === t.id) {
                      if (!(await beforeNavigate())) return;
                      setActive(null);
                      activeRef.current = null;
                      handle.current = null;
                      setView("home");
                    }
                    setTabs((ts) => ts.filter((x) => x.id !== t.id));
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {view === "settings" ? (
          <Settings
            settings={state.settings}
            onSave={async (s) => {
              const bindings = Object.values(s.shortcuts).map((x) =>
                x.toLowerCase(),
              );
              if (
                new Set(bindings).size !== bindings.length ||
                bindings.some(
                  (b) => !/^ctrl\+(shift\+|alt\+)?[a-z0-9]$/i.test(b),
                )
              )
                throw Error(
                  "Use unique shortcuts such as Ctrl+N or Ctrl+Shift+S.",
                );
              await api("settings", s);
              await refresh();
              setStatus("Settings saved locally");
            }}
            onError={setError}
            onRefresh={async () => {
              await refresh();
            }}
            onTour={() => {
              setTourStep(0);
              setModal("tour");
            }}
          />
        ) : view === "editor" && active ? (
          <div className="editor-layout">
            <div className="editor-top">
              <div>
                <input
                  aria-label="Document title"
                  className="document-title"
                  maxLength={200}
                  value={active.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
                <div className="editor-caption">
                  <TypeIcon kind={active.kind} size={13} />
                  {typeFor(active.kind).name} ·{" "}
                  {active.folder || "All documents"} · Local file
                </div>
              </div>
              <div className="inline">
                <button
                  className={active.favourite ? "icon active" : "icon"}
                  aria-label="Toggle favourite"
                  onClick={() => update({ favourite: !active.favourite })}
                >
                  <Star
                    size={18}
                    fill={active.favourite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  className="icon"
                  aria-label="Undo"
                  onClick={() => handle.current?.undo?.()}
                >
                  <Undo2 size={18} />
                </button>
                <button
                  className="icon"
                  aria-label="Redo"
                  onClick={() => handle.current?.redo?.()}
                >
                  <Redo2 size={18} />
                </button>
                <button onClick={() => save()}>
                  <Save size={16} />
                  Save
                </button>
                <button className="primary" onClick={() => setModal("export")}>
                  <Download size={16} />
                  Export
                </button>
                <button
                  className="icon"
                  aria-label="Side notes and document details"
                  aria-pressed={details}
                  onClick={() => setDetails(!details)}
                >
                  <PanelRight size={18} />
                </button>
              </div>
            </div>
            <div className="editor-body">
              <div
                className="editor-container"
                spellCheck={
                  state.settings.editor[active.kind]?.spellcheck !== false
                }
              >
                <Suspense
                  fallback={<div className="loading">Loading editor…</div>}
                >
                  {(() => {
                    const props = {
                      document: active,
                      settings: state.settings,
                      onChange: (payload: any) => update({ payload }),
                      onReady: (h: EditorHandle | null) => {
                        handle.current = h;
                      },
                      onError: setError,
                    };
                    if (active.kind === "checklist")
                      return <Checklist key={active.id} {...props} />;
                    if (active.kind === "book")
                      return <Book key={active.id} {...props} />;
                    if (active.kind === "spreadsheet")
                      return <Spreadsheet key={active.id} {...props} />;
                    if (active.kind === "slides")
                      return <Slides key={active.id} {...props} />;
                    if (active.kind === "pdf")
                      return <Pdf key={active.id} {...props} />;
                    return <RichDocument key={active.id} {...props} />;
                  })()}
                </Suspense>
              </div>
              {details && (
                <aside className="details-panel">
                  <h3>Document details</h3>
                  <label>
                    Folder
                    <select
                      value={active.folder}
                      onChange={(e) => update({ folder: e.target.value })}
                    >
                      <option value="">All documents</option>
                      {state.folders.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tags (comma separated)
                    <input
                      value={active.tags.join(", ")}
                      maxLength={1000}
                      onChange={(e) =>
                        update({
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    Side notes
                    <textarea
                      aria-label="Side notes"
                      rows={8}
                      maxLength={200000}
                      value={active.sideNotes}
                      onChange={(e) => update({ sideNotes: e.target.value })}
                    />
                  </label>
                  <dl>
                    <dt>Created</dt>
                    <dd>{new Date(active.created).toLocaleString()}</dd>
                    <dt>Modified</dt>
                    <dd>{new Date(active.modified).toLocaleString()}</dd>
                    <dt>Saved revision</dt>
                    <dd>{active.revision}</dd>
                    <dt>Template</dt>
                    <dd>{active.template || "Blank"}</dd>
                  </dl>
                  <button
                    onClick={() => {
                      setNewName(active.title);
                      setModal("template");
                    }}
                  >
                    Save as template
                  </button>
                  <button
                    onClick={async () => {
                      await save();
                      setHistory(await api("history", active.id));
                      setModal("history");
                    }}
                  >
                    Editing history
                  </button>
                  <button className="danger" onClick={() => remove(active)}>
                    <Trash2 size={16} />
                    Delete document
                  </button>
                </aside>
              )}
            </div>
          </div>
        ) : (
          <div className="library-content">
            {view === "home" ? (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR LIBRARY, YOUR WAY</span>
                    <h1>What will you create today?</h1>
                    <p>Bring your notes, documents and ideas together.</p>
                  </div>
                  <button onClick={importFile} disabled={busy}>
                    <Import size={17} />
                    Open from location
                  </button>
                </div>
                <div className="hero">
                  <div>
                    <span className="eyebrow">A PLACE FOR YOUR NEXT IDEA</span>
                    <h2>Start a new chapter.</h2>
                    <p>
                      Write something useful. Plan something big.
                      <br />
                      Everything stays in your local workspace.
                    </p>
                    <button className="cream" onClick={() => setModal("new")}>
                      Create a document <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="art-sheet back" />
                    <div className="art-sheet front">
                      <Folder size={42} />
                      <span />
                      <span />
                      <span />
                      <small>TMA-Libraries</small>
                    </div>
                    <div className="art-dot" />
                  </div>
                </div>
                <div className="section-heading">
                  <div>
                    <h2>Create something new</h2>
                    <p>The right space for every kind of work.</p>
                  </div>
                  <button className="quiet" onClick={() => setModal("new")}>
                    Explore all types <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="type-grid">
                  {TYPES.map((t) => {
                    const Icon = icons[t.icon];
                    return (
                      <button
                        className="type-card"
                        key={t.kind}
                        disabled={busy}
                        onClick={() => create(t.kind)}
                      >
                        <span className="type-tile" style={{ color: t.colour }}>
                          <Icon size={26} />
                        </span>
                        <strong>{t.name}</strong>
                        <small>{t.description}</small>
                        <ArrowUpRight className="card-arrow" size={15} />
                      </button>
                    );
                  })}
                </div>
                {legacy && (
                  <div className="migration-banner">
                    <InfoIcon />
                    <div>
                      <strong>
                        Your previous Libraries workspace is available.
                      </strong>
                      <p>
                        Migrate notes and checklists without changing the
                        original files.
                      </p>
                    </div>
                    <button onClick={() => navigate("settings")}>
                      Open saving settings
                    </button>
                  </div>
                )}
                <div className="section-heading">
                  <div>
                    <h2>Recent documents</h2>
                    <p>Pick up where you left off.</p>
                  </div>
                  <button className="quiet" onClick={() => navigate("all")}>
                    View all <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="document-list">
                  {filtered
                    .filter((d) => !d.deleted)
                    .slice(0, 6)
                    .map(row)}
                  {!filtered.length && (
                    <div className="empty">
                      <Folder size={32} />
                      <h3>Your library starts here</h3>
                      <p>
                        Create your first document or import one you already
                        have.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR WORKSPACE</span>
                    <h1>
                      {selectedFolder ||
                        (
                          {
                            all: "All documents",
                            favourites: "Favourites",
                            recent: "Recent documents",
                            trash: "Trash",
                          } as any
                        )[view]}
                    </h1>
                    <p>
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "document" : "documents"}
                      {view === "trash"
                        ? " · Restore documents or remove them permanently."
                        : ""}
                    </p>
                  </div>
                  <div className="inline">
                    {view === "trash" ? (
                      <button
                        className="danger"
                        onClick={async () => {
                          await api("emptyTrash");
                          await refresh();
                        }}
                      >
                        Empty Trash
                      </button>
                    ) : (
                      <>
                        <button
                          className={grid ? "icon" : "icon active"}
                          aria-label="List view"
                          onClick={() => setGrid(false)}
                        >
                          <List size={18} />
                        </button>
                        <button
                          className={grid ? "icon active" : "icon"}
                          aria-label="Grid view"
                          onClick={() => setGrid(true)}
                        >
                          <Grid2X2 size={18} />
                        </button>
                        <button onClick={importFile}>
                          <Import size={17} />
                          Import
                        </button>
                        {selectedFolder && (
                          <button onClick={() => setModal("remove-folder")}>
                            Remove folder
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div
                  className={
                    grid && view !== "trash"
                      ? "document-card-grid"
                      : "document-list"
                  }
                >
                  {filtered.slice(0, 200).map(row)}
                  {!filtered.length && (
                    <div className="empty">
                      <Folder size={34} />
                      <h3>
                        {query
                          ? "No matching documents"
                          : view === "trash"
                            ? "Trash is empty"
                            : "No documents here yet"}
                      </h3>
                      <p>
                        {query
                          ? "Try a different title, folder or tag."
                          : "Your saved documents will appear here."}
                      </p>
                    </div>
                  )}
                  {filtered.length > 200 && (
                    <p>
                      Showing the first 200 matches. Narrow your search to find
                      more.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <footer className="statusbar">
          <span>
            <span className="status-dot" />
            {busy ? "Working locally…" : status}
          </span>
          <span>0.2.0-dev.1 · Offline editing</span>
        </footer>
      </main>
      {error && (
        <div role="alert" className="toast">
          <span>{error}</span>
          <button
            className="icon quiet"
            aria-label="Dismiss message"
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {modal === "new" && (
        <Modal title="Create a new document" onClose={() => setModal(null)}>
          <p>Choose the space that fits your work.</p>
          <div className="type-grid modal-types">
            {TYPES.map((t) => (
              <button
                className="type-card"
                key={t.kind}
                disabled={busy}
                onClick={() => create(t.kind)}
              >
                <TypeIcon kind={t.kind} size={26} />
                <strong>{t.name}</strong>
                <small>{t.description}</small>
              </button>
            ))}
          </div>
          {state.templates.length > 0 && (
            <>
              <h3>Your templates</h3>
              <div className="inline">
                {state.templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={async () => {
                      try {
                        const d = await api("createFromTemplate", { id: t.id });
                        setModal(null);
                        await openDocument(d.id);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <TypeIcon kind={t.kind} />
                    {t.name}
                  </button>
                ))}
              </div>
              <p>
                Custom templates are included in complete Libraries workspace
                copies.
              </p>
            </>
          )}
          <button onClick={importFile}>
            Open an existing supported file instead
          </button>
        </Modal>
      )}
      {modal === "folder" && (
        <Modal title="New folder" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("addFolder", newName);
                await refresh();
                setModal(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Folder name
              <input
                autoFocus
                required
                maxLength={120}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <button className="primary">Create folder</button>
          </form>
        </Modal>
      )}
      {modal === "remove-folder" && (
        <Modal
          title="Remove folder organisation?"
          onClose={() => setModal(null)}
        >
          <p>
            Documents in {selectedFolder} will remain in All Documents. No
            document content is deleted.
          </p>
          <button
            onClick={async () => {
              await api("removeFolder", selectedFolder);
              await refresh();
              setModal(null);
              setView("all");
            }}
          >
            Remove folder
          </button>
        </Modal>
      )}
      {modal === "import-review" && (
        <Modal
          title="Review file compatibility"
          onClose={() => {
            settingsRef.current = null;
            setModal(null);
          }}
        >
          <p>
            The original file is never overwritten. The following limitations
            apply to the imported copy:
          </p>
          <ul>
            {settingsRef.current?.warnings.map((w: string) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <button
            className="primary"
            onClick={async () => {
              try {
                const data = settingsRef.current;
                const d = await api("create", {
                  kind: data.kind,
                  title: data.title,
                  payload: data.payload,
                });
                settingsRef.current = null;
                setModal(null);
                await openDocument(d.id);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Import managed copy
          </button>
        </Modal>
      )}
      {modal === "export" && active && (
        <Modal title="Export a copy" onClose={() => setModal(null)}>
          <p>
            Your original imports remain unchanged. Review exported files before
            sharing.
          </p>
          <div className="export-options">
            {([
              "document",
              "advertisement",
              "newsletter",
              "cv",
              "cover-letter",
            ].includes(active.kind)
              ? ["docx", "pdf"]
              : active.kind === "spreadsheet"
                ? ["xlsx", "csv", "tsv"]
                : active.kind === "slides"
                  ? ["pptx", "pdf"]
                  : active.kind === "pdf"
                    ? ["pdf"]
                    : active.kind === "book"
                      ? ["notebook", "docx", "pdf"]
                      : ["json"]
            ).map((ext) => (
              <button
                key={ext}
                disabled={busy}
                onClick={() => exportActive(ext)}
              >
                <Download size={18} />
                {ext.toUpperCase()} copy
              </button>
            ))}
          </div>
          {active.kind === "book" && (
            <p>
              NOTEBOOK creates a portable Libraries notebook copy. DOCX and PDF
              export the currently selected page.
            </p>
          )}
          {active.kind === "spreadsheet" && (
            <p>
              CSV/TSV exports the first worksheet only. Advanced features and
              chart previews are not preserved in XLSX.
            </p>
          )}
          {active.kind === "slides" && (
            <p>
              Advanced imported animation and embedded objects are unsupported.
            </p>
          )}
          <button
            onClick={async () => {
              if (await save()) await api("exportArchive");
            }}
          >
            Complete Libraries workspace backup
          </button>
        </Modal>
      )}
      {modal === "history" && active && (
        <Modal title="Editing history" onClose={() => setModal(null)}>
          <p>
            Up to 20 previous saved content revisions are retained. Restoring
            creates a new revision.
          </p>
          {history.map((r) => (
            <div className="history-row" key={r.revision}>
              <span>
                Revision {r.revision} · {new Date(r.modified).toLocaleString()}
              </span>
              <button
                onClick={async () => {
                  try {
                    const d = await api("restoreRevision", {
                      id: active.id,
                      revision: r.revision,
                    });
                    handle.current = null;
                    setActive(null);
                    setTimeout(() => {
                      setActive(d);
                      activeRef.current = d;
                    }, 0);
                    generation.current = savedGeneration.current = 0;
                    setModal(null);
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Restore
              </button>
            </div>
          ))}
          {!history.length && <p>No earlier saved revisions yet.</p>}
        </Modal>
      )}
      {modal === "template" && active && (
        <Modal title="Save reusable template" onClose={() => setModal(null)}>
          <label>
            Template name
            <input
              maxLength={200}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <p>
            Creates an independent reusable copy. Templates travel with
            workspace exports.
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                if (!(await save())) return;
                await api("saveTemplate", { id: active.id, name: newName });
                await refresh();
                setModal(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Save template
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Help and knowledge base" onClose={() => setModal(null)}>
          <div id="kb-top">
            <Help />
          </div>
        </Modal>
      )}
      {modal === "welcome" && (
        <Modal title="Welcome to TMA-Libraries" onClose={() => setModal(null)}>
          <div className="welcome-art">
            <Folder size={46} />
          </div>
          <h3>Your documents. A space of their own.</h3>
          <p>
            Create and organise work offline in your brown Libraries workspace.
            No account or paid service is required.
          </p>
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.settings.largeText}
              onChange={(e) =>
                setState({
                  ...state,
                  settings: { ...state.settings, largeText: e.target.checked },
                })
              }
            />
            Use larger workspace text
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.settings.highContrast}
              onChange={(e) =>
                setState({
                  ...state,
                  settings: {
                    ...state.settings,
                    highContrast: e.target.checked,
                  },
                })
              }
            />
            Use high contrast
          </label>
          <div className="inline">
            <button
              onClick={async () => {
                await api("settings", {
                  ...state.settings,
                  setupComplete: true,
                });
                await refresh();
                setModal(null);
              }}
            >
              Start creating
            </button>
            <button
              className="primary"
              onClick={async () => {
                await api("settings", {
                  ...state.settings,
                  setupComplete: true,
                });
                await refresh();
                setTourStep(0);
                setModal("tour");
              }}
            >
              Take a quick tour
            </button>
          </div>
        </Modal>
      )}
      {modal === "tour" && (
        <Modal
          title={`Your Libraries tour · ${tourStep + 1} of ${tour.length}`}
          onClose={() => setModal(null)}
        >
          <div className="welcome-art">
            <Folder size={42} />
          </div>
          <p className="tour-text">{tour[tourStep]}</p>
          <p>
            This walkthrough uses no personal document and does not alter your
            work.
          </p>
          <div className="inline">
            {tourStep > 0 && (
              <button onClick={() => setTourStep(tourStep - 1)}>Back</button>
            )}
            <button
              className="primary"
              onClick={() =>
                tourStep === tour.length - 1
                  ? setModal(null)
                  : setTourStep(tourStep + 1)
              }
            >
              {tourStep === tour.length - 1 ? "Start creating" : "Next"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function InfoIcon() {
  return <Import size={25} />;
}
