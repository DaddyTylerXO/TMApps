# TMA-Libraries development guidance

These instructions apply to the entire repository.

- Preserve the branch's shared TMApps guidance in `APP-STANDARDS.md`, `.cursor/rules/app-standards.mdc`, and `.cursor/rules/security-data.mdc`. Follow the sensitive-data publishing restrictions for every commit, push and release, and carry them forward to future TMApps projects. The user's approved Libraries colour and white folder icon below supersede the previously unselected branding fields.

- Treat `docs/TMAPPS-STANDARDS.md` and `docs/TMA-LIBRARIES-SPEC.md` as the user's requirements. Preserve requirements when reprioritising work.
- Keep pending requirements unchecked. Mark complete only after implementation and appropriate verification; record material limitations.
- Use Leather Brown `#97572B` and a white folder on a brown background for app branding. Verify accessible contrast for actual text/control combinations.
- Use the supplied `TMA-Libraries` branch in `DaddyTylerXO/TMApps`. Do not invent remote paths, launcher contracts, GitHub form links, or sibling-app APIs.
- Implement features without required paid services or other incurred costs. Find a free alternative or leave the feature unimplemented and explain why.
- Design local editing and storage for offline use; document which operations require connectivity.
- Follow the TMA-Mail tray menu and connection indicator patterns after inspecting their source or supplied references.
- Provide settings for support links, KB search, tours, appearance, accessibility, history, backups, document types, keybinds, branding, and release notes as specified.
- Keep accessibility options off by default and offer them during setup; retain baseline keyboard access and semantic controls.
- Update the feature tour, version notes, and relevant KB content as features change.
- KB deliverables must be Word documents, branded on every page with the app name/logo, and reference the master KB on the first page. Markdown specifications do not fulfill this deliverable.
- Keep sensitive data, credentials, document contents, and passwords out of source control and diagnostic reports. Let users review crash reports before submitting them.
- Use established encryption and secure redaction implementations; do not equate visual overlays or hidden controls with protection.
- Perform and record appropriate performance optimisation/testing and security checks for every application update. Explain performance-sensitive settings to users.
- Verify durable saves, imports/exports, and recovery where affected. Do not claim file-format compatibility without representative round-trip checks.
