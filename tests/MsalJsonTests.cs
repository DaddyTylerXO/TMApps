using System;
using System.Linq;
using System.Reflection;
using System.Text;
using Microsoft.Identity.Client;

class MsalJsonTests {
    static int checks;
    static void Check(bool value, string message) { if (!value) throw new Exception(message); checks++; }
    static void Main() {
        var assembly = typeof(PublicClientApplicationBuilder).Assembly;
        var flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        var clientInfo = assembly.GetType("Microsoft.Identity.Client.Internal.ClientInfo", true);
        string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes("{\"uid\":\"synthetic-user\",\"utid\":\"synthetic-tenant\"}")).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        // Exercises MSAL's generated serializer context, not just assembly loading.
        Check(clientInfo.GetMethod("CreateFromJson", flags).Invoke(null, new object[] { encoded }) != null, "MSAL client-info parsing failed with packaged dependencies");
        var helper = assembly.GetType("Microsoft.Identity.Client.Utils.JsonHelper", true);
        var responseType = assembly.GetType("Microsoft.Identity.Client.OAuth2.MsalTokenResponse", true);
        var deserialize = helper.GetMethods(flags).Single(m => m.Name == "DeserializeFromJson" && m.IsGenericMethodDefinition && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType == typeof(string));
        var serialize = helper.GetMethods(flags).Single(m => m.Name == "SerializeToJson" && m.IsGenericMethodDefinition);
        string input = "{\"access_token\":\"synthetic-access\",\"refresh_token\":\"synthetic-refresh\",\"token_type\":\"Bearer\",\"scope\":\"https://outlook.office.com/IMAP.AccessAsUser.All\",\"expires_in\":3600}";
        var response = deserialize.MakeGenericMethod(responseType).Invoke(null, new object[] { input });
        string output = (string)serialize.MakeGenericMethod(responseType).Invoke(null, new[] { response });
        Check(output.Contains("synthetic-access") && output.Contains("synthetic-refresh"), "MSAL token-response JSON roundtrip failed");
        var client = PublicClientApplicationBuilder.Create("19aa9934-ffd9-4eef-b4dd-ba321a131954").WithAuthority("https://login.microsoftonline.com/common").WithRedirectUri("http://localhost").Build();
        string cache = "{\"Account\":{\"synthetic-user.synthetic-tenant-login.microsoftonline.com-synthetic-tenant\":{\"home_account_id\":\"synthetic-user.synthetic-tenant\",\"environment\":\"login.microsoftonline.com\",\"realm\":\"synthetic-tenant\",\"local_account_id\":\"synthetic-user\",\"username\":\"synthetic@example.test\",\"authority_type\":\"MSSTS\"}}}";
        byte[] saved = null;
        client.UserTokenCache.SetBeforeAccess(args => args.TokenCache.DeserializeMsalV3(Encoding.UTF8.GetBytes(cache)));
        client.UserTokenCache.SetAfterAccess(args => saved = args.TokenCache.SerializeMsalV3());
        client.GetAccountsAsync().GetAwaiter().GetResult();
        Check(saved != null && Encoding.UTF8.GetString(saved).Contains("synthetic@example.test"), "MSAL cache deserialization/serialization lost account data");
        var restored = PublicClientApplicationBuilder.Create("19aa9934-ffd9-4eef-b4dd-ba321a131954").Build();
        byte[] roundtrip = null;
        restored.UserTokenCache.SetBeforeAccess(args => args.TokenCache.DeserializeMsalV3(saved));
        restored.UserTokenCache.SetAfterAccess(args => roundtrip = args.TokenCache.SerializeMsalV3());
        restored.GetAccountsAsync().GetAwaiter().GetResult();
        Check(roundtrip != null && Encoding.UTF8.GetString(roundtrip).Contains("synthetic@example.test"), "MSAL cache serialization roundtrip failed");
        Console.WriteLine("Passed " + checks + " MSAL client-info, token-response and cache parsing checks. Synthetic data only; no browser or server contacted.");
    }
}
