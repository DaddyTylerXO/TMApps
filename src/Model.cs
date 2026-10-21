using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;

namespace TMApps.Libraries
{
    [DataContract]
    public sealed class CheckItem
    {
        [DataMember] public string Text = "";
        [DataMember] public bool Done;
        public override string ToString() { return Text; }
    }

    [DataContract]
    public sealed class LibraryDocument
    {
        [DataMember] public string Id = Guid.NewGuid().ToString("N");
        [DataMember] public string Title = "Untitled";
        [DataMember] public string Kind = "Note";
        [DataMember] public string Body = "";
        [DataMember] public string SideNotes = "";
        [DataMember] public string Folder = "";
        [DataMember] public string Tags = "";
        [DataMember] public bool Favourite;
        [DataMember] public bool ShowProgress = true;
        [DataMember] public DateTime Created = DateTime.UtcNow;
        [DataMember] public DateTime Modified = DateTime.UtcNow;
        [DataMember] public DateTime Opened = DateTime.MinValue;
        [DataMember] public List<CheckItem> Items = new List<CheckItem>();
        public string[] TagList { get { return Tags.Split(',').Select(t => t.Trim()).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(); } }
        public override string ToString() { return Title; }
    }

    [DataContract]
    public sealed class LibrarySettings
    {
        [DataMember] public bool SetupComplete;
        [DataMember] public string Theme = "Light";
        [DataMember] public bool LargeText;
        [DataMember] public bool HighContrast;
        [DataMember] public bool Autosave = true;
        [DataMember] public int AutosaveSeconds = 5;
        [DataMember] public bool SearchKB = true;
    }

    [DataContract]
    public sealed class Workspace
    {
        [DataMember] public int Schema = 1;
        [DataMember] public List<LibraryDocument> Documents = new List<LibraryDocument>();
        [DataMember] public List<string> Folders = new List<string>();
        [DataMember] public LibrarySettings Settings = new LibrarySettings();
        public void Validate()
        {
            if (Schema != 1 || Documents == null || Folders == null || Settings == null) throw new SerializationException("Unsupported or incomplete workspace.");
            if (Documents.Count > 10000 || Folders.Count > 1000 || Folders.Any(f => String.IsNullOrWhiteSpace(f) || f.Length > 120) || Folders.Distinct(StringComparer.OrdinalIgnoreCase).Count() != Folders.Count) throw new SerializationException("Invalid workspace collections.");
            var ids = new HashSet<string>();
            foreach (var d in Documents)
            {
                Guid id;
                if (d == null || !Guid.TryParseExact(d.Id, "N", out id) || !ids.Add(d.Id) || d.Title == null || d.Title.Length > 200 || d.Body == null || d.Body.Length > 2000000 || d.SideNotes == null || d.SideNotes.Length > 200000 || d.Folder == null || (d.Folder != "" && !Folders.Contains(d.Folder)) || d.Tags == null || d.Tags.Length > 1000 || (d.Kind != "Note" && d.Kind != "Checklist") || d.Items == null || d.Items.Count > 10000 || d.Items.Any(i => i == null || i.Text == null || i.Text.Length > 10000)) throw new SerializationException("Invalid document.");
            }
            if (!new[] { "Light", "Grey", "Black" }.Contains(Settings.Theme) || Settings.AutosaveSeconds < 2 || Settings.AutosaveSeconds > 300) throw new SerializationException("Invalid settings.");
        }
    }
}
