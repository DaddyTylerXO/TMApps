using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace TMApps {
    public class KnowledgeArticle { public string id {get;set;} public string title {get;set;} public string keywords {get;set;} public string body {get;set;} }
    public class AppScreenshot { public string url {get;set;} public string caption {get;set;} }
    public class AppPresentation { public string video {get;set;} public List<AppScreenshot> screenshots {get;set;} public string releaseNotes {get;set;} }
    public class ExperienceContent {
        public List<KnowledgeArticle> articles {get;set;} public Dictionary<string,AppPresentation> apps {get;set;}
        public static readonly ExperienceContent Current=LauncherService.Json.Deserialize<ExperienceContent>(Bundled.Read("experience.json"));
        public static bool Match(string text,string query) { return query.Split(new[]{' '},StringSplitOptions.RemoveEmptyEntries).All(q=>text.IndexOf(q,StringComparison.OrdinalIgnoreCase)>=0); }
        public static bool Media(string value) { Uri u; return Uri.TryCreate(value,UriKind.Absolute,out u) && u.Scheme=="https" && u.Host=="raw.githubusercontent.com" && u.AbsolutePath.StartsWith("/DaddyTylerXO/TMApps/",StringComparison.Ordinal) && String.IsNullOrEmpty(u.UserInfo); }
    }
    public static class LauncherDiagnostics {
        public static string Redact(string value) {
            string text=value ?? "";
            text=Regex.Replace(text,@"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+","[redacted session]");
            text=Regex.Replace(text,@"(?i)(bearer\s+)[^\s]+","$1[redacted]");
            text=Regex.Replace(text,@"(?i)(password|token|secret|api[_-]?key|authorization)(\s*[=:]\s*)[^\s,;]+","$1$2[redacted]");
            text=Regex.Replace(text,@"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}","[email]");
            text=Regex.Replace(text,@"(?i)[A-Z]:[\\/][^\r\n]+|/(Users|home)/[^\s]+","[local path]");
            return text.Length>6000 ? text.Substring(0,6000) : text;
        }
        public static string Report(Exception error) { return "TMApps Launcher "+LauncherUpdates.CurrentVersion+"\nOS: "+Environment.OSVersion+"\nArchitecture: "+(Environment.Is64BitProcess?"x64":"x86")+"\nMemory MB: "+(Process.GetCurrentProcess().WorkingSet64/1048576)+"\nUTC: "+DateTime.UtcNow.ToString("o")+"\n\n"+Redact(error==null ? "No captured crash. Describe the issue and steps to reproduce." : error.ToString()); }
        public static void Save(string root,Exception error) { try {Directory.CreateDirectory(root);File.WriteAllText(Path.Combine(root,"last-crash.txt"),Report(error));} catch {} }
        public static string Issue(string kind,string report) {
            if(!new[]{"feature","bug","issue","crash"}.Contains(kind)) throw new ArgumentException("Invalid issue kind.");
            string body=kind=="feature"?"App: TMApps Launcher\nProblem to solve:\nRequested feature:\nExpected benefit:\n":kind=="bug"?"App: TMApps Launcher\nVersion:\nSteps to reproduce:\nExpected behaviour:\nActual behaviour:\n":kind=="issue"?"App: TMApps Launcher\nIssue category:\nDetails:\n":"Review this public crash report before submitting.\n\n";
            string detail=Redact(report);body+=detail.Substring(0,Math.Min(1800,detail.Length));
            return "https://github.com/DaddyTylerXO/TMApps/issues/new?title="+Uri.EscapeDataString("[Launcher] "+kind+" report")+"&body="+Uri.EscapeDataString(body);

        }
    }
    public static class LauncherThemes {
        static readonly ConditionalWeakTable<DependencyObject,Dictionary<DependencyProperty,Brush>> Originals=new ConditionalWeakTable<DependencyObject,Dictionary<DependencyProperty,Brush>>();
        static readonly string[] From={"#17191F","#22252C","#2D313B","#393F4B","#412313","#5B321E","#CC5500","#F68B40","#F4BE93","#714022"};
        static readonly string[] Grey={"#25272B","#303238","#3C3F46","#585D66","#202226","#454A53","#626C7B","#A0AABA","#D0D4DB","#626975"};
        static readonly string[] Black={"#08090B","#14161A","#22252B","#41454D","#08090B","#282C33","#687383","#A0AABA","#D0D4DB","#535B66"};
        static string[] Palette(string theme) {return theme=="Grey"?Grey:theme=="Black"?Black:From;}
        public static string Markup(string xaml,string theme) {var colors=Palette(theme); for(int i=0;i<From.Length;i++) xaml=Regex.Replace(xaml,From[i],colors[i],RegexOptions.IgnoreCase); return xaml;}
        public static void Apply(DependencyObject root,string theme) {ApplyTree(root,theme,new HashSet<DependencyObject>());}
        static void ApplyTree(DependencyObject root,string theme,HashSet<DependencyObject> visited) {
            if(root==null || !visited.Add(root))return; var colors=Palette(theme);
            foreach(var property in new[]{Control.BackgroundProperty,Control.BorderBrushProperty,Control.ForegroundProperty,Border.BackgroundProperty,Border.BorderBrushProperty,TextBlock.ForegroundProperty}) {
                try {var originals=Originals.GetOrCreateValue(root);if(!originals.ContainsKey(property))originals[property]=root.GetValue(property) as Brush;var brush=originals[property] as SolidColorBrush;if(brush==null)continue;string hex=brush.Color.ToString().Substring(3);int index=Array.FindIndex(From,c=>c.Substring(1).Equals(hex,StringComparison.OrdinalIgnoreCase)); if(index<0)index=Array.FindIndex(Grey,c=>c.Substring(1).Equals(hex,StringComparison.OrdinalIgnoreCase));if(index<0)index=Array.FindIndex(Black,c=>c.Substring(1).Equals(hex,StringComparison.OrdinalIgnoreCase));if(index>=0)root.SetCurrentValue(property,(Brush)new BrushConverter().ConvertFromString(colors[index]));} catch {}
            }
            foreach(var child in LogicalTreeHelper.GetChildren(root).OfType<DependencyObject>().ToList()) ApplyTree(child,theme,visited);
            if(root is Visual || root is System.Windows.Media.Media3D.Visual3D) for(int i=0;i<VisualTreeHelper.GetChildrenCount(root);i++) ApplyTree(VisualTreeHelper.GetChild(root,i),theme,visited);
        }
    }
    public partial class LauncherApplication {
        internal static void VerifyPerformance(string report) {
            var watch=Stopwatch.StartNew();var application=new LauncherApplication();var target=application.Initialize(Path.Combine(Path.GetDirectoryName(Path.GetFullPath(report)),"performance-profile-"+Guid.NewGuid().ToString("N")),null,false);
            target.ShowInTaskbar=false;target.ShowActivated=false;target.WindowStartupLocation=WindowStartupLocation.Manual;target.Left=-10000;target.Top=-10000;
            var timer=new System.Windows.Threading.DispatcherTimer {Interval=TimeSpan.FromSeconds(2)};long startup=0;TimeSpan cpu=TimeSpan.Zero;var idle=new Stopwatch();
            target.ContentRendered+=(s,e)=>{if(timer.IsEnabled)return;startup=watch.ElapsedMilliseconds;cpu=Process.GetCurrentProcess().TotalProcessorTime;idle.Start();timer.Start();};
            timer.Tick+=(s,e)=>{timer.Stop();var process=Process.GetCurrentProcess();double memory=process.WorkingSet64/1048576.0,percent=(process.TotalProcessorTime-cpu).TotalSeconds/idle.Elapsed.TotalSeconds/Environment.ProcessorCount*100;bool passed=startup<15000 && memory<350 && percent<15;File.WriteAllText(report,LauncherService.Json.Serialize(new {passed=passed,startupMs=startup,workingSetMb=memory,idleCpuPercent=percent}));Environment.ExitCode=passed?0:1;target.Close();application.Shutdown();};
            target.Show();application.Run();
        }
        static TextBlock Paragraph(string text) {return new TextBlock {Text=text,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,7,0,10),Foreground=Brushes.LightGray};}
        static Button ActionButton(string text,Action run) {var b=new Button {Content=text,Margin=new Thickness(0,6,0,6),HorizontalAlignment=HorizontalAlignment.Left};b.Click+=(s,e)=>run();return b;}
        void ShowHelp(string query) {
            var d=new ThemedDialog(window,"Help and KB Library","Search user guides, setup information, and troubleshooting by keyword or KB number.");
            var search=new TextBox {Text=query,Name="KnowledgeSearch"};d.Body.Children.Add(search);var results=new StackPanel();d.Body.Children.Add(results);
            Action render=()=>{results.Children.Clear();foreach(var article in ExperienceContent.Current.articles.Where(a=>ExperienceContent.Match(a.id+" "+a.title+" "+a.keywords+" "+a.body,search.Text))) {var a=article;results.Children.Add(ActionButton(a.id+" · "+a.title,()=>ThemedDialogs.Info(d,a.id+" · "+a.title,a.body)));}};search.TextChanged+=(s,e)=>render();render();
            foreach(string kind in new[]{"feature","bug","issue"}) {string selected=kind;d.Body.Children.Add(ActionButton(kind=="feature"?"Feature request":kind=="bug"?"Bug report":"Issue report",()=>Browse(LauncherDiagnostics.Issue(selected,null))));}
            d.Body.Children.Add(ActionButton("Review crash report",ShowCrashReport));d.Body.Children.Add(ActionButton("Download KB Library Word document",()=>Browse("https://github.com/DaddyTylerXO/TMApps/blob/TMApps-Launcher/docs/KB%20Library.docx")));
            d.AddAction("Close",true,()=>d.Close(),"ConfirmAction");d.Loaded+=(s,e)=>LauncherThemes.Apply(d,preferences.theme);d.ShowDialog();
        }
        void ShowCrashReport() {
            string file=Path.Combine(service.Root,"last-crash.txt");string report=File.Exists(file)?LauncherDiagnostics.Redact(File.ReadAllText(file)):LauncherDiagnostics.Report(null);
            var d=new ThemedDialog(window,"Review crash report","Review and edit this draft. Upload opens a GitHub issue form; you must sign in and submit it there. No report is sent automatically.");var edit=new TextBox {Text=report,AcceptsReturn=true,Height=280,VerticalScrollBarVisibility=ScrollBarVisibility.Auto};d.Body.Children.Add(edit);
            d.AddAction("Cancel",false,()=>d.Close(),"CancelAction");d.AddAction("Upload to GitHub Issues…",true,()=>Browse(LauncherDiagnostics.Issue("crash",edit.Text)),"ConfirmAction");d.ShowDialog();
        }
        void ShowDetails(AppView app) {
            var d=new ThemedDialog(window,app.Name,"Version "+app.Info.version+" · Updated "+app.UpdatedLabel);d.Width=800;
            d.Body.Children.Add(Paragraph(app.Description));AppPresentation presentation;ExperienceContent.Current.apps.TryGetValue(app.Id,out presentation);if(presentation==null)presentation=new AppPresentation {screenshots=new List<AppScreenshot>()};
            d.Body.Children.Add(new Expander { Header="New features and release notes from the app branch",Foreground=Brushes.LightGray,Content=Paragraph(presentation.releaseNotes ?? "Release notes not published yet."),Margin=new Thickness(0,10,0,10) });
            MediaElement video=null;
            d.Body.Children.Add(Paragraph("Showcase video · 1 slot"));
            if(ExperienceContent.Media(presentation.video)) {video=new MediaElement {Source=new Uri(presentation.video),LoadedBehavior=MediaState.Manual,UnloadedBehavior=MediaState.Close,Height=280};d.Body.Children.Add(video);d.Body.Children.Add(ActionButton("Play showcase",()=>video.Play()));d.Body.Children.Add(ActionButton("Pause video",()=>video.Pause()));} else d.Body.Children.Add(Paragraph("Showcase video not published."));
            d.Body.Children.Add(Paragraph("Screenshots · 10 slots"));var media=presentation.screenshots ?? new List<AppScreenshot>();
            for(int i=0;i<10;i++) {if(i>=media.Count || !ExperienceContent.Media(media[i].url)) {d.Body.Children.Add(Paragraph("Screenshot "+(i+1)+" · Not published"));continue;}var shot=media[i];var image=new Image {Height=210,Stretch=Stretch.Uniform,Margin=new Thickness(0,8,0,0)};var bitmap=new BitmapImage();bitmap.BeginInit();bitmap.DecodePixelWidth=640;bitmap.UriSource=new Uri(shot.url);bitmap.EndInit();image.Source=bitmap;d.Body.Children.Add(image);d.Body.Children.Add(Paragraph((i+1)+" · "+shot.caption));}
            d.Body.Children.Add(ActionButton("View app source",()=>Browse("https://github.com/DaddyTylerXO/TMApps/tree/"+app.Info.branch)));d.AddAction("Close",true,()=>d.Close(),"ConfirmAction");d.Closed+=(s,e)=>{if(video!=null){video.Stop();video.Close();}d.Body.Children.Clear();};d.ShowDialog();
        }
        void Settings() {
            var original=LauncherService.Json.Deserialize<Preferences>(LauncherService.Json.Serialize(preferences));bool saved=false;
            var d=new ThemedDialog(window,"Settings","Search settings and, optionally, the KB Library. Changes preview immediately; Save keeps them.");
            d.Resources[typeof(ComboBox)]=window.Resources[typeof(ComboBox)];d.Resources[typeof(ComboBoxItem)]=window.Resources[typeof(ComboBoxItem)];
            var search=new TextBox {Name="SettingsSearch",ToolTip="Search settings or KB numbers"};d.Body.Children.Add(search);var body=new StackPanel();d.Body.Children.Add(body);
            Action render=null; Action preview=()=>{ApplyNavigation(window,preferences);ApplyView(window,preferences.libraryView);window.UpdateLayout();d.UpdateLayout();LauncherThemes.Apply(window,preferences.theme);LauncherThemes.Apply(d,preferences.theme);};
            render=()=>{body.Children.Clear();
                Action<string,string,Action> section=(title,keys,build)=>{if(ExperienceContent.Match(title+" "+keys,search.Text)){body.Children.Add(new TextBlock {Text=title,FontSize=16,Margin=new Thickness(0,14,0,5)});build();}};
                Action<string,bool,Action<bool>> toggle=(label,value,change)=>{var c=new CheckBox {Content=new TextBlock {Text=label,TextWrapping=TextWrapping.Wrap,MaxWidth=470},IsChecked=value,Margin=new Thickness(0,10,0,6)};c.Click+=(s,e)=>change(c.IsChecked==true);body.Children.Add(c);};
                Action<string,string[],string,Action<string>> select=(label,choices,value,change)=>{body.Children.Add(Paragraph(label));var c=new ComboBox {ItemsSource=choices,SelectedItem=value,MinHeight=34};c.SelectionChanged+=(s,e)=>change(Convert.ToString(c.SelectedItem));body.Children.Add(c);};
                section("Appearance","theme dark grey gray black orange colour color navigation view grid list",()=>{select("Dark palette",new[]{"Orange","Grey","Black"},preferences.theme,v=>{preferences.theme=v;preview();});select("Navigation position",new[]{"Left","Top","Right","Bottom"},preferences.navigationEdge,v=>{preferences.navigationEdge=v;preview();});select("Library view",new[]{"List","Grid"},preferences.libraryView,v=>{preferences.libraryView=v;preview();});toggle("Compact navigation",preferences.compactNavigation,v=>{preferences.compactNavigation=v;preview();});});
                section("Startup and performance","cpu gpu ram memory network tray boot startup update background",()=>{toggle("Open launcher on Windows sign-in",preferences.runAtStartup,v=>preferences.runAtStartup=v);toggle("Create desktop shortcut",preferences.desktopShortcut,v=>preferences.desktopShortcut=v);toggle("Stay in tray when closed",preferences.closeToTray,v=>preferences.closeToTray=v);toggle("Check for updates at startup",preferences.checkOnStartup,v=>preferences.checkOnStartup=v);body.Children.Add(Paragraph("Startup affects boot time. Tray mode keeps RAM in use; Quit releases it. Update checks briefly use CPU and network. Screenshots load only in Details; videos use RAM, CPU/GPU decoding and network only when played. Close Details to stop playback. See Launcher-KB6."));});
                section("Help and settings search","kb knowledge guides help search reports crash bugs feature issue",()=>{toggle("Include KB articles in settings search",preferences.includeKbSearch,v=>{preferences.includeKbSearch=v;render();});body.Children.Add(ActionButton("Open KB Library and support",()=>ShowHelp(search.Text)));body.Children.Add(ActionButton("Review crash report",ShowCrashReport));});
                section("Downloads and storage","github token storage download folder",()=>{body.Children.Add(ActionButton("Open launcher storage",()=>Process.Start("explorer.exe",service.Root)));body.Children.Add(Paragraph("Public app downloads do not need a GitHub token."));var token=new PasswordBox {Padding=new Thickness(10)};body.Children.Add(token);body.Children.Add(ActionButton("Save optional GitHub token",()=>service.SaveToken(token.Password)));body.Children.Add(ActionButton("Disconnect GitHub",()=>service.SaveToken("")));});
                if(preferences.includeKbSearch && !String.IsNullOrWhiteSpace(search.Text))foreach(var article in ExperienceContent.Current.articles.Where(a=>ExperienceContent.Match(a.id+" "+a.title+" "+a.keywords+" "+a.body,search.Text))){var a=article;body.Children.Add(ActionButton(a.id+" · "+a.title,()=>ThemedDialogs.Info(d,a.id+" · "+a.title,a.body)));}
            };
            search.TextChanged+=(s,e)=>render();render();d.AddAction("Cancel",false,()=>d.Close(),"CancelAction");d.AddAction("Save changes",true,()=>{try {var exe=System.Reflection.Assembly.GetExecutingAssembly().Location;DesktopIntegration.SetStartup(exe,preferences.runAtStartup);DesktopIntegration.SetDesktopShortcut(exe,preferences.desktopShortcut);DesktopIntegration.SavePreferences(service.Root,preferences);saved=true;d.Close();}catch(Exception ex){ThemedDialogs.Info(d,"Could not save settings",ex.Message);}},"ConfirmAction");d.Loaded+=(s,e)=>preview();d.ShowDialog();if(!saved){preferences=original;preview();}
        }
    }
}
