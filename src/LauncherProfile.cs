using System;
using System.IO;
using System.Linq;
using System.Windows.Threading;
using TMAppsShared;

namespace Postbox {
    public static class LauncherProfileImport {
        public static bool Apply(Preferences preferences,SuiteProfile profile,bool hasConnectedAccount = false) {
            profile=SuiteProfileStore.Validate(profile);
            if(String.IsNullOrEmpty(profile.revision) || preferences.LauncherProfileRevision==profile.revision) return false;
            var previous=preferences.LauncherEmailSuggestions ?? new System.Collections.Generic.List<string>();
            if(profile.shareWithMail) {
                if(!String.IsNullOrWhiteSpace(profile.displayName)) preferences.DisplayName=profile.displayName;
                // Never replace an independently chosen/connected sending identity.
                if(!hasConnectedAccount && (String.IsNullOrWhiteSpace(preferences.EmailAddress) || String.Equals(preferences.EmailAddress,previous.FirstOrDefault(),StringComparison.OrdinalIgnoreCase))) preferences.EmailAddress=profile.emails.FirstOrDefault() ?? "";
                preferences.LauncherEmailSuggestions=profile.emails.ToList();
            } else preferences.LauncherEmailSuggestions=new System.Collections.Generic.List<string>();
            preferences.LauncherProfileRevision=profile.revision; return true;
        }
    }
    public partial class App {
        private DispatcherTimer launcherProfileTimer;
        private string LauncherProfilePath() {
            var args=Environment.GetCommandLineArgs(); int selected=Array.IndexOf(args,"--launcher-profile");
            if(selected>=0 && selected+1<args.Length) return Path.GetFullPath(args[selected+1]);
            // Isolated/custom Mail profiles must opt in explicitly to the shared profile.
            return args.Contains("--data-dir") ? null : SuiteProfileStore.DefaultPath;
        }
        private bool ReadLauncherProfile() {
            try {
                string path=LauncherProfilePath(); if(path==null) return false;
                var updated=settingsStore.Clone(preferences);
                if(!LauncherProfileImport.Apply(updated,SuiteProfileStore.Load(path),activeAccount!=null)) return false;
                settingsStore.Save(updated); preferences=updated; return true;
            } catch { return false; } // A missing, partially replaced, or invalid profile cannot block mail.
        }
        private void StartLauncherProfileSync() {
            launcherProfileTimer=new DispatcherTimer { Interval=TimeSpan.FromSeconds(4) };
            launcherProfileTimer.Tick+=delegate { if(window.IsEnabled && ReadLauncherProfile()) ApplyPreferences(); };
            launcherProfileTimer.Start(); window.Closed+=delegate { launcherProfileTimer.Stop(); };
        }
    }
}
