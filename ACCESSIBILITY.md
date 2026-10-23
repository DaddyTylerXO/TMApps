# Accessibility status

TMApps is working toward accessible desktop apps. Requirements in APP-STANDARDS.md
are acceptance criteria; they do not establish that every app is accessible or
certified. This statement records the limits of current evidence on 23 October 2026.

Mail documents configurable layouts and dark/light appearances. Libraries source
documents setup accessibility choices and settings search, while its verification
record explicitly leaves broader screen-reader, high-DPI, resizing and keyboard
editor validation open. These source descriptions are not independent assistive
technology test results or a guarantee for a published package.

All apps are required to retain semantic labels and keyboard access, offer optional
screen-reader, larger/dynamic text, magnification, contrast and dark-mode choices
during setup and in Settings > Accessibility, and respect reduced motion. Optional
adaptations start off until selected; baseline accessibility APIs remain available.
Tours must keep targets visible and unblurred with adjacent dialogs. Notifications
and status indicators must not rely on colour alone.

Per-app screen-reader testing, focus order, scaling/clipping, contrast, theme and
native OS coverage remain open until recorded with app version and test evidence.
See the affected branch's APP-COMPLIANCE.md; no WCAG or other certification is
claimed by this statement.

Report a barrier using [the bug form](https://github.com/DaddyTylerXO/TMApps/issues/new?template=bug-report.md).
Include app/version, OS/build, assistive technology/version, affected screen and
steps using synthetic data. Explain the expected accessible behaviour. Review
screenshots and logs before posting; never attach personal account data.
