using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Mail;
using System.Text;
using System.Web.Script.Serialization;

namespace TMAppsShared {
    // Shared, credential-free contract consumed by TMApps Launcher and TMA-Mail.
    public sealed class SuiteProfile {
        public int schemaVersion { get; set; }
        public string revision { get; set; }
        public string displayName { get; set; }
        public List<string> emails { get; set; }
        public bool shareWithMail { get; set; }
        public SuiteProfile() { schemaVersion=1; displayName=""; emails=new List<string>(); }
    }
    public static class SuiteProfileStore {
        public static string DefaultPath { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TMApps","profile.json"); } }
        public static SuiteProfile Validate(SuiteProfile value) {
            if(value==null || value.schemaVersion!=1) throw new FormatException("Unsupported profile format.");
            value.displayName=(value.displayName ?? "").Trim();
            if(value.displayName.Length>100 || value.displayName.Any(Char.IsControl)) throw new FormatException("Enter a name of up to 100 characters on one line.");
            var addresses=value.emails ?? new List<string>();
            if(addresses.Count>20) throw new FormatException("You can save up to 20 email addresses.");
            value.emails=new List<string>();
            foreach(string item in addresses) {
                string email=(item ?? "").Trim(); if(email.Length==0) continue;
                if(email.Length>254 || email.Any(Char.IsControl)) throw new FormatException("Enter a valid email address on each line.");
                MailAddress parsed; try { parsed=new MailAddress(email); } catch { throw new FormatException("Enter a valid email address: "+email); }
                if(!String.Equals(parsed.Address,email,StringComparison.OrdinalIgnoreCase) || !parsed.Host.Contains(".")) throw new FormatException("Enter a valid email address: "+email);
                if(!value.emails.Contains(email,StringComparer.OrdinalIgnoreCase)) value.emails.Add(email);
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
