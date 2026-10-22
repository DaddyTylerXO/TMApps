# Libraries catalog repair

The TMA-Libraries branch at `64c3e97ab51ac1e0fcc14a098f2539e36bd7f092` contains the Windows Electron preview `0.2.0-dev.1`. A source push did not publish its package or update the shared launcher catalog, which still advertised `0.1.0`.

Publish `TMA-Libraries-0.2.0-dev.1-windows.zip` with SHA-256 `8e3d3bf8a44a7003042a4e0338d06188ed4d05b8c9ed9629a7f1631212b91e75`, then replace only its public catalog entry. Other public app entries and launcher binaries are preserved. The package contains the complete Electron directory, runtime licences, AGPL licence and public source reference. Packaged desktop sources match the branch after line-ending normalization.

Verification performed on Windows x64 with disposable data:

- 24 storage and document-format test groups passed.
- Packaged editor workflow passed before and after launcher installation: Home, folders, checklists, DOCX typing and saved OOXML, spreadsheet, slides, PDF, books, settings, Trash/Restore and deletion confirmation. No renderer exceptions.
- Actual launcher engine installed legacy 0.1.0, upgraded to 0.2.0-dev.1 with checksum verification, and uninstalled the disposable copy. Personal data deletion was disabled in the verifier.
- Installed startup was 1,230 ms. Sum of process working sets after all editors was approximately 846 MiB; sampled process CPU sum approximately 0.84%. An earlier sample was approximately 896 MiB. Memory exceeds the app's 500 MiB target; this remains a development preview.
- Bounded credential-pattern checks passed for 35 source files and 183 packaged application text files, with manual review of package contents and staged changes. This is not a full security audit.
- Launcher KB14 was updated with publication, migration, data-retention and performance guidance, illustrated with a real synthetic preview capture. The regenerated Word KB has 12 visually reviewed pages and 69 verified internal hyperlinks.

The new app uses a separate roaming `TMA-Libraries/library-v2` profile. Legacy workspace data remains untouched. Launcher 1.14.2's Delete local data action covers only the legacy Libraries location; the preview profile is retained. Back up/export before migration. No macOS/Linux Libraries package or signing is claimed. Broader launcher and companion feature work remains paused and is excluded from this repair.
