# TMA-Mail web-tool plug-ins

Version 0.10 supports installing JSON manifests for web tools. Choose Settings → Add-ins / plug-ins → Install plug-in, then open enabled tools through Apps in the mailbox toolbar. Installation and enable/disable changes take effect immediately. Removing a manifest removes its launcher; it does not uninstall anything from your browser.

Use the included `example.tmaplugin.json` as a template. Required fields are `Id` (lowercase letters, numbers, hyphens; at most 64 characters), `Name` (at most 100 characters), and an absolute HTTPS `Url`. `Version` is a display string. Reinstalling the same Id replaces the manifest.

Tools open in the default browser. TMA-Mail supplies no messages, addresses, tokens, or account permissions to them. This format does not load DLLs, scripts, executable files, or Outlook manifests into the mail client. Normal browser behaviour, including existing cookies and sign-in, still applies to the destination website.

Outlook Office.js add-ins depend on Microsoft's Office host APIs. COM and VSTO add-ins depend on Outlook's native host. This release does not implement those APIs and cannot run Outlook add-ins. See [Microsoft's Outlook add-ins overview](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/outlook-add-ins-overview).
