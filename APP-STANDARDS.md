# TMApps Launcher compulsory app standards

- Project branch: [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher)
- Launcher branch: [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher)
- App colour: Burnt orange #CC5500.
- App icon: White rocket on the burnt orange rounded tile.
- KB numbering: Launcher-KB1, Launcher-KB2 and onward; preserve any established IDs.

## Compulsory requirements

These are acceptance criteria for all current and future apps, not a claim that
the features below already exist. Assess and track implementation gaps in each
app. A policy-only change does not authorize an app release or version bump.

- [ ] **GitHub branch:** Upload project work to the exact branch linked above.
  Preserve existing work and release history; never force-push without approval.
- [ ] **TMApps Launcher:** Publish the app through TMApps Launcher with its correct
  name, icon, version, update date, release notes and verified package links and
  SHA-256 checksums. Preserve other catalog entries and show OS support only for
  published working packages. Keep Agent Office last and SocialsManager immediately
  before it. For the launcher itself, maintain its installer and self-update feeds
  rather than adding a recursive launcher catalog entry.
- [ ] **UI and icon:** Match TMApps Launcher and TMA-Mail with rounded bubble buttons,
  panels and dialogs. Apply the app colour consistently. Use the approved white
  icon on a rounded background in that colour, consistently in the app, installer,
  shortcuts, tray/menu bar and launcher listing. Preserve accessible contrast,
  keyboard operation and text readability.
- [ ] **Windows macOS and Linux:** Provide native-compatible builds for all three
  operating systems. Test supported architectures on matching OS runners, including
  packaged launch/install/update/uninstall behaviour where applicable. Do not
  advertise an unsupported build, a Windows-only dependency or a renamed EXE as
  cross-platform support. Record remaining porting work and signing limitations.
- [ ] **Tray menu:** Follow TMA-Mail's rounded tray right-click menu design using
  the app colour. Verify open, close-to-tray and quit behaviour. Document any native
  OS/desktop fallback where the system controls tray/menu-bar menu styling.
- [ ] **Desktop notifications:** Follow TMA-Mail's established desktop notification
  design and behaviour, adapted to the app colour. Verify click/dismiss behaviour,
  notification preferences and permissions. Document platform styling limitations.
  Keep sensitive content out of notifications unless explicitly opted into.
- [ ] **Appearance:** Offer a dark mode with toned-back Grey and Black palette
  choices alongside the app accent. Keep dialogs, menus and settings consistent;
  persist preferences and retain readable contrast.
- [ ] **Settings and performance:** Explain which features affect startup, CPU,
  GPU, RAM, disk or network use and how users can reduce their impact. Optimize
  resource use and run appropriate functional and performance checks after every
  code update. Compare startup/idle measurements with recorded budgets or prior
  results; investigate regressions before release. Exercise changed costly features
  such as media playback or background work. Do not claim checks that were not run.
- [ ] **Feature request:** Provide a clearly labelled button opening the appropriate
  GitHub feature-request form with the affected app identified.
- [ ] **Bug report:** Provide a clearly labelled button opening the appropriate
  GitHub bug-report form with the affected app identified.
- [ ] **Issue report:** Provide a separate clearly labelled button opening the
  appropriate general-issue form. Ensure all three destinations work on the actual
  repository/default branch, or use matching prefilled GitHub issue forms.
- [ ] **Help:** Provide a Help entry leading to the app's KB Library, relevant
  GitHub Discussions or FAQ, with working links and clear setup guidance.
- [ ] **Settings search:** Let users find specific settings by keywords and make
  relevant results navigable to the actual controls or sections.
- [ ] **Word KB Library:** Publish a Word document called `KB Library.docx` containing
  numbered guides, relevant real screenshots and accurate instructions. Maintain
  it with every relevant update. Preserve clickable KB/index buttons and Back to
  index navigation; verify bookmarks and render/inspect all pages before upload.
  Use an app-specific asset filename for a shared release so it cannot overwrite
  another app's document. Use sanitized example data in every image and example.
- [ ] **In-app KB and search:** Provide user guides, setup information and general
  knowledge under Settings/Help. Number articles using the app name after `TMA-`,
  for example `Mail-KB1`, `Safe-KB1` or `Finance-KB1`; retain established IDs and
  never renumber old references. Link cross-references to the matching sections.
  Include KB articles in settings search with a setting to turn those results off;
  keep the full library available through Help. Keep in-app and Word content aligned.
- [ ] **Built-in crash report:** Prepare a report with app/version/platform and
  relevant error messages, filling the matching GitHub issue template. Provide
  an Upload to GitHub Issues action and let users review/edit the sanitized draft
  before submission. If it opens GitHub for final submission, label that accurately.
  Never upload silently or expose credentials, private files or unredacted secrets.

## Completion and maintenance

Review these requirements whenever implementing an update. Update existing KBs
or add new ones, refresh affected screenshots and retain stable clickable links.
Record tests, performance results, remaining gaps and platform limitations. For
policy-only changes with no user-facing KB impact, record that assessment instead
of inventing an article. Follow existing app release approval requirements.

Apply the same standards to future TMApps projects. Resolve the real branch URL,
app name, KB prefix, approved colour and white icon before publishing a new app;
do not ship literal BRANCH LINK, COLOUR or ICON CHOICE placeholders. Never commit
secrets or sensitive security data; retain the security and KB maintenance rules.
