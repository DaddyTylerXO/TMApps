using System;
using System.Threading;
using MailKit.Security;

namespace Postbox {
    public sealed partial class MailTransport {
        public MailTransport(MailAccount value, AccountStore storage, bool persist = true)
            : this(value, delegate(MailKit.IMailService client, MailAccount account, CancellationToken cancellation) {
                if (ProviderLogin.UsesOAuth(account)) {
                    ProviderLogin.Refresh(account, false, cancellation); cancellation.ThrowIfCancellationRequested();
                    if (persist) storage.SaveTokens(account);
                    client.Authenticate(new SaslMechanismOAuth2(account.Email, account.AccessToken), cancellation);
                } else { client.AuthenticationMechanisms.Remove("XOAUTH2"); client.Authenticate(account.UserName, account.Password, cancellation); }
            }, 0) { }
    }
}
