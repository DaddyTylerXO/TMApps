using System;
using System.IO;
using System.Linq;
namespace Postbox {
    public static class SoundCatalog {
        public static readonly string[] Cozy = { "Cozy", "Woodland", "Raindrop", "Soft bell", "Warm keys", "Moonlight", "Firefly" };
        public static readonly string[] Choices = Cozy.Concat(new[] { "None", "Custom WAV" }).ToArray();
        public static string PathFor(string name, bool sent) { if (!Cozy.Contains(name)) return null; return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Sounds", (sent ? "send-" : "receive-") + name.ToLowerInvariant().Replace(' ', '-') + ".wav"); }
    }
}
