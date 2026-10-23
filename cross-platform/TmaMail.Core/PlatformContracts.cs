namespace TmaMail.Core;

// Native adapters must fail explicitly when an OS vault is unavailable. Never create an unencrypted fallback.
public interface IProfileKeyProvider {
    ValueTask<ReadOnlyMemory<byte>> GetKeyAsync(string profileId, CancellationToken cancellation);
}

public interface IDesktopNotifications {
    bool IsSupported { get; }
    Task ShowAsync(string title, string body, CancellationToken cancellation);
}

public interface IExternalBrowser {
    Task OpenHttpsAsync(Uri address, CancellationToken cancellation);
}
