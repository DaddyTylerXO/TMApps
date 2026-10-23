using Avalonia;

namespace TmaMail.Desktop;
internal static class Program {
    internal static readonly System.Diagnostics.Stopwatch Startup = System.Diagnostics.Stopwatch.StartNew();
    internal static bool SmokeTest;
    [STAThread] public static void Main(string[] args) { SmokeTest = args.Contains("--smoke-test", StringComparer.Ordinal); BuildAvaloniaApp().StartWithClassicDesktopLifetime(args); }
    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<App>().UsePlatformDetect().WithInterFont().LogToTrace();
}
