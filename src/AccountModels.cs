using System;
using System.Collections.Generic;
using System.Net.Mail;

namespace Postbox {
    public sealed class MailAccount {
        public string Id { get; set; }
        public string Email { get; set; }
        public string UserName { get; set; }
        public string Provider { get; set; }
        public string ImapHost { get; set; }
        public int ImapPort { get; set; }
        public string SmtpHost { get; set; }
        public int SmtpPort { get; set; }
        public bool SmtpSsl { get; set; }
        public string Password { get; set; }
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
        public string AuthMethod { get; set; }
        public string AuthCache { get; set; }
        public string RefreshToken { get; set; }
        public string AccessToken { get; set; }
        public DateTime ExpiresUtc { get; set; }
        public List<ServerFolder> Folders { get; set; }
        public void Validate() {
            Email = MailAddressValidation.Validate(Email);
            if (String.IsNullOrWhiteSpace(UserName)) UserName = Email;
            if (String.IsNullOrWhiteSpace(ImapHost) || String.IsNullOrWhiteSpace(SmtpHost) || ImapPort < 1 || ImapPort > 65535 || SmtpPort < 1 || SmtpPort > 65535) throw new ArgumentException("Enter valid IMAP/SMTP hosts and ports.");
            if (Provider != "Microsoft" && AuthMethod != "OAuth" && String.IsNullOrEmpty(Password)) throw new ArgumentException("Enter your provider's app password.");
            if (String.IsNullOrEmpty(Id)) Id = Guid.NewGuid().ToString("N");
        }
    }
    public static class MailAddressValidation {
        public static string Validate(string value) {
            value = (value ?? "").Trim();
            if (value.Length == 0) throw new FormatException("Enter an email address, or choose Explore for now.");
            var parsed = new MailAddress(value);
            if (!String.Equals(parsed.Address, value, StringComparison.OrdinalIgnoreCase) || value.IndexOf('@') < 1) throw new FormatException("Enter an address such as you@example.com.");
            return parsed.Address;
        }
    }
}