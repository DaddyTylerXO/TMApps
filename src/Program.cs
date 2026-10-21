using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace TMApps.Libraries
{
    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
            bool smoke = args.Length == 1 && args[0] == "--smoke";
            string data = smoke ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "TMA-Libraries-smoke-" + Guid.NewGuid().ToString("N")) : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TMApps", "TMA-Libraries");
            using (var mutex = new Mutex(false, "Local\\TMApps.TMA-Libraries.Desktop"))
            {
                bool held = false;
                try
                {
                    try { held = mutex.WaitOne(0); } catch (AbandonedMutexException) { held = true; }
                    if (!held) { MessageBox.Show("TMA-Libraries is already open. Switch to its window to continue.", "TMA-Libraries"); return 1; }
                    var store = new Store(data);
                    var workspace = store.Load();
                    using (var window = new MainWindow(store, workspace, smoke))
                    {
                        if (smoke)
                        {
                            window.Show();
                            Application.DoEvents();
                            window.RunSmoke();
                            using (var bitmap = new Bitmap(window.Width, window.Height))
                            {
                                window.DrawToBitmap(bitmap, new Rectangle(Point.Empty, window.Size));
                                bitmap.Save(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "desktop-smoke.png"));
                            }
                            window.Close();
                        }
                        else Application.Run(window);
                    }
                    return 0;
                }
                catch (Exception)
                {
                    // No document contents, paths, exception messages or credentials in diagnostics.
                    if (!smoke) MessageBox.Show("Libraries could not open or save its workspace. Your existing files have been retained. Check disk space and your access to the local workspace folder. See Libraries-KB3. No report has been sent.", "Libraries E001", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 1;
                }
                finally
                {
                    if (held) mutex.ReleaseMutex();
                    if (smoke && Directory.Exists(data)) Directory.Delete(data, true);
                }
            }
        }
    }
}
