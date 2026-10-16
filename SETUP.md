# Connect Outlook / Hotmail to TMA-Mail

This build has real IMAP and SMTP code. Microsoft requires an app registration before it can issue sign-in tokens to TMA-Mail. The registration is a one-time developer setup; users then sign in through Microsoft. No client secret is used by this desktop app.

## 1. Register TMA-Mail

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) and sign in with an account that can register applications in an Entra directory. If your personal account has no directory access, you will need access to a directory or a Microsoft developer tenant first.
2. Go to **Identity → Applications → App registrations → New registration**.
3. Enter **TMA-Mail** as the name. Choose **Accounts in any organizational directory and personal Microsoft accounts** so Outlook.com/Hotmail accounts can sign in. This build uses the `common` authority.
4. Register the application and copy its **Application (client) ID** from Overview. This ID is public; it is not a password.
5. Under **Authentication → Advanced settings**, enable **Allow public client flows**. The app uses Microsoft's device-code flow; no redirect URI or client secret is required for that flow.
6. Under **API permissions**, add the **delegated** Outlook/Exchange permissions `IMAP.AccessAsUser.All` and `SMTP.Send` (Office 365 Exchange Online). The app requests those full Outlook resource scopes, plus `offline_access` for token renewal. Do not select the application-only `...AsApp` permissions. Work tenants may require administrator consent.

Microsoft documents the [registration and Outlook IMAP/SMTP OAuth scopes](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth) and the [device-code public-client flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).

## 2. Connect inside TMA-Mail

1. Extract the entire portable ZIP and open `TMA-Mail.exe`.
2. Select **Connect an account**. Choose **Microsoft** and enter your Outlook/Hotmail address and the public client ID.
3. Keep IMAP `outlook.office365.com`, port `993`, and SMTP `smtp-mail.outlook.com`, port `587`. For Microsoft 365 work accounts, your administrator may specify `smtp.office365.com` instead.
4. Select **Sign in & test connection**. TMA-Mail shows a temporary code.
5. Select **Open Microsoft sign-in**, enter the code on Microsoft's page, sign in to the same mailbox, and review the requested access.
6. TMA-Mail tests both receiving and sending connections before saving the account. It then loads your mail automatically. **Sync** also refreshes manually; automatic refresh runs every 60 seconds while the app is running.

If Microsoft reports that IMAP is disabled, enable IMAP in your Outlook mail settings if available. Work accounts may need administrator changes to permit IMAP and authenticated SMTP. The app never falls back to an unencrypted connection or ignores certificate errors.

## 3. First live verification

After sign-in, verify incoming mail and a small message to an address you own, then confirm reply, attachment, read/star, and Trash/restore behavior. This has **not yet been performed for this release**: no Microsoft client ID or account authorization was available during development. Automated tests use synthetic data and a fake delivery function, never your mailbox.

If a send is interrupted, check the server's Sent folder and the recipient before retrying. TMA-Mail keeps the draft and warns about uncertain delivery. SMTP acceptance means the server accepted the message; final delivery can still fail or bounce.

## Gmail and other providers

- **Gmail:** choose Gmail, enter your address and a [Google app password](https://support.google.com/accounts/answer/185833). Google requires 2-Step Verification for app passwords; some accounts cannot use them. Gmail OAuth browser sign-in is not included in this build.
- **Other IMAP:** enter the server hosts, ports, username, and provider-supported app password. IMAP port 993 uses implicit TLS; other IMAP ports require STARTTLS. SMTP 465 uses implicit TLS; other SMTP ports require STARTTLS. Servers must advertise special-use folders for Sent, Trash, and Archive.

## Storage and disconnecting

Account secrets and live mail are protected with Windows DPAPI under `%LOCALAPPDATA%\TMA-Mail`. Disconnect removes the saved credentials, returns to the sample mailbox, and retains the encrypted cache for reconnection. It does not revoke existing Microsoft consent; manage that through your Microsoft account. Settings/signature templates and the older sample mailbox remain local unencrypted JSON. DPAPI files are tied to the Windows user; copying them to another computer is not a backup strategy.

This beta supports one active account, the latest 200 messages in Inbox/Sent/Archive/Trash, local drafts, and text reading of received HTML. Messages over 25 MB are excluded from this initial sync window. Custom server folders, full-history download, Gmail OAuth, a signed installer, and live-provider certification remain future work.
