using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace Postbox {
    // Profile loading and WPF workspace construction can occupy the main dispatcher.
    // Keep the splash's window, animations and input on a separate STA dispatcher.
    public sealed class StartupSplashHost {
        private readonly TaskCompletionSource<bool> ready = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource<bool> stopped = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly Action cancelled;
        private volatile Dispatcher displayDispatcher;
        private StartupSplash splash;
        private int closing;
        public Task Ready { get { return ready.Task; } }
        public Task Stopped { get { return stopped.Task; } }
        public StartupSplashHost(Action cancelled) {
            this.cancelled = cancelled;
            var thread = new Thread(Run) { IsBackground = true, Name = "TMA-Mail loading screen" };
            thread.SetApartmentState(ApartmentState.STA); thread.Start();
        }
        private void Run() {
            try {
                displayDispatcher = Dispatcher.CurrentDispatcher;
                splash = new StartupSplash(); AppBrand.Apply(splash);
                splash.ContentRendered += delegate { ready.TrySetResult(true); };
                splash.Closed += delegate {
                    ready.TrySetCanceled();
                    if (Interlocked.CompareExchange(ref closing, 1, 0) == 0 && cancelled != null) cancelled();
                    displayDispatcher.BeginInvokeShutdown(DispatcherPriority.Background);
                };
                if (Volatile.Read(ref closing) != 0) { ready.TrySetCanceled(); return; }
                splash.Show(); Dispatcher.Run();
            } catch (Exception ex) { ready.TrySetException(ex); }
            finally { stopped.TrySetResult(true); }
        }
        public void SetStage(string text) {
            var dispatcher = displayDispatcher; if (dispatcher == null || dispatcher.HasShutdownStarted || Volatile.Read(ref closing) != 0) return;
            dispatcher.BeginInvoke(new Action(delegate { if (splash != null && splash.IsVisible) splash.SetStage(text); }));
        }
        public void Close() {
            Interlocked.Exchange(ref closing, 1);
            var dispatcher = displayDispatcher; if (dispatcher == null || dispatcher.HasShutdownStarted) return;
            dispatcher.BeginInvoke(new Action(delegate { if (splash != null) splash.Close(); }));
        }
    }
}
