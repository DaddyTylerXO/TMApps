# Verification record for 0.1.0

Date: 21 October 2026. Platform: this Windows x64 development environment, .NET Framework compiler v4.0.30319. Local build; not an installer or published release.

## Executed checks

`./build.ps1 -Test` compiles without third-party packages and executes 20 storage checks and 10 desktop assertions. `tests/StorageChecks.cs` uses synthetic content in an isolated build directory and removes it after testing. `MainWindow.RunSmoke` uses a separate isolated workspace and disposes it after testing.

Storage checks cover clean start and optional accessibility defaults; Unicode, multiline text, side notes, favourite/folder metadata and checklist persistence across a new Store instance; previous-save backup; exact native workspace export/import round trip; abandoned partial temporary file; corrupt-primary recovery; a valid backup after recovery; failure without blank replacement when both copies are corrupt; missing-primary recovery; invalid schema, IDs, duplicate IDs, document kinds, folder references, ambiguous names and oversized files; locked-destination failure preserving the committed save and cleaning temporary files; and a 1,000-document workload.

Desktop assertions cover editing bindings, checklist completion/progress, saving, favourites filtering, recent documents, Unicode search, reloading saved content, Black/high-contrast themes and hiding checklist progress. The synthetic desktop screenshot was visually inspected at 1280×820 and at the 1050×680 minimum window size with larger text. A visible new-item label and horizontal navigation scrolling were added after inspection.

Storage recovery is tested using simulated partial writes and corruption. A real power-loss test, reboot, disk failure, multi-session access and full operating-system crash are not verified. The single-instance guard applies to the current Windows session. Other Windows sessions using the same profile must not run the app concurrently.

## Performance observations and design

Representative local run before final UI-only adjustments: 1,000 synthetic notes with 4,096-character bodies, 4,407,071-byte workspace: save 31 ms, load 49 ms; storage-test working set approximately 50 MiB. Desktop one-second idle sample: 1,030 ms elapsed, 0 ms observed CPU time at the process timer resolution, approximately 47 MiB working set. These observations are not cross-device guarantees or proof of zero idle CPU.

Optimisation: autosave serialises only when dirty, runs on a single UI timer, has no network polling and avoids a package/browser runtime. Store writes are flushed before replacement. Settings and Libraries-KB4 explain CPU/disk costs and the interval/loss tradeoff. Search and whole-workspace saves run synchronously; very large bodies may pause the UI. The 16 MiB/10,000-document guardrails are not scale-validation claims. Startup timing, long-duration memory behaviour and testing at maximum scale remain pending.

## Security review

- `scripts/security-check.ps1` scans source/test/scripts for common token/private-key patterns without printing matching material. No matches in the reviewed source. This is not a full audit or repository-history incident investigation; this local branch has no commits.
- No network client, credentials, telemetry or automatic report uploads in this application. The sole external destination is the user-supplied GitHub branch opened on request.
- Storage lives outside the source tree by default. Build/test data, exports and workspace files are ignored. No real user document content was used in tests or screenshots.
- Size/schema/content validation precedes import mutation. Imports are data, not executable code. No macro execution, deserialised runtime types or HTML rendering.
- Errors use fixed guidance and error codes; exception details, paths and document contents are not written to diagnostic logs. Raw framework exception popups are disabled in favour of the guarded startup/event-loop handler.
- Files and exports are unencrypted; encryption and secure PDF redaction remain unimplemented. No claim of protection through labels or hidden controls.
- Atomic replacement is verified on the local test filesystem; removable/network filesystems and security ACL inheritance require separate deployment checks. Current-user NTFS permissions provide the present protection boundary.

## Contrast and accessibility

Computed WCAG relative-luminance contrast for white on Leather Brown #97572B: **5.65:1**, above 4.5:1 for normal text. The primary action and selected document rows use this combination. Normal Light text is dark on near-white; Grey/Black use white text; tag chips use black on light pastel fills. Tags remain readable by text without relying on colour meaning. Optional larger text/high contrast start off. Controls have native keyboard focus and accessible names; document objects expose titles through ToString for native list accessibility.

Real screen-reader sessions, magnification, every high-DPI level, all modal dialogs at large text and colour-vision testing remain pending. Larger text is an initial adjustment, not full dynamic type support. No optional screen-reader integration is claimed.

## Word KB and external dependencies

The Word draft has a shared app/logo header, footer, article identifiers, a synthetic application screenshot, offline limits and error guidance. DOCX XML parts parse. `render_docx.py` was attempted but failed because `soffice.exe` is unavailable; no rendered pages were produced. Visual layout verification remains pending; the file is labelled a draft in Settings and README. The first page records the missing master KB destination without inventing a document URL.

Local TMA-Mail and Launcher folders inspected contain only Git metadata, so their source/design/contracts could not be inspected. The main-branch local SUPPORT.md contains support links, but app-appropriate live template availability has not been verified. Support-form buttons remain pending. The master KB document was not found in the inspected local main-branch files. No main-branch documents or Launcher registrations were changed.

## Source publication

The owner requested publication to the existing `TMA-Libraries` branch. Its existing history, shared policies and GitHub issue templates are preserved. The Word draft is deliberately excluded: `APP-STANDARDS.md` requires rendering and inspecting all pages before upload. The source builder remains available, and no signed package or installer is represented as released. Existing issue-template filenames contain asterisks that Windows cannot check out; their remote tree entries are preserved without renaming them.

Remaining release gates include Word render QA, setup/tour modal and real keyboard/screen-reader sessions, clean install on another Windows machine, real power interruption, verified integration/support destinations, packaging/signing decisions and GitHub/Launcher publication. All unrelated requirements remain pending.
