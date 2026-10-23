using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
class VerifySpotifyForms {
    [STAThread]static int Main(string[] args) {
        Application.EnableVisualStyles();string output=args[1];Directory.CreateDirectory(output);string profile=Path.Combine(output,"isolated-profile-"+Guid.NewGuid().ToString("N"));
        var process=Process.GetCurrentProcess();var watch=Stopwatch.StartNew();int stage=0;long startup=0;TimeSpan cpu=TimeSpan.Zero;bool passed=false;
        using(var timer=new Timer {Interval=300}) {
            timer.Tick+=(s,e)=>{var form=Application.OpenForms.Cast<Form>().FirstOrDefault();if(form==null)return;
                if(stage==0){startup=watch.ElapsedMilliseconds;var panel=form.Controls.OfType<FlowLayoutPanel>().Single();var modes=panel.Controls.OfType<FlowLayoutPanel>().Single(c=>c.AccessibleName=="Playback mode");modes.Controls.OfType<Button>().Single(b=>b.Name=="BrowserMode").PerformClick();using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,form.ClientRectangle);bitmap.Save(Path.Combine(output,"spotify-preview.png"));}cpu=process.TotalProcessorTime;stage=1;timer.Interval=2200;}
                else {process.Refresh();double idle=(process.TotalProcessorTime-cpu).TotalMilliseconds/2200/Environment.ProcessorCount*100;double memory=process.WorkingSet64/1048576.0;passed=startup<30000&&memory<800&&idle<30&&File.ReadAllText(Path.Combine(profile,"spotify-mode.txt"))=="Browser";File.WriteAllText(Path.Combine(output,"spotify-performance.json"),new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(new {passed=passed,startupMs=startup,workingSetMb=memory,idleCpuPercent=idle,liveAccountTested=false}));timer.Stop();form.Close();}
            };
            timer.Start();TMAppsShared.SpotifyWindow.Show(args[0],profile,args[2]);
        }
        return passed?0:1;
    }
}
