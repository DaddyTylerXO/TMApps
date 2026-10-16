using System;
using System.Reflection;
using System.Runtime.Versioning;
using MailKit;
using MailKit.Security;
using Postbox;
[assembly: TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]
class TlsSmoke {
    static void Probe(string factory, string host, int port, SecureSocketOptions mode) {
        using (var client = (MailService)typeof(Postbox.MailTransport).GetMethod(factory, BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, null)) {
            client.Timeout = 15000;
            if (!client.CheckCertificateRevocation || client.ServerCertificateValidationCallback != null) throw new Exception("Standard certificate checks must remain enabled.");
            client.Connect(host, port, mode);
            if (!client.IsSecure || client.IsAuthenticated) throw new Exception("Expected an encrypted, unauthenticated connection.");
            Console.WriteLine(host + ":" + port + " connected securely using " + client.SslProtocol + "; standard certificate validation and revocation checks enabled; no login attempted.");
            client.Disconnect(true);
        }
    }
    static int Main() {
        try {
            var target = (TargetFrameworkAttribute)Attribute.GetCustomAttribute(typeof(App).Assembly, typeof(TargetFrameworkAttribute));
            if (target == null || target.FrameworkName != ".NETFramework,Version=v4.8") throw new Exception("TMA-Mail must target .NET Framework 4.8.");
            Probe("CreateImapClient", "imap.mail.me.com", 993, SecureSocketOptions.SslOnConnect);
            Probe("CreateSmtpClient", "smtp.mail.me.com", 587, SecureSocketOptions.StartTls); return 0;
        } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
