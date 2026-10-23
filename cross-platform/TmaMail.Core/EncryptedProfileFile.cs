using System.Security.Cryptography;
using System.Text.Json;
using System.Text;

namespace TmaMail.Core;

/// <summary>Authenticated, atomic storage. Supply an immutable snapshot and a key from a secure OS vault.</summary>
public sealed class EncryptedProfileFile {
    private static readonly byte[] Header = "TMAE1"u8.ToArray();
    private static readonly JsonSerializerOptions Json = new() { IgnoreReadOnlyProperties = true };
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly string path, profileId;
    private readonly IProfileKeyProvider keys;
    private readonly byte[] associatedData;
    public EncryptedProfileFile(string path, string profileId, IProfileKeyProvider keys) {
        this.path = Path.GetFullPath(path); this.profileId = profileId ?? throw new ArgumentNullException(nameof(profileId));
        this.keys = keys ?? throw new ArgumentNullException(nameof(keys));
        associatedData = Encoding.UTF8.GetBytes("TMAE1:" + profileId);
    }
    public async Task SaveAsync<T>(T snapshot, CancellationToken cancellation = default) {
        await gate.WaitAsync(cancellation).ConfigureAwait(false);
        byte[] plaintext = null, key = null; string temporary = null;
        try {
            plaintext = await Task.Run(() => JsonSerializer.SerializeToUtf8Bytes(snapshot, Json), cancellation).ConfigureAwait(false);
            if (plaintext.Length > 268435456) throw new InvalidDataException("Profile exceeds the supported size.");
            key = (await keys.GetKeyAsync(profileId, cancellation).ConfigureAwait(false)).ToArray();
            if (key.Length != 32) throw new CryptographicException("The profile vault must supply a 256-bit key.");
            byte[] nonce = RandomNumberGenerator.GetBytes(12), tag = new byte[16], ciphertext = new byte[plaintext.Length];
            using (var aes = new AesGcm(key, 16)) aes.Encrypt(nonce, plaintext, ciphertext, tag, associatedData);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None, Options = FileOptions.Asynchronous | FileOptions.WriteThrough };
            if (!OperatingSystem.IsWindows()) options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            await using (var output = new FileStream(temporary, options)) {
                await output.WriteAsync(Header, cancellation).ConfigureAwait(false);
                await output.WriteAsync(nonce, cancellation).ConfigureAwait(false);
                await output.WriteAsync(tag, cancellation).ConfigureAwait(false);
                await output.WriteAsync(ciphertext, cancellation).ConfigureAwait(false);
                await output.FlushAsync(cancellation).ConfigureAwait(false); output.Flush(true);
            }
            cancellation.ThrowIfCancellationRequested(); File.Move(temporary, path, true); temporary = null;
        } finally {
            if (plaintext != null) CryptographicOperations.ZeroMemory(plaintext);
            if (key != null) CryptographicOperations.ZeroMemory(key);
            if (temporary != null && File.Exists(temporary)) File.Delete(temporary);
            gate.Release();
        }
    }
    public async Task<T> LoadAsync<T>(CancellationToken cancellation = default) {
        await gate.WaitAsync(cancellation).ConfigureAwait(false);
        byte[] key = null, plaintext = null;
        try {
            var info = new FileInfo(path);
            if (info.Length < 33 || info.Length > 268435489) throw new InvalidDataException("Invalid encrypted profile size.");
            var data = await File.ReadAllBytesAsync(path, cancellation).ConfigureAwait(false);
            if (!data.AsSpan(0, 5).SequenceEqual(Header)) throw new InvalidDataException("Unsupported profile format. Legacy Windows files require explicit migration.");
            key = (await keys.GetKeyAsync(profileId, cancellation).ConfigureAwait(false)).ToArray();
            if (key.Length != 32) throw new CryptographicException("The profile vault must supply a 256-bit key.");
            plaintext = new byte[data.Length - 33];
            using (var aes = new AesGcm(key, 16)) aes.Decrypt(data.AsSpan(5, 12), data.AsSpan(33), data.AsSpan(17, 16), plaintext, associatedData);
            return JsonSerializer.Deserialize<T>(plaintext, Json) ?? throw new InvalidDataException("The profile contained no data.");
        } finally {
            if (plaintext != null) CryptographicOperations.ZeroMemory(plaintext);
            if (key != null) CryptographicOperations.ZeroMemory(key);
            gate.Release();
        }
    }
}
