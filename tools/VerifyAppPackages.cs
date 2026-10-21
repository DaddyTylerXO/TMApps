using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using TMApps;

// Test the real launcher install engine against actual packaged app bytes.
// No desktop/startup integration or personal profile deletion is permitted.
class VerifyAppPackages {
    sealed class Integration : IAppIntegration {
        public void Apply(AppInfo a,Installed p,Installed c,string oldPath,string newPath) {}
        public void Remove(AppInfo a,Installed i,string path) {}
    }
    sealed class Data : IAppDataStore {
        public string[] Locations(AppInfo a) {return new string[0];}
        public void Delete(AppInfo a) {throw new Exception("Test must never delete personal data.");}
    }
    sealed class Packages : HttpMessageHandler {
        readonly string directory;
        public Packages(string root) {directory=Path.GetFullPath(root);}
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token) {
            string filename=Path.GetFileName(request.RequestUri.AbsolutePath);
            if(!filename.StartsWith("TMA-Libraries-") && !filename.StartsWith("TMA-Finance-")) throw new Exception("Unexpected verification download.");
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=new StreamContent(File.OpenRead(Path.Combine(directory,filename)))});
        }
    }
    sealed class Progress : IProgress<string> {public void Report(string value) {}}
    static int Main(string[] args) {
        try {
            var catalog=LauncherService.ParseCatalog(File.ReadAllText(args[0]));
            string output=Path.GetFullPath(args[2]);Directory.CreateDirectory(output);
            using(var service=new LauncherService(Path.Combine(output,"state"),new Packages(args[1]),new Integration(),null,new Data())) {
                foreach(var app in catalog.apps.Where(a=>a.id=="tma-libraries" || a.id=="tma-finance")) {
                    if(args[3]=="install") {
                        string location=Path.Combine(output,app.id);
                        service.Install(app,new Progress(),CancellationToken.None,location,new AppInstallOptions{directory=location,desktopShortcut=false,runAtStartup=false}).GetAwaiter().GetResult();
                        var installed=service.GetInstalled(app);
                        if(installed==null)throw new Exception("Application activation failed.");
                        string executable=Path.Combine(installed.installRoot,installed.folder,installed.executable);
                        if(!File.Exists(executable))throw new Exception("Missing app executable.");
                        if(app.id=="tma-libraries" && !File.Exists(executable+".config"))throw new Exception("Missing Libraries configuration.");
                        if(app.id=="tma-finance" && !File.Exists(Path.Combine(Path.GetDirectoryName(executable),"resources","app.asar")))throw new Exception("Missing Finance application resources.");
                        File.WriteAllText(Path.Combine(output,app.id+"-executable.txt"),executable);
                    } else {
                        service.Uninstall(app);
                        if(service.GetInstalled(app)!=null)throw new Exception("Application uninstall failed.");
                    }
                    Console.WriteLine("Verified real package "+args[3]+": "+app.name);
                }
            }
            return 0;
        } catch(Exception error) {Console.Error.WriteLine(error.Message);return 1;}
    }
}
