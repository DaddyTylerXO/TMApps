using System;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;

namespace TMApps.Libraries
{
    public sealed class Store
    {
        public const int MaxBytes = 16 * 1024 * 1024;
        public readonly string DirectoryPath;
        public string FilePath { get { return Path.Combine(DirectoryPath, "workspace.json"); } }
        public bool Recovered { get; private set; }
        public Store(string directory) { DirectoryPath = Path.GetFullPath(directory); }
        public static Workspace Read(string path)
        {
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                if (stream.Length > MaxBytes) throw new SerializationException("Workspace exceeds the 16 MiB limit.");
                var result = (Workspace)new DataContractJsonSerializer(typeof(Workspace)).ReadObject(stream);
                if (result == null) throw new SerializationException("Empty workspace.");
                result.Validate();
                return result;
            }
        }
        public Workspace Load()
        {
            if (!File.Exists(FilePath) && !File.Exists(FilePath + ".bak")) return new Workspace();
            try { return Read(FilePath); }
            catch (Exception e)
            {
                if (!(e is IOException || e is SerializationException || e is System.Xml.XmlException || e is ArgumentException)) throw;
                // Never start empty after corruption. A failed backup read aborts startup.
                Workspace backup = Read(FilePath + ".bak");
                Recovered = true;
                byte[] bytes = Encode(backup);
                AtomicWrite(FilePath, bytes, false);
                return backup;
            }
        }
        public static byte[] Encode(Workspace workspace)
        {
            workspace.Validate();
            using (var buffer = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(Workspace)).WriteObject(buffer, workspace);
                if (buffer.Length > MaxBytes) throw new SerializationException("Workspace exceeds the 16 MiB limit.");
                return buffer.ToArray();
            }
        }
        public static Workspace ReadClone(Workspace workspace)
        {
            using (var buffer = new MemoryStream(Encode(workspace)))
                return (Workspace)new DataContractJsonSerializer(typeof(Workspace)).ReadObject(buffer);
        }
        public void Save(Workspace workspace) { AtomicWrite(FilePath, Encode(workspace), true); }
        public static void Export(string path, Workspace workspace) { AtomicWrite(path, Encode(workspace), false); }
        private static void AtomicWrite(string path, byte[] bytes, bool backup)
        {
            string directory = Path.GetDirectoryName(Path.GetFullPath(path));
            Directory.CreateDirectory(directory);
            string temporary = Path.Combine(directory, ".tmalibraries-" + Guid.NewGuid().ToString("N") + ".tmp");
            try
            {
                using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
                { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                if (File.Exists(path)) File.Replace(temporary, path, backup ? path + ".bak" : null);
                else File.Move(temporary, path);
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
    }
}
