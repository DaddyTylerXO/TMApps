# Mail-KB3 Preview privacy and offline behaviour

Updated 23 October 2026. Applies to source preview 0.17.0-preview.1.

The sample interface works offline. Reading, searching, starring, marking read, deleting, restoring and resizing sample panes do not contact a mail provider. The sample changes are not saved across restarts. This is not yet the requested durable offline outbox or offline-action queue.

Installing the SDK, restoring dependencies, downloading CI archives and opening online documentation require connectivity. Real provider login, synchronisation and sending will require provider access when they are connected to the new interface; those workflows are not available in this preview.

The shared core retains normal TLS certificate checks. The new encrypted profile-file component uses AES-256-GCM, a new nonce per write and profile-bound authentication. It requires a key supplied by a vault adapter and never creates a plaintext fallback. Native keychain/keyring integration is unfinished, so the sample interface does not persist real accounts or credentials. Encryption tests are evidence about the component, not a claim that native vaults are complete.

Windows DPAPI files are not portable profile exports. Do not copy the installed app's account or mail profile into the preview. A controlled migration route for local-only data remains outstanding.

Public builds copy only the public provider configuration. Google client secrets, app passwords, tokens, private profiles and live mail must remain off GitHub, screenshots, documents and CI artifacts. The local test fixtures and build caches are ignored. CI uploads only scanned sample previews, rendered sample UI images and sanitized startup measurements.

The public Windows release remains the supported application. macOS/Linux versions, signing, installation/update/uninstall behaviour, rich-email rendering and full feature parity still need native validation. Consult [PORTABILITY.md](../PORTABILITY.md) and [APP-COMPLIANCE.md](../APP-COMPLIANCE.md) for open gates.

[Back to index](kb-registry.json)
