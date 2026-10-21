using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using TMApps.Libraries;

class StorageChecks
{
    static int checks;
    static void Check(bool result, string name) { if (!result) throw new Exception(name); checks++; Console.WriteLine("PASS " + name); }
    static void Fails(Action action, string name) { bool failed = false; try { action(); } catch { failed = true; } Check(failed, name); }
    static int Main()
    {
        string temp = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "TMA-Libraries-check-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        try
        {
            var store = new Store(temp); var w = store.Load();
            Check(w.Documents.Count == 0 && !w.Settings.LargeText && !w.Settings.HighContrast && !w.Settings.SetupComplete, "clean start and optional accessibility defaults");
            var note = new LibraryDocument { Title = "Unicode café 世界", Body = "First line\r\nSecond line 🗂", Folder = "Research", Tags = "Work,Ideas", Favourite = true, SideNotes = "Review" };
            w.Folders.Add("Research"); w.Documents.Add(note); w.Documents.Add(new LibraryDocument { Kind = "Checklist", Items = { new CheckItem { Text = "Done", Done = true }, new CheckItem { Text = "Next" } } });
            store.Save(w); var reread = new Store(temp).Load();
            Check(reread.Documents[0].Body == note.Body && reread.Documents[0].Favourite && reread.Documents[0].Folder == "Research" && reread.Documents[0].SideNotes == "Review" && reread.Documents[1].Items[0].Done, "durable restart preserves text, metadata and checklist");
            note.Body = "Second revision"; store.Save(w); Check(Store.Read(store.FilePath + ".bak").Documents[0].Body != note.Body, "backup retains previous revision");
            string copy = Path.Combine(temp, "copy.tmalibrary"); Store.Export(copy, w); var imported = Store.Read(copy);
            Check(Store.Encode(w).SequenceEqual(Store.Encode(imported)), "native export/import exact round trip");
            File.WriteAllText(Path.Combine(temp, ".interrupted.tmp"), "partial"); Check(new Store(temp).Load().Documents[0].Body == "Second revision", "interrupted temporary write cannot replace committed save");
            File.WriteAllText(store.FilePath, "corrupted"); var recovered = new Store(temp); var fallback = recovered.Load();
            Check(recovered.Recovered && fallback.Documents[0].Body != "Second revision", "corrupt primary recovers previous save");
            fallback.Documents[0].Body = "After recovery"; recovered.Save(fallback);
            Check(Store.Read(store.FilePath + ".bak").Documents[0].Body != "After recovery", "post-recovery save retains valid backup");
            File.WriteAllText(store.FilePath, "corrupted"); File.WriteAllText(store.FilePath + ".bak", "corrupted");
            Fails(delegate { new Store(temp).Load(); }, "both copies corrupt aborts instead of starting blank");
            Check(File.ReadAllText(store.FilePath) == "corrupted", "failed recovery leaves source untouched");
            File.Delete(store.FilePath); File.Delete(store.FilePath + ".bak"); store.Save(w); store.Save(w); File.Delete(store.FilePath);
            Check(new Store(temp).Load().Documents.Count == 2, "missing primary recovers backup");
            var bad = Store.ReadClone(w); bad.Schema = 99; Fails(delegate { Store.Encode(bad); }, "unsupported schema rejected");
            bad = Store.ReadClone(w); bad.Documents[0].Id = "../outside"; Fails(delegate { Store.Encode(bad); }, "invalid document identifiers rejected");
            bad = Store.ReadClone(w); bad.Documents.Add(bad.Documents[0]); Fails(delegate { Store.Encode(bad); }, "duplicate identifiers rejected");
            bad = Store.ReadClone(w); bad.Documents[0].Kind = "Macro"; Fails(delegate { Store.Encode(bad); }, "unsupported document kind rejected");
            bad = Store.ReadClone(w); bad.Documents[0].Folder = "Missing"; Fails(delegate { Store.Encode(bad); }, "dangling folder rejected");
            bad = Store.ReadClone(w); bad.Folders.Add("research"); Fails(delegate { Store.Encode(bad); }, "ambiguous folder names rejected");
            using (var oversized = new FileStream(copy, FileMode.Create)) oversized.SetLength(Store.MaxBytes + 1L);
            Fails(delegate { Store.Read(copy); }, "oversized import rejected before parsing");
            using (var locked = new FileStream(store.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read)) Fails(delegate { store.Save(w); }, "locked destination fails safely");
            Check(Store.Read(store.FilePath).Documents.Count == 2 && Directory.GetFiles(temp, ".tmalibraries-*.tmp").Length == 0, "failed replacement retains data and cleans temporary file");
            var large = new Workspace(); for (int i = 0; i < 1000; i++) large.Documents.Add(new LibraryDocument { Title = "Synthetic document " + i, Body = new string('x', 4096), Tags = "Performance" });
            var watch = Stopwatch.StartNew(); store.Save(large); watch.Stop(); long save = watch.ElapsedMilliseconds; watch.Restart(); var loaded = store.Load(); watch.Stop();
            Check(loaded.Documents.Count == 1000, "1000-document synthetic performance workload persists");
            Console.WriteLine("PERFORMANCE 1000 notes x 4096 chars: save=" + save + "ms load=" + watch.ElapsedMilliseconds + "ms bytes=" + new FileInfo(store.FilePath).Length + " workingSetMiB=" + (Process.GetCurrentProcess().WorkingSet64 / 1048576));
            Console.WriteLine(checks + " storage checks passed."); return 0;
        }
        catch (Exception e) { Console.Error.WriteLine(e); return 1; }
        finally { Directory.Delete(temp, true); }
    }
}
