# TMA-Mail delivery roadmap

Updated 23 October 2026. The owner's 75-item backlog is retained below. macOS/Linux compatibility is the critical first priority; foundational documentation and regression checks accompany that work. No delivery dates are promised before the native validation gates pass.

## Current increment

- [x] Extract account/message models and share mail transport, MIME, sync and provider-login source between the Windows app and a modern .NET core.
- [x] Build a sample-only Avalonia mailbox with working search, read/star/delete/restore and resizing.
- [x] Add authenticated, atomic profile-file encryption with no plaintext fallback, plus integrity and cancellation checks.
- [x] Pass the existing Windows regression suite and the modern synthetic/headless checks.
- [x] Smoke-test the self-contained sample window on this Windows x64 host and record startup/memory/idle CPU.
- [ ] Complete and inspect native macOS/Linux CI results; then test real account flows on target systems.
- [ ] Implement native vault adapters, account repositories and mailbox UI wiring.
- [ ] Prove secure HTML rendering, rich composing, provider login and existing-data migration on each OS.
- [ ] Port remaining mail/calendar/desktop features and verify install, update, uninstall, signing and accessibility.

## Accepted feature backlog

All items remain open until their complete acceptance criteria pass. Existing partial features do not establish completion.

1. **Critical:** production macOS and Linux compatibility with Windows support retained.
2. Grey/black appearances and scheduled gradual theme transitions with configurable duration.
3. Optional website MFA-code autofill.
4. Mailbox auto-sort service.
5. Folder-specific sounds and alerts through settings and context menus.
6. Composer Format Painter.
7. The requested Dictate Text read-aloud action, supporting selection before or after activation.
8. Notes screen and two-way TMA-Libraries synchronisation.
9. First-run layout/preference checklist.
10. First-run feature tour, replayable from settings and maintained with new features.
11. Improved spelling/grammar checks and accessibility controls.
12. Composer emoji picker.
13. Giphy/Tenor composition support, subject to the compulsory zero-cost integration gate.
14. Meeting creation through services such as Teams and Slack.
15. Configurable Favourites placement above mailboxes and optional removal of the Favourites tab.
16. Expanded Standard/Compact view settings.
17. Saved searches, search history, rerun and clear-history controls.
18. Advanced search parameters and their settings.
19. Durable offline actions/outbox, surviving app restarts and replaying safely after reconnect.
20. Fix unsubscribe HTTP 308 failures and refine error handling.
21. Dashboard screen with widgets and inbox analytics.
22. Block Email and Remove From Unsubscribe List actions.
23. Phishing indicators/checklist and optional free checking-service integration.
24. Arrival rules for filing, deleting and replying.
25. Expanded macros for tagging/replies and precise date/time actions.
26. App/email PIN/passcode/master-password locking, inactivity lock and notification preferences while locked.
27. Keybind editor, including folder-specific move shortcuts.
28. Independent interface/list/reading/composing font settings.
29. Unanswered-email/chase reminders through composing, calendars and context menus.
30. Per-mailbox and subfolder notification configuration.
31. Optional pre-send account confirmation and the requested email-template screen.
32. Change the sending account inside the composer.
33. Default sending account preference.
34. Contacts screen, editable details/notes, address context actions and hover cards.
35. Scheduled sending with clear closed-app/online requirements.
36. Tracker blocking through Security settings and Mailbox Management.
37. Optional typing sounds, off by default, with presets/custom audio.
38. Drag emails into folders.
39. Audit log of the latest 100 moves, replies, sends and tags.
40. Drag emails outside the app.
41. Custom dashboard creation and configurable analytics views.
42. Attachment panel at the top/side of the reader with move/hide settings.
43. Preview Pane visibility toggle.
44. TMA-Libraries book integration.
45. CSV exports for selected timeframes and email analytics.
46. Labels and follow-up/chase timers through composition and context menus.
47. Better signature editing, import/export and sharing.
48. Calendar-linked annual-leave/out-of-office signature dates.
49. Automatic replies in settings and mailbox context menus.
50. Out of Office through profile/settings.
51. Sender-grouped views and bulk sender cleanup.
52. Optional Catch Up screen for activity, contacts, important mail and analytics since the last visit.
53. Email database-file management settings.
54. Separate mail profiles and tray profile switching.
55. Turn highlighted email content into to-do items, synchronised with TMA-Libraries.
56. App/mailbox/folder notification snoozing and Do Not Disturb, including timed/indefinite presets.
57. Profile photo, name, date of birth, pronouns and Out of Office controls.
58. Email summaries in bullet, important-information and condensed forms, subject to the zero-cost gate.
59. Performance budgets/regression checks after updates and resource-impact guidance in settings.
60. Toggleable help/question-mark access to setup/provider/calendar KB guides.
61. Drag files into composed messages.
62. Sensitivity markings and toolbar visibility control.
63. Hide folders/inboxes through context menus.
64. Configurable real-time/every-X-minutes synchronisation.
65. Favourite integrations and plug-in library.
66. Folder/inbox colour indicators based on message thresholds.
67. Reliable advanced formatting including bullets, fonts and alignment.
68. Feature Request button linked to the verified GitHub form.
69. Bug Report button linked to the verified GitHub form.
70. Issue Report button linked to the verified GitHub form.
71. Help links to the KB, FAQ or enabled Discussions.
72. Settings keyword search.
73. Branded Word KB Library on GitHub with stable article IDs and screenshots; initial migration articles are implemented, full app coverage remains open.
74. In-app KB Library, cross-references and optional inclusion in Settings search.
75. Reviewed crash reports with a GitHub upload action; clarify the original error-message wording before implementing submission.

The compulsory suite standards add acceptance gates for every item: safe publication, zero-cost integrations, accessible approved UI, documentation, OS evidence and performance. See [APP-STANDARDS.md](APP-STANDARDS.md), [APP-COMPLIANCE.md](APP-COMPLIANCE.md) and [PORTABILITY.md](PORTABILITY.md).
