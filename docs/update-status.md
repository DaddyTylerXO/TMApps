# Requested update status

| Request | Release status |
|---|---|
| macOS and Linux compatibility before other updates | Existing x64/ARM64 DMG/AppImage paths audited; source and packaged checks run in release CI. Launcher support remains separate from app support. |
| Smooth selected-app sign-in | Service, clients, protected storage, permissions, and handoff primitives prepared. Activation needs operator project configuration, deployed backend integration tests, and broker/consumer support in each app. No automatic sign-in claim is made for current apps. |
| App details version features video screenshots | Implemented. One video and ten image slots per app; existing app-branch media used. Unprovided media is explicitly unpublished. |
| Star reviews | Skipped at user request; no ratings data collection. |
| Toned-down dark appearance | Orange, Grey and Black choices, with preview and cancellation. |
| Performance notes and tests after updates | Settings explanations and release resource budgets implemented. |
| Feature bug and issue buttons | Matching prefilled GitHub forms, accessible through Help. |
| Help and KB Library | Twelve searchable numbered guides with cross references. |
| Settings search and optional KB results | Implemented; disabling KB results leaves Help available. |
| Word KB Library on GitHub | `docs/KB Library.docx`, generated from the same article content and attached to the release. |
| Built-in crash report | Local redacted drafts with error information; explicit review and GitHub submission step. No background uploads. |

Sign-in activation inputs still needed: Supabase project HTTPS URL and publishable/anon key, operator deployment and SMTP setup. Do not provide service-role keys in the launcher or source repository. See `backend/README.md`.
