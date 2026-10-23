using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Mail;
using System.Text;
using System.Web.Script.Serialization;

namespace TMAppsShared {
    // Shared, credential-free contract for Launcher, Mail, and future social app integration.
    public sealed class SocialAccount {
        public string platform { get; set; }
        public string account { get; set; }
    }
    public sealed class SuiteProfile {
        public int schemaVersion { get; set; }
        public string revision { get; set; }
        public string displayName { get; set; }
        public List<string> emails { get; set; }
        public bool shareWithMail { get; set; }
        public bool? shareWithApps { get; set; }
        public List<SocialAccount> socialAccounts { get; set; }
        public bool shareWithSocialApps { get; set; }
        public SuiteProfile() { schemaVersion=1; displayName=""; emails=new List<string>(); socialAccounts=new List<SocialAccount>(); }
    }
    public static class SuiteProfileStore {
        public static string DefaultPath { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TMApps","profile.json"); } }
        public static SuiteProfile Validate(SuiteProfile value) {
            if(value==null || value.schemaVersion!=1) throw new FormatException("Unsupported profile format.");
            if(value.shareWithApps==null)value.shareWithApps=true;
            if(value.shareWithApps==false){value.shareWithMail=false;value.shareWithSocialApps=false;}
            value.displayName=(value.displayName ?? "").Trim();
            if(value.displayName.Length>100 || value.displayName.Any(Char.IsControl)) throw new FormatException("Enter a name of up to 100 characters on one line.");
            var addresses=value.emails ?? new List<string>();
            if(addresses.Count>20) throw new FormatException("You can save up to 20 email addresses.");
            value.emails=new List<string>();
            foreach(string item in addresses) {
                string email=(item ?? "").Trim(); if(email.Length==0) continue;
                if(email.Length>254 || email.Any(Char.IsControl)) throw new FormatException("Enter a valid email address in each field.");
                MailAddress parsed; try { parsed=new MailAddress(email); } catch { throw new FormatException("Enter a valid email address: "+email); }
                if(!String.Equals(parsed.Address,email,StringComparison.OrdinalIgnoreCase) || !parsed.Host.Contains(".")) throw new FormatException("Enter a valid email address: "+email);
                if(!value.emails.Contains(email,StringComparer.OrdinalIgnoreCase)) value.emails.Add(email);
            }
            var accounts=value.socialAccounts ?? new List<SocialAccount>();
            if(accounts.Count>20) throw new FormatException("You can save up to 20 social accounts.");
            value.socialAccounts=new List<SocialAccount>();
            foreach(var item in accounts) {
                if(item==null) throw new FormatException("Enter a platform and username or profile URL for each social account.");
                string platform=(item.platform ?? "").Trim(), account=(item.account ?? "").Trim();
                if(platform.Length==0 && account.Length==0) continue;
                if(platform.Length==0 || platform.Length>40 || platform.Any(Char.IsControl) || account.Length==0 || account.Length>300 || account.Any(Char.IsControl)) throw new FormatException("Enter a platform (up to 40 characters) and username or profile URL (up to 300 characters) on one line.");
                if(account.Contains("://")) {
                    Uri url; if(!Uri.TryCreate(account,UriKind.Absolute,out url) || url.Scheme!="https" || !String.IsNullOrEmpty(url.UserInfo) || !String.IsNullOrEmpty(url.Query) || !String.IsNullOrEmpty(url.Fragment)) throw new FormatException("Use an HTTPS profile URL without passwords, query parameters, or fragments, or enter just your username.");
                }
                if(!value.socialAccounts.Any(a=>String.Equals(a.platform,platform,StringComparison.OrdinalIgnoreCase) && String.Equals(a.account,account,StringComparison.OrdinalIgnoreCase))) value.socialAccounts.Add(new SocialAccount { platform=platform,account=account });
            }
            if(value.revision!=null && value.revision.Length>80) throw new FormatException("Invalid profile revision.");
            return value;
        }
        public static SuiteProfile Load(string path) {
            if(!File.Exists(path)) return new SuiteProfile();
            if(new FileInfo(path).Length>65536) throw new IOException("Profile file is too large.");
            return Validate(new JavaScriptSerializer().Deserialize<SuiteProfile>(File.ReadAllText(path,Encoding.UTF8)));
        }
        public static SuiteProfile Save(string path,SuiteProfile value) {
            value=Validate(value); value.revision=Guid.NewGuid().ToString("N");
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
            string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
            try {
                File.WriteAllText(temporary,new JavaScriptSerializer().Serialize(value),new UTF8Encoding(false));
                if(File.Exists(path)) File.Replace(temporary,path,null); else File.Move(temporary,path);
            } finally { if(File.Exists(temporary)) File.Delete(temporary); }
            return value;
        }
    }
}
