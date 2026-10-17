using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Reflection;
using Postbox;
using TMAppsShared;

class LauncherProfileTests {
    static int checks;
    static void Check(bool condition,string message) { if(!condition) throw new Exception(message); checks++; }
    static IEnumerable<T> Descendants<T>(DependencyObject root) where T:DependencyObject {
        foreach(var item in LogicalTreeHelper.GetChildren(root)) {
            var child=item as DependencyObject; if(child==null) continue;
            if(child is T) yield return (T)child;
            foreach(var nested in Descendants<T>(child)) yield return nested;
        }
    }
    [STAThread] static void Main(string[] args) {
        string root=Path.GetFullPath(args[Array.IndexOf(args,"--data-dir")+1]); Directory.CreateDirectory(root);
        var application=new Postbox.App { ShutdownMode=ShutdownMode.OnExplicitShutdown };
        try {
            string path=Path.Combine(root,"suite-profile.json");
            var profile=SuiteProfileStore.Save(path,new SuiteProfile { displayName="Example User",emails=new List<string> { "first@example.com","other@example.org" },shareWithMail=true });
            var preferences=new Preferences();
            Check(LauncherProfileImport.Apply(preferences,SuiteProfileStore.Load(path)),"Launcher profile imports on first use");
            Check(preferences.DisplayName=="Example User" && preferences.EmailAddress=="first@example.com" && preferences.LauncherEmailSuggestions.Count==2,"Name, primary suggestion, and additional email addresses sync");
            Check(!preferences.SetupCompleted,"Sharing a profile cannot bypass welcome/account setup");
            Check(!LauncherProfileImport.Apply(preferences,profile),"Unchanged profile is not repeatedly applied");
            preferences.DisplayName="Local edit";
            Check(!LauncherProfileImport.Apply(preferences,profile) && preferences.DisplayName=="Local edit","Local name edit is retained until the launcher profile changes");
            preferences.EmailAddress="connected@example.net";
            profile=SuiteProfileStore.Save(path,new SuiteProfile { displayName="Updated Name",emails=new List<string> { "updated@example.com" },shareWithMail=true });
            Check(LauncherProfileImport.Apply(preferences,profile) && preferences.DisplayName=="Updated Name","Changed launcher profile updates the Mail display name");
            Check(preferences.EmailAddress=="connected@example.net","An existing connected sending identity is preserved");
            profile.shareWithMail=false; profile=SuiteProfileStore.Save(path,profile);
            Check(LauncherProfileImport.Apply(preferences,profile) && preferences.LauncherEmailSuggestions.Count==0 && preferences.DisplayName=="Updated Name","Disabling sharing removes suggestions and preserves existing Mail profile");
            Check(!Directory.GetFiles(root).Any(f=>f.EndsWith(".protected")),"Profile import never creates account credentials or authenticated connections");
            int connections=0;
            var setup=new AccountSetupWindow(null,new ProviderConfiguration(),(account,token)=>{ connections++; return Task.FromResult(0); },()=>{},"iCloud",new[]{"first@example.com","other@example.org"});
            var email=Descendants<TextBox>(setup).First(box=>System.Windows.Automation.AutomationProperties.GetName(box)=="Email address");
            Check(email.Text=="first@example.com","TMA-Mail account setup prefills the primary launcher email");
            var choices=Descendants<ComboBox>(setup).Single(box=>System.Windows.Automation.AutomationProperties.GetName(box)=="TMApps Launcher email suggestions"); choices.SelectedIndex=1;
            Check(email.Text=="other@example.org","Users can choose any saved launcher email for connection");
            Check(Descendants<PasswordBox>(setup).Single().Password=="" && connections==0 && !setup.Connected,"Saved email does not supply a password or trigger sign-in");
            setup.Close();
            var existing=ProviderChoices.Account("iCloud"); existing.Email="existing@icloud.com"; existing.Password="synthetic-fixture-password";
            var reconnect=new AccountSetupWindow(existing,new ProviderConfiguration(),(account,token)=>Task.FromResult(0),()=>{},"iCloud",new[]{"other@example.org"});
            Check(Descendants<TextBox>(reconnect).First(box=>System.Windows.Automation.AutomationProperties.GetName(box)=="Email address").Text==existing.Email,"Reconnection uses the existing account, not a suggested address"); reconnect.Close();
            var connectedPrefs=new Preferences { EmailAddress="first@example.com",LauncherEmailSuggestions=new List<string> { "first@example.com" } };
            var connectedUpdate=new SuiteProfile { revision="connected-change",shareWithMail=true,displayName="Connected User",emails=new List<string> { "replacement@example.org" } };
            LauncherProfileImport.Apply(connectedPrefs,connectedUpdate,true);
            Check(connectedPrefs.EmailAddress=="first@example.com","Changing a suggestion that matches the connected account cannot change its sending identity");
            var settings=new SettingsStore(Path.Combine(root,"settings.json")); settings.Save(new Preferences { SetupCompleted=true,CloseToTray=false });
            SuiteProfileStore.Save(path,new SuiteProfile { displayName="Initial Suite User",emails=new List<string> { "startup@example.com" },shareWithMail=true });
            typeof(Postbox.App).GetMethod("Initialize",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(application,null);
            var prefsField=typeof(Postbox.App).GetField("preferences",BindingFlags.NonPublic|BindingFlags.Instance);
            Check(((Preferences)prefsField.GetValue(application)).DisplayName=="Initial Suite User","Real Mail initialization imports the optional launcher profile");
            SuiteProfileStore.Save(path,new SuiteProfile { displayName="Live Suite User",emails=new List<string> { "live@example.com" },shareWithMail=true });
            var deadline=DateTime.UtcNow.AddSeconds(8);
            while(((Preferences)prefsField.GetValue(application)).DisplayName!="Live Suite User" && DateTime.UtcNow<deadline) {
                var frame=new System.Windows.Threading.DispatcherFrame();
                application.Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Background,new Action(()=>frame.Continue=false));
                System.Windows.Threading.Dispatcher.PushFrame(frame); Thread.Sleep(25);
            }
            Check(((Preferences)prefsField.GetValue(application)).DisplayName=="Live Suite User","Running Mail syncs a changed launcher profile through its live timer");
            Check(!Directory.GetFiles(root).Any(file=>file.EndsWith(".protected")),"Live sync leaves account credentials absent until explicit account connection");
            ((Window)typeof(Postbox.App).GetField("window",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(application)).Close();
            Console.WriteLine(checks+" launcher profile sync checks passed.");
        } finally { application.Shutdown(); Directory.Delete(root,true); }
    }
}
