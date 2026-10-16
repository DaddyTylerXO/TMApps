using System;
using System.Reflection;
using System.Windows;
using System.Windows.Media.Imaging;

[assembly: AssemblyTitle("TMA-Mail")]
[assembly: AssemblyProduct("TMA-Mail")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]
[assembly: AssemblyVersion("0.10.0.0")]
[assembly: AssemblyFileVersion("0.10.0.0")]
namespace Postbox {
    public static class AppBrand {
        public static void Apply(Window window) {
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("TMA-Mail.ico")) {
                var decoder = new IconBitmapDecoder(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
                window.Icon = decoder.Frames[0];
            }
        }
        public static System.Drawing.Icon TrayIcon() { using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("TMA-Mail.ico")) return new System.Drawing.Icon(stream, 32, 32); }
    }
}
