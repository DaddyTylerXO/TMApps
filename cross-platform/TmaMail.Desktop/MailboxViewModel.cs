using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using Postbox;

namespace TmaMail.Desktop;

public sealed class MessageRow(Message message) {
    public Message Value { get; } = message;
    public string Sender => Value.Sender;
    public string Subject => (Value.Starred ? "★ " : "") + Value.Subject;
    public string Preview => Value.Preview;
    public string Body => Value.Body;
}
public sealed class MailboxViewModel : INotifyPropertyChanged {
    private readonly List<Message> all;
    private string folder = "Inbox", search = "";
    private MessageRow selected;
    public MailboxViewModel() : this(CreateSamples()) { }
    public MailboxViewModel(IEnumerable<Message> messages) {
        all = messages.ToList();
        InboxCommand = new Command(() => Folder = "Inbox"); SentCommand = new Command(() => Folder = "Sent"); TrashCommand = new Command(() => Folder = "Trash");
        ReadCommand = new Command(() => Change(m => m.Unread = !m.Unread), () => selected != null);
        StarCommand = new Command(() => Change(m => m.Starred = !m.Starred), () => selected != null);
        DeleteCommand = new Command(() => Change(m => m.Folder = folder == "Trash" ? "Inbox" : "Trash"), () => selected != null);
        Reload();
    }
    public ObservableCollection<MessageRow> Messages { get; } = [];
    public string Folder { get => folder; set { folder = value; Reload(); OnChanged(); OnChanged(nameof(DeleteLabel)); } }
    public string Search { get => search; set { search = value ?? ""; Reload(); OnChanged(); } }
    public MessageRow Selected { get => selected; set { selected = value; OnChanged(); OnChanged(nameof(ReadLabel)); foreach (var command in new[] { ReadCommand, StarCommand, DeleteCommand }) ((Command)command)?.Refresh(); } }
    public string ReadLabel => selected?.Value.Unread == true ? "Mark Read" : "Mark Unread";
    public string DeleteLabel => folder == "Trash" ? "Restore" : "Delete";
    public string Status => $"{Messages.Count} sample messages · no server connection · {System.Runtime.InteropServices.RuntimeInformation.OSDescription}";
    public ICommand InboxCommand { get; } public ICommand SentCommand { get; } public ICommand TrashCommand { get; }
    public ICommand ReadCommand { get; } public ICommand StarCommand { get; } public ICommand DeleteCommand { get; }
    private void Reload(string keep = null) {
        Messages.Clear();
        foreach (var message in all.Where(m => m.Folder == folder && (search.Length == 0 || new[] { m.Subject, m.Sender, m.Body }.Any(v => (v ?? "").Contains(search, StringComparison.OrdinalIgnoreCase)))).OrderByDescending(m => m.Date)) Messages.Add(new MessageRow(message));
        Selected = Messages.FirstOrDefault(m => m.Value.Id == keep) ?? Messages.FirstOrDefault(); OnChanged(nameof(Status));
    }
    private void Change(Action<Message> action) { if (selected == null) return; string id = selected.Value.Id; action(selected.Value); Reload(id); }
    public event PropertyChangedEventHandler PropertyChanged;
    private void OnChanged([CallerMemberName] string name = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    private static IEnumerable<Message> CreateSamples() => new[] {
        new Message { Id = "sample-welcome", Folder = "Inbox", Sender = "TMA-Mail Preview", Address = "preview@example.com", Subject = "Welcome to the desktop preview", Body = "This mailbox contains sample messages only. Search, select messages, mark read, star, delete and restore to try the shared desktop layout.\n\nReal account setup, the secure native vault and full feature migration are still being developed.", Unread = true, Date = DateTime.Now },
        new Message { Id = "sample-layout", Folder = "Inbox", Sender = "Sample Team", Address = "team@example.com", Subject = "A familiar layout", Body = "Resize the folders, message list and reading pane using their dividers. This preview does not access your existing Windows mail profile.", Unread = true, Date = DateTime.Now.AddMinutes(-20) },
        new Message { Id = "sample-sent", Folder = "Sent", Sender = "Sample User", Address = "sample@example.com", Subject = "A sample sent message", Body = "This is synthetic preview content. No email was sent.", Date = DateTime.Now.AddHours(-1) }
    };
    private sealed class Command(Action action, Func<bool> canRun = null) : ICommand {
        public bool CanExecute(object parameter) => canRun?.Invoke() ?? true;
        public void Execute(object parameter) { if (CanExecute(parameter)) action(); }
        public event EventHandler CanExecuteChanged;
        public void Refresh() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
    }
}
