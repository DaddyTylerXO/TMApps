import { useState } from "react";
import {
  Search,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Palette,
  Keyboard,
  Settings2,
  Info,
  RefreshCw,
} from "lucide-react";
import { api, TYPES, type Settings as SettingsType } from "./types";
import { Help, ARTICLES, RELEASES } from "./Help";
export default function Settings({
  settings,
  onSave,
  onError,
  onTour,
  onRefresh,
}: {
  settings: SettingsType;
  onSave: (value: SettingsType) => Promise<void>;
  onError: (message: string) => void;
  onTour: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings),
    [section, setSection] = useState("general"),
    [query, setQuery] = useState(""),
    [report, setReport] = useState(
      "TMA-Libraries 0.2.0-dev.1\n\nError code:\nSteps to reproduce with synthetic content:\nExpected result:\nActual result:\n\nRemove private information before opening GitHub.",
    ),
    [busy, setBusy] = useState(false);
  const update = (value: Partial<SettingsType>) =>
    setDraft({ ...draft, ...value });
  const matches = (text: string) =>
    !query || text.toLowerCase().includes(query.toLowerCase());
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const support = (type: string) =>
    api(
      "external",
      "https://github.com/DaddyTylerXO/TMApps/issues/new?" +
        new URLSearchParams({
          title: `[TMA-Libraries] ${type}`,
          body: `App: TMA-Libraries\nVersion: 0.2.0-dev.1\n\n${type === "Crash report" ? report : "Describe your " + type.toLowerCase() + " using synthetic examples. Do not include credentials, private paths or document contents."}`,
        }),
    );
  const sections = [
    ["general", "General"],
    ["appearance", "Appearance"],
    ["accessibility", "Accessibility"],
    ["saving", "Saving & deletion"],
    ["branding", "Branding"],
    ["keybinds", "Keyboard shortcuts"],
    ["types", "Document settings"],
    ["help", "Help & support"],
    ["releases", "New features"],
  ];
  return (
    <div className="settings-page">
      <header>
        <span className="eyebrow">MAKE IT YOURS</span>
        <h1>Settings</h1>
        <p>Local preferences for your workspace.</p>
      </header>
      <div className="search settings-search">
        <Search size={18} />
        <input
          aria-label="Search settings and knowledge base"
          placeholder="Search settings, features and help…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="settings-layout">
        <nav>
          {sections.map(([id, title]) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => {
                setSection(id);
                setQuery("");
              }}
            >
              {title}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {(section === "general" || query) &&
            matches("general author setup tour welcome") && (
              <section className="settings-card">
                <h2>
                  <Settings2 />
                  General
                </h2>
                <label>
                  Author name
                  <input
                    maxLength={200}
                    value={draft.author}
                    onChange={(e) => update({ author: e.target.value })}
                  />
                </label>
                <button onClick={onTour}>Replay feature tour</button>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={draft.kbSearch}
                    onChange={(e) => update({ kbSearch: e.target.checked })}
                  />
                  Include knowledge base articles in settings search
                </label>
                <p>
                  All document editing and storage work offline. Support links
                  require an internet connection.
                </p>
              </section>
            )}
          {(section === "appearance" || query) &&
            matches("appearance theme brown dark light grey black colours") && (
              <section className="settings-card">
                <h2>
                  <Palette />
                  Appearance
                </h2>
                <label>
                  App theme
                  <select
                    value={draft.theme}
                    onChange={(e) => update({ theme: e.target.value })}
                  >
                    {["brown", "light", "grey", "black"].map((t) => (
                      <option key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Document pages stay white. Appearance applies to the workspace
                  and its dialogs. Scheduled gradual transitions remain pending.
                </p>
              </section>
            )}
          {(section === "accessibility" || query) &&
            matches(
              "accessibility contrast larger text screen reader magnification",
            ) && (
              <section className="settings-card">
                <h2>Accessibility</h2>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={draft.largeText}
                    onChange={(e) => update({ largeText: e.target.checked })}
                  />
                  Larger workspace text
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={draft.highContrast}
                    onChange={(e) => update({ highContrast: e.target.checked })}
                  />
                  High contrast workspace
                </label>
                <p>
                  Both options are off by default. Keyboard focus and labelled
                  controls are always available. Full editor screen-reader and
                  magnification verification remains pending.
                </p>
              </section>
            )}
          {(section === "saving" || query) &&
            matches(
              "saving autosave backup restore trash delete deletion permanent migration import export history performance",
            ) && (
              <section className="settings-card">
                <h2>
                  <ShieldCheck />
                  Saving and deletion
                </h2>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={draft.autosave}
                    onChange={(e) => update({ autosave: e.target.checked })}
                  />
                  Autosave changed documents
                </label>
                <label>
                  Autosave interval (seconds)
                  <input
                    type="number"
                    min={2}
                    max={300}
                    value={draft.autosaveSeconds}
                    onChange={(e) =>
                      update({ autosaveSeconds: Number(e.target.value) })
                    }
                  />
                </label>
                <p>
                  Shorter intervals increase disk and CPU activity. Each save
                  writes only the changed document and retains up to 20 previous
                  content revisions. A longer interval risks more recent work
                  before the next save.
                </p>
                <label>
                  Default deletion behaviour
                  <select
                    value={draft.deletionMode}
                    onChange={(e) =>
                      update({
                        deletionMode: e.target
                          .value as SettingsType["deletionMode"],
                      })
                    }
                  >
                    <option value="trash">
                      Move to Trash (restore available)
                    </option>
                    <option value="permanent">
                      Permanent deletion with confirmation
                    </option>
                  </select>
                </label>
                <p>
                  Trash has no automatic expiry. Imported source files and
                  independent exports are never removed.
                </p>
                <div className="inline">
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("exportArchive");
                      })
                    }
                  >
                    Export workspace backup
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("importArchive");
                        await onRefresh();
                      })
                    }
                  >
                    Import workspace copy
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const count = await api("migrateLegacy");
                        await onRefresh();
                        onError(
                          `Migration complete: ${count} documents added. Original files were retained.`,
                        );
                      })
                    }
                  >
                    <RefreshCw size={16} />
                    Migrate legacy workspace
                  </button>
                </div>
                <p>
                  Close the old Windows Forms application before migration.
                  Imports are validated before records are added. Files and
                  backups are unencrypted.
                </p>
              </section>
            )}
          {(section === "branding" || query) &&
            matches("branding logo organisation colour brand name") && (
              <section className="settings-card">
                <h2>Branding</h2>
                <label>
                  Organisation or brand name
                  <input
                    maxLength={200}
                    value={draft.brandName}
                    onChange={(e) => update({ brandName: e.target.value })}
                  />
                </label>
                <label>
                  Document brand colour
                  <input
                    type="color"
                    value={draft.brandColour}
                    onChange={(e) => update({ brandColour: e.target.value })}
                  />
                </label>
                <p>
                  The brand name is inserted in headers of newly created
                  document templates. Logo libraries and advanced reusable
                  branding blocks remain pending.
                </p>
              </section>
            )}
          {(section === "keybinds" || query) &&
            matches("keyboard keybind shortcuts save new search ctrl") && (
              <section className="settings-card">
                <h2>
                  <Keyboard />
                  Keyboard shortcuts
                </h2>
                {[
                  ["new", "New document"],
                  ["save", "Save"],
                  ["search", "Search"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={draft.shortcuts[key] || ""}
                      onChange={(e) =>
                        update({
                          shortcuts: {
                            ...draft.shortcuts,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))}
                <p>
                  Use combinations such as Ctrl+N or Ctrl+Shift+S. Avoid
                  duplicates. F1 opens Help. Editor-specific shortcuts retain
                  their native editor behaviour.
                </p>
              </section>
            )}
          {(section === "types" || query) &&
            matches(
              "document settings general book checklist advertisement newsletter cv cover letter pdf spreadsheet slide spell grammar",
            ) && (
              <section className="settings-card">
                <h2>Document settings</h2>
                {TYPES.map((t) => (
                  <details key={t.kind}>
                    <summary>{t.name}</summary>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={draft.editor[t.kind]?.spellcheck !== false}
                        onChange={(e) =>
                          update({
                            editor: {
                              ...draft.editor,
                              [t.kind]: {
                                ...draft.editor[t.kind],
                                spellcheck: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      Enable editor spellcheck where supported
                    </label>
                    <p>
                      {t.description}. Advanced grammar checking,
                      template-specific defaults and configurable editor
                      keybindings remain pending.
                    </p>
                  </details>
                ))}
              </section>
            )}
          {(section === "help" || query) &&
            matches(
              "help support bug issue feature crash report github privacy error",
            ) && (
              <section className="settings-card">
                <h2>
                  <BookOpen />
                  Help and support
                </h2>
                <div className="inline">
                  <button
                    onClick={() =>
                      support("Feature request").catch((e) =>
                        onError(e.message),
                      )
                    }
                  >
                    Feature request <ExternalLink size={14} />
                  </button>
                  <button
                    onClick={() =>
                      support("Bug report").catch((e) => onError(e.message))
                    }
                  >
                    Bug report <ExternalLink size={14} />
                  </button>
                  <button
                    onClick={() =>
                      support("General issue").catch((e) => onError(e.message))
                    }
                  >
                    Issue report <ExternalLink size={14} />
                  </button>
                </div>
                <p>
                  These open prefilled GitHub issue drafts for final review and
                  submission. No data is submitted automatically.
                </p>
                <label>
                  Crash report draft
                  <textarea
                    rows={9}
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                  />
                </label>
                <button
                  onClick={() =>
                    support("Crash report").catch((e) => onError(e.message))
                  }
                >
                  Review on GitHub before submitting
                </button>
              </section>
            )}
          {(section === "releases" || query) &&
            matches("version new features release notes updates") && (
              <section className="settings-card">
                <h2>
                  <Info />
                  New features
                </h2>
                {RELEASES.map((r) => (
                  <article key={r.version}>
                    <h3>{r.version}</h3>
                    <p>{r.text}</p>
                  </article>
                ))}
              </section>
            )}
          {(section === "help" ||
            (query &&
              draft.kbSearch &&
              ARTICLES.some((a) =>
                (a.id + a.title + a.text)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              ))) && (
            <section className="settings-card" id="kb-top">
              <Help query={query} />
            </section>
          )}
          <div className="settings-save">
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(() => onSave(draft))}
            >
              Save settings
            </button>
            <span>Changes apply after saving.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
