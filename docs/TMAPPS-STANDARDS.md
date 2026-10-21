# Mandatory TMApps standards

Source: requirements provided by Tyler on 21 October 2026. These rules apply to every TMApps application; this repository tracks their application to TMA-Libraries. Initial implementation and limitations are recorded in [VERIFICATION-0.1.0.md](VERIFICATION-0.1.0.md); partial requirements remain unchecked.

## Distribution and support

- [ ] Link every application to its GitHub branch. TMA-Libraries target: `DaddyTylerXO/TMApps`, branch `TMA-Libraries`. The local Git remote and Settings link use this destination; source publication is being verified separately from application package distribution.
- [ ] Upload/register the application with TMApps-Launcher.
- [ ] Add a Feature Request button in Settings linked to the appropriate GitHub form.
- [ ] Add a Bug Report button in Settings linked to the appropriate GitHub form.
- [ ] Add an Issue Report button in Settings linked to the appropriate GitHub form.
- [ ] Add a Help button in Settings linked to the KB Library, GitHub Discussions, or FAQ.
- [ ] Offer a guided feature tour during first-time setup and make it available again in Settings. Update it when new features are implemented.
- [ ] Add a New Features button in Settings listing version numbers and the features added in each version.

## Knowledge base

- [ ] Upload a Word document named `(App Name) KB Library` to each application's GitHub branch, containing KB numbers, information, screenshots, and photos where appropriate.
- [ ] Provide a KB Library in Settings/Help with user guides, setup instructions, general knowledge, common issues, and an error-message catalogue.
- [ ] Give errors actionable resolution steps and instructions for logging persistent faults on GitHub.
- [ ] Divide articles into stable KB numbers, such as `Mail-KB1`; allow cross-references between KB articles. Proposed Libraries prefix: `Libraries-KB`.
- [ ] Make KB articles discoverable in Settings search and provide a setting to disable this search integration.
- [ ] Brand child-branch KB documents with the application's assigned colours and app name/logo on every page.
- [ ] Link and reference the master KB on the first page of each app KB document.
- [ ] Document which features work offline and which require connectivity.
- [ ] Maintain a master KB Word document on the main branch listing all TMApps and every child-branch KB article.

## Diagnostics and costs

- [ ] Build crash reporting that captures relevant error messages and fills the appropriate GitHub issue template.
- [ ] Provide an Upload to GitHub Issues button for the prepared crash report.
- [ ] Enforce the zero-cost plan: do not implement features that incur costs; find a free alternative or omit the feature.

## Desktop experience

- [ ] Provide dark mode with toned-back grey and black appearance options in Settings.
- [ ] Allow scheduled appearance changes at configured times and gradual transitions to the selected mode.
- [ ] Let users configure transition duration, including examples such as 2 minutes and 30 minutes.
- [ ] Add an online/offline indicator following the TMA-Mail implementation.
- [ ] Support desktop push notifications.
- [ ] Use the TMA-Mail tray icon right-click menu design.

## Performance, security, and accessibility

- [ ] Keep resource consumption low; explain which features affect CPU, memory, disk, network, or other resources in Settings and how users can reduce the impact.
- [ ] Perform performance optimisation and testing after every update.
- [ ] Check all apps for exposed API keys, private information, and sensitive data; remove any uploaded sensitive data and address the exposure.
- [ ] Offer screen reader integration, dynamic type/text scaling, magnification, colour contrast, and dark mode accessibility options.
- [ ] Keep optional accessibility settings off by default, prompt during setup, and make them available under Settings > Accessibility.

## Completion evidence

Every completed item should have an implementation reference and suitable verification. External deliverables also need a confirmed destination, published artifact or registration, and working links. A specification, placeholder button, or simulated integration does not complete a requirement.
