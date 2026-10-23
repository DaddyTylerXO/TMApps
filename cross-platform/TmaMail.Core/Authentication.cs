using MailKit;
using MailKit.Security;
using Postbox;
using MailTransport = Postbox.MailTransport;

namespace TmaMail.Core;

public interface IAccountTokenStore {
    void SaveTokens(MailAccount account);
}

public static class MailAuthentication {
    // The caller supplies secure persistence; tokens are never written to a default/plaintext file.
    public static MailTransport Create(MailAccount account, IAccountTokenStore tokenStore) {
        return MailTransport.Create(account, (client, identity, cancellation) => {
            if (ProviderLogin.UsesOAuth(identity)) {
                ProviderLogin.Refresh(identity, false, cancellation);
                cancellation.ThrowIfCancellationRequested();
                tokenStore?.SaveTokens(identity);
                client.Authenticate(new SaslMechanismOAuth2(identity.Email, identity.AccessToken), cancellation);
            } else {
                client.AuthenticationMechanisms.Remove("XOAUTH2");
                client.Authenticate(identity.UserName, identity.Password, cancellation);
            }
        });
    }
}
