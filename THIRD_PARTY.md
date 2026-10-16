# Third-party components

TMA-Mail uses MailKit 4.17.0 and MimeKit 4.17.0 (MIT), BouncyCastle.Cryptography 2.6.2 (MIT), and Microsoft .NET support libraries (MIT). Copyright and license notices are in `licenses/` and included in the portable package.

Pinned support packages: System.Formats.Asn1 8.0.1, System.Threading.Tasks.Extensions 4.6.3, System.Buffers 4.6.1, System.Memory 4.6.3, System.Runtime.CompilerServices.Unsafe 6.1.2, System.Numerics.Vectors 4.6.1, and System.ValueTuple 4.5.0. `restore.ps1` downloads packages from the official NuGet flat-container feed. Windows WPF, speech, and media APIs are supplied by Windows/.NET Framework.

Provider sign-in adds Microsoft.Identity.Client 4.91.0 and Microsoft.IdentityModel.Abstractions 8.14.0 (MIT), Google.Apis.Auth / Google.Apis.Core / Google.Apis 1.73.0 (Apache-2.0), and Newtonsoft.Json 13.0.4 (MIT). Support dependencies: System.Diagnostics.DiagnosticSource 6.0.1, System.Text.Json 8.0.6, System.Text.Encodings.Web 8.0.0, and Microsoft.Bcl.AsyncInterfaces 8.0.0 (MIT). Corresponding license notices are included in `licenses/`.

HTML reading uses Microsoft.Web.WebView2 SDK 1.0.4191.47 under Microsoft's WebView2 SDK license (not MIT). SDK license and notices are included as licenses/WebView2.txt and licenses/WebView2-NOTICE.txt. The Microsoft Edge WebView2 Runtime is a separate Microsoft component installed on the user's PC.
