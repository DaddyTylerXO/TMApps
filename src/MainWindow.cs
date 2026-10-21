using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace TMApps.Libraries
{
    public sealed class MainWindow : Form
    {
        static readonly Color Brown = ColorTranslator.FromHtml("#97572B");
        readonly Store store;
        readonly Workspace workspace;
        readonly bool smoke;
        readonly Timer autosave = new Timer();
        readonly ListBox navigation = new ListBox(), documents = new ListBox();
        readonly TextBox search = new TextBox(), title = new TextBox(), tags = new TextBox(), body = new TextBox(), sideNotes = new TextBox(), newItem = new TextBox();
        readonly ComboBox folder = new ComboBox();
        readonly CheckBox favourite = new CheckBox(), showProgress = new CheckBox();
        readonly CheckedListBox checklist = new CheckedListBox();
        readonly ProgressBar progress = new ProgressBar();
        readonly Label state = new Label(), details = new Label(), progressText = new Label();
        readonly TabControl tabs = new TabControl();
        readonly TabPage contentTab = new TabPage("Content"), notesTab = new TabPage("Side notes"), detailsTab = new TabPage("Details");
        readonly Panel notePanel = new Panel(), checklistPanel = new Panel();
        readonly TableLayoutPanel editor = new TableLayoutPanel();
        LibraryDocument current;
        bool binding, dirty;
        int smokeAssertions;

        public MainWindow(Store store, Workspace workspace, bool smoke)
        {
            this.store = store; this.workspace = workspace; this.smoke = smoke;
            Text = "TMA-Libraries"; Size = new Size(1280, 820); MinimumSize = new Size(1050, 680);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 10); AutoScaleMode = AutoScaleMode.Dpi; KeyPreview = true;
            Icon = MakeIcon();
            var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, Padding = new Padding(16) };
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 78)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50)); layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));
            Controls.Add(layout);
            var header = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
            header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 230));
            var brand = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            brand.Controls.Add(new PictureBox { Image = Icon.ToBitmap(), SizeMode = PictureBoxSizeMode.StretchImage, Size = new Size(48, 48), Margin = new Padding(0, 6, 14, 0) });
            var heading = new Label { Text = "TMA-Libraries\nYour local document workspace", AutoSize = true, Font = new Font(Font.FontFamily, 16), Margin = new Padding(0, 4, 0, 0) };
            brand.Controls.Add(heading); header.Controls.Add(brand, 0, 0);
            header.Controls.Add(new Label { Text = "VERSION 0.1.0\nLocal storage · Offline editing", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleRight }, 1, 0); layout.Controls.Add(header, 0, 0);
            var commands = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            commands.Controls.Add(Button("+ New document", NewDocument, true)); commands.Controls.Add(Button("Open from location", Import)); commands.Controls.Add(Button("Export copy", Export)); commands.Controls.Add(Button("Save   Ctrl+S", delegate { Save(); })); commands.Controls.Add(Button("Settings", Settings)); commands.Controls.Add(Button("Feature tour", Tour));
            layout.Controls.Add(commands, 0, 1);
            var columns = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1 };
            columns.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170)); columns.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 270)); columns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); layout.Controls.Add(columns, 0, 2);
            var left = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1, Padding = new Padding(0, 0, 12, 0) };
            left.RowStyles.Add(new RowStyle(SizeType.Absolute, 36)); left.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); left.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
            left.Controls.Add(new Label { Text = "WORKSPACE", Dock = DockStyle.Fill }, 0, 0);
            navigation.Dock = DockStyle.Fill; navigation.BorderStyle = BorderStyle.None; navigation.IntegralHeight = false; navigation.ItemHeight = 30; navigation.HorizontalScrollbar = true;
            navigation.SelectedIndexChanged += delegate { if (!binding) RefreshDocuments(); }; left.Controls.Add(navigation, 0, 1); left.Controls.Add(Button("+ New folder", NewFolder), 0, 2); columns.Controls.Add(left, 0, 0);
            var centre = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Padding = new Padding(0, 0, 12, 0) };
            centre.RowStyles.Add(new RowStyle(SizeType.Absolute, 27)); centre.RowStyles.Add(new RowStyle(SizeType.Absolute, 38)); centre.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            centre.Controls.Add(new Label { Text = "Find by title, text or tag", Dock = DockStyle.Fill }, 0, 0);
            search.Dock = DockStyle.Top; search.AccessibleName = "Search documents"; search.TextChanged += delegate { RefreshDocuments(); }; centre.Controls.Add(search, 0, 1);
            documents.Dock = DockStyle.Fill; documents.BorderStyle = BorderStyle.FixedSingle; documents.IntegralHeight = false; documents.DrawMode = DrawMode.OwnerDrawFixed; documents.ItemHeight = 88; documents.DisplayMember = "Title";
            documents.DrawItem += DrawDocument; documents.SelectedIndexChanged += delegate { if (!binding) OpenDocument(documents.SelectedItem as LibraryDocument); }; centre.Controls.Add(documents, 0, 2); columns.Controls.Add(centre, 1, 0);
            editor.Dock = DockStyle.Fill; editor.ColumnCount = 2; editor.RowCount = 6; editor.Padding = new Padding(12); editor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50)); editor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            editor.RowStyles.Add(new RowStyle(SizeType.Absolute, 28)); editor.RowStyles.Add(new RowStyle(SizeType.Absolute, 44)); editor.RowStyles.Add(new RowStyle(SizeType.Absolute, 28)); editor.RowStyles.Add(new RowStyle(SizeType.Absolute, 40)); editor.RowStyles.Add(new RowStyle(SizeType.Absolute, 35)); editor.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            editor.Controls.Add(new Label { Text = "Document title", AutoSize = true }, 0, 0);
            favourite.Text = "Favourite"; favourite.AutoSize = true; favourite.Dock = DockStyle.Right; favourite.CheckedChanged += Change; editor.Controls.Add(favourite, 1, 0);
            title.Dock = DockStyle.Top; title.Font = new Font(Font.FontFamily, 16); title.MaxLength = 200; title.AccessibleName = "Document title"; title.TextChanged += Change; editor.Controls.Add(title, 0, 1); editor.SetColumnSpan(title, 2);
            editor.Controls.Add(new Label { Text = "Folder", AutoSize = true }, 0, 2); editor.Controls.Add(new Label { Text = "Tags separated by commas", AutoSize = true }, 1, 2);
            folder.Dock = DockStyle.Top; folder.DropDownStyle = ComboBoxStyle.DropDownList; folder.AccessibleName = "Document folder"; folder.SelectedIndexChanged += Change; editor.Controls.Add(folder, 0, 3);
            tags.Dock = DockStyle.Top; tags.MaxLength = 1000; tags.AccessibleName = "Document tags"; tags.TextChanged += Change; editor.Controls.Add(tags, 1, 3);
            editor.Controls.Add(new Label { Text = "Notes save as plain text. Checklists have individual completion controls.", Dock = DockStyle.Fill, AutoEllipsis = true }, 0, 4); editor.SetColumnSpan(editor.GetControlFromPosition(0, 4), 2);
            tabs.Dock = DockStyle.Fill; tabs.TabPages.AddRange(new[] { contentTab, notesTab, detailsTab }); editor.Controls.Add(tabs, 0, 5); editor.SetColumnSpan(tabs, 2);
            ConfigureText(body, "Note content", 2000000); body.TextChanged += Change; notePanel.Dock = DockStyle.Fill; notePanel.Controls.Add(body); contentTab.Controls.Add(notePanel);
            ConfigureText(sideNotes, "Side notes", 200000); sideNotes.TextChanged += Change; notesTab.Controls.Add(sideNotes);
            details.Dock = DockStyle.Fill; details.Padding = new Padding(14); detailsTab.Controls.Add(details);
            BuildChecklist(); columns.Controls.Add(editor, 2, 0);
            state.Dock = DockStyle.Fill; state.TextAlign = ContentAlignment.MiddleLeft; layout.Controls.Add(state, 0, 3);
            RefreshNavigation(); ApplyAppearance(); OpenDocument(null); SetStatus("Ready · No document selected");
            autosave.Interval = workspace.Settings.AutosaveSeconds * 1000;
            autosave.Tick += delegate { if (dirty && workspace.Settings.Autosave) Save(); }; autosave.Start();
            FormClosing += delegate(object sender, FormClosingEventArgs e) { if (dirty && !Save()) e.Cancel = true; };
            FormClosed += delegate { autosave.Dispose(); Icon.Dispose(); };
            Shown += delegate { if (!smoke && store.Recovered) MessageBox.Show(this, "The previous saved workspace was recovered from the local backup. The most recent changes may be missing. See Libraries-KB3.", "Recovery"); if (!smoke && !workspace.Settings.SetupComplete) Setup(); };
        }

        static Icon MakeIcon()
        {
            using (var bitmap = new Bitmap(64, 64))
            {
                using (var g = Graphics.FromImage(bitmap)) { g.Clear(Brown); g.FillRectangle(Brushes.White, 12, 18, 19, 8); g.FillRectangle(Brushes.White, 12, 24, 41, 27); }
                IntPtr handle = bitmap.GetHicon();
                try { return (Icon)Icon.FromHandle(handle).Clone(); } finally { DestroyIcon(handle); }
            }
        }
        [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
        static void ConfigureText(TextBox box, string name, int limit) { box.Multiline = true; box.AcceptsReturn = true; box.AcceptsTab = false; box.ScrollBars = ScrollBars.Vertical; box.Dock = DockStyle.Fill; box.MaxLength = limit; box.AccessibleName = name; }
        Button Button(string text, Action action, bool primary = false)
        {
            var button = new Button { Text = text, AutoSize = true, Height = 34, MinimumSize = new Size(90, 34), FlatStyle = FlatStyle.Flat, Margin = new Padding(0, 0, 8, 6), Padding = new Padding(8, 0, 8, 0), UseVisualStyleBackColor = false };
            if (primary) { button.BackColor = Brown; button.ForeColor = Color.White; button.Tag = "brand"; }
            button.Click += delegate { action(); }; return button;
        }
        void BuildChecklist()
        {
            checklistPanel.Dock = DockStyle.Fill;
            var grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5 };
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 32)); grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 26)); grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 32)); grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
            showProgress.Text = "Show completion progress"; showProgress.AutoSize = true; showProgress.CheckedChanged += Change; grid.Controls.Add(showProgress, 0, 0);
            var progressRow = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 }; progressRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55)); progressRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45)); progress.Dock = DockStyle.Fill; progressText.Dock = DockStyle.Fill; progressRow.Controls.Add(progress, 0, 0); progressRow.Controls.Add(progressText, 1, 0); grid.Controls.Add(progressRow, 0, 1);
            checklist.Dock = DockStyle.Fill; checklist.CheckOnClick = true; checklist.AccessibleName = "Checklist items"; checklist.HorizontalScrollbar = true;
            checklist.ItemCheck += delegate(object sender, ItemCheckEventArgs e) { if (binding || current == null) return; current.Items[e.Index].Done = e.NewValue == CheckState.Checked; MarkDirty(); BeginInvoke((Action)UpdateProgress); }; grid.Controls.Add(checklist, 0, 2);
            var input = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 }; input.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90)); input.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); input.Controls.Add(new Label { Text = "New item", Dock = DockStyle.Fill }, 0, 0);
            newItem.Dock = DockStyle.Top; newItem.MaxLength = 10000; newItem.AccessibleName = "New checklist item"; newItem.KeyDown += delegate(object sender, KeyEventArgs e) { if (e.KeyCode == Keys.Enter) { AddItem(); e.SuppressKeyPress = true; } }; input.Controls.Add(newItem, 1, 0); grid.Controls.Add(input, 0, 3);
            var row = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false }; row.Controls.Add(Button("Add item", AddItem)); row.Controls.Add(Button("Remove selected", RemoveItem)); grid.Controls.Add(row, 0, 4); checklistPanel.Controls.Add(grid); contentTab.Controls.Add(checklistPanel);
        }
        void RefreshNavigation()
        {
            string selected = navigation.SelectedItem as string;
            binding = true; navigation.Items.Clear(); navigation.Items.AddRange(new object[] { "All documents", "Favourites", "Recent documents" });
            foreach (string name in workspace.Folders.OrderBy(f => f)) navigation.Items.Add("Folder: " + name);
            navigation.SelectedIndex = selected != null && navigation.Items.Contains(selected) ? navigation.Items.IndexOf(selected) : 0; binding = false;
            RefreshDocuments();
        }
        void RefreshDocuments()
        {
            if (binding) return;
            var query = workspace.Documents.AsEnumerable(); string selected = navigation.SelectedItem as string ?? "All documents";
            if (selected == "Favourites") query = query.Where(d => d.Favourite);
            if (selected == "Recent documents") query = query.Where(d => d.Opened != DateTime.MinValue).OrderByDescending(d => d.Opened).Take(30);
            if (selected.StartsWith("Folder: ")) query = query.Where(d => d.Folder == selected.Substring(8));
            string term = search.Text.Trim(); if (term != "") query = query.Where(d => (d.Title + " " + d.Body + " " + d.Tags + " " + String.Join(" ", d.Items.Select(i => i.Text))).IndexOf(term, StringComparison.OrdinalIgnoreCase) >= 0);
            if (selected != "Recent documents") query = query.OrderByDescending(d => d.Modified);
            binding = true; documents.BeginUpdate(); documents.Items.Clear(); foreach (var d in query) documents.Items.Add(d); if (current != null && documents.Items.Contains(current)) documents.SelectedItem = current; documents.EndUpdate(); binding = false;
        }
        void DrawDocument(object sender, DrawItemEventArgs e)
        {
            if (e.Index < 0) return;
            var d = (LibraryDocument)documents.Items[e.Index]; bool selected = (e.State & DrawItemState.Selected) != 0;
            Color back = selected ? Brown : documents.BackColor, text = selected ? Color.White : documents.ForeColor;
            using (var brush = new SolidBrush(back)) e.Graphics.FillRectangle(brush, e.Bounds);
            var r = new Rectangle(e.Bounds.X + 10, e.Bounds.Y + 7, e.Bounds.Width - 20, 25);
            TextRenderer.DrawText(e.Graphics, (d.Favourite ? "★ " : "") + d.Title, Font, r, text, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            r.Y += 25; TextRenderer.DrawText(e.Graphics, d.Kind + (d.Folder == "" ? "" : " · " + d.Folder), Font, r, text, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            int x = e.Bounds.X + 10;
            foreach (var tag in d.TagList.Take(3))
            {
                int w = Math.Min(85, TextRenderer.MeasureText(tag, Font).Width + 8); if (x + w > e.Bounds.Right - 5) break;
                var chip = new Rectangle(x, e.Bounds.Y + 58, w, 23); int hash = tag.Aggregate(0, (h, c) => unchecked(h * 31 + c));
                Color tagBack = new[] { Color.FromArgb(248, 226, 201), Color.FromArgb(214, 236, 231), Color.FromArgb(229, 224, 246) }[(hash & int.MaxValue) % 3];
                using (var brush = new SolidBrush(tagBack)) e.Graphics.FillRectangle(brush, chip);
                TextRenderer.DrawText(e.Graphics, tag, Font, chip, Color.Black, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix); x += w + 4;
            }
            e.DrawFocusRectangle();
        }
        void OpenDocument(LibraryDocument document)
        {
            current = document; binding = true; editor.Enabled = current != null;
            title.Text = current == null ? "Select or create a document" : current.Title;
            tags.Text = current == null ? "" : current.Tags; favourite.Checked = current != null && current.Favourite;
            folder.Items.Clear(); folder.Items.Add("No folder"); foreach (string f in workspace.Folders) folder.Items.Add(f); folder.SelectedIndex = current == null || current.Folder == "" ? 0 : folder.Items.IndexOf(current.Folder);
            body.Text = current == null ? "" : current.Body; sideNotes.Text = current == null ? "" : current.SideNotes;
            checklist.Items.Clear(); if (current != null) foreach (var item in current.Items) checklist.Items.Add(item, item.Done);
            showProgress.Checked = current != null && current.ShowProgress; bool isChecklist = current != null && current.Kind == "Checklist";
            notePanel.Visible = !isChecklist; checklistPanel.Visible = isChecklist;
            if (isChecklist) checklistPanel.BringToFront(); else notePanel.BringToFront();
            binding = false; UpdateProgress(); UpdateDetails();
            if (current != null) { current.Opened = DateTime.UtcNow; dirty = true; SetStatus("Opened " + current.Kind.ToLowerInvariant() + " · Recent list updated; save pending"); }
        }
        void Change(object sender, EventArgs e)
        {
            if (binding || current == null) return;
            current.Title = title.Text; current.Body = body.Text; current.SideNotes = sideNotes.Text; current.Tags = tags.Text; current.Favourite = favourite.Checked; current.Folder = folder.SelectedIndex <= 0 ? "" : folder.SelectedItem.ToString(); current.ShowProgress = showProgress.Checked;
            MarkDirty(); UpdateProgress(); documents.Invalidate();
        }
        void MarkDirty() { dirty = true; if (current != null) current.Modified = DateTime.UtcNow; SetStatus(workspace.Settings.Autosave ? "Unsaved changes · Autosave pending" : "Unsaved changes · Press Ctrl+S to save"); }
        void SetStatus(string text) { state.Text = text; }
        bool Save()
        {
            try { store.Save(workspace); dirty = false; SetStatus("Saved locally at " + DateTime.Now.ToString("HH:mm:ss") + " · Previous save kept as recovery backup"); UpdateDetails(); RefreshDocuments(); return true; }
            catch (Exception e) { if (!(e is IOException || e is UnauthorizedAccessException || e is System.Runtime.Serialization.SerializationException)) throw; SetStatus("Libraries E002 · Save failed. Your changes remain in this window. Check space/access, then retry Ctrl+S."); if (!smoke) MessageBox.Show(this, "Your changes could not be saved. Keep this window open. Check disk space and folder access, then retry Ctrl+S or export a copy to another location. See Libraries-KB3.", "Libraries E002", MessageBoxButtons.OK, MessageBoxIcon.Error); return false; }
        }
        void UpdateProgress()
        {
            if (current == null) return; int count = current.Items.Count(i => i.Done), total = current.Items.Count;
            progress.Visible = progressText.Visible = current.ShowProgress; progress.Value = total == 0 ? 0 : (int)(100L * count / total); progressText.Text = " " + count + "/" + total + " complete · " + (total - count) + " left";
        }
        void UpdateDetails()
        {
            details.Text = current == null ? "" : "Type: " + current.Kind + "\nCreated: " + current.Created.ToLocalTime().ToString("g") + "\nModified: " + current.Modified.ToLocalTime().ToString("g") + "\nStorage: local workspace\nTemplate: blank\n\nVersion history, author profiles and encryption are not available in this build. Keep sensitive documents elsewhere.";
        }
        void NewDocument()
        {
            using (var dialog = Dialog("New document", 520, 300))
            {
                var panel = Stack(dialog); panel.Controls.Add(new Label { Text = "Choose a document type", AutoSize = true, Font = new Font(Font, FontStyle.Bold) });
                panel.Controls.Add(new Label { Text = "Available in 0.1.0: plain-text notes and checklists.\nBooks, rich DOCX documents, ADs, newsletters, CVs, cover letters,\nPDFs, slideshows and spreadsheets are planned.", AutoSize = true, Margin = new Padding(0, 8, 0, 12) });
                panel.Controls.Add(Button("Create note", delegate { CreateDocument("Note"); dialog.Close(); }, true)); panel.Controls.Add(Button("Create checklist", delegate { CreateDocument("Checklist"); dialog.Close(); })); dialog.ShowDialog(this);
            }
        }
        void CreateDocument(string kind)
        {
            var d = new LibraryDocument { Kind = kind, Title = kind == "Note" ? "Untitled note" : "Untitled checklist" };
            string selected = navigation.SelectedItem as string ?? ""; if (selected.StartsWith("Folder: ")) d.Folder = selected.Substring(8);
            workspace.Documents.Add(d); OpenDocument(d); MarkDirty(); RefreshDocuments(); title.Focus(); title.SelectAll();
        }
        void NewFolder()
        {
            using (var dialog = Dialog("New folder", 410, 190))
            {
                var panel = Stack(dialog); panel.Controls.Add(new Label { Text = "Folder name", AutoSize = true }); var name = new TextBox { Width = 340, MaxLength = 120, AccessibleName = "New folder name" }; panel.Controls.Add(name);
                panel.Controls.Add(Button("Create folder", delegate { string value = name.Text.Trim(); if (value == "" || workspace.Folders.Any(f => f.Equals(value, StringComparison.OrdinalIgnoreCase))) { MessageBox.Show(dialog, "Enter a unique folder name."); return; } workspace.Folders.Add(value); MarkDirty(); RefreshNavigation(); navigation.SelectedItem = "Folder: " + value; dialog.Close(); }, true)); dialog.ShowDialog(this);
            }
        }
        void AddItem() { if (current == null || current.Kind != "Checklist" || String.IsNullOrWhiteSpace(newItem.Text)) return; var item = new CheckItem { Text = newItem.Text.Trim() }; current.Items.Add(item); checklist.Items.Add(item, false); newItem.Clear(); MarkDirty(); UpdateProgress(); newItem.Focus(); }
        void RemoveItem() { if (current == null || checklist.SelectedIndex < 0) return; int index = checklist.SelectedIndex; current.Items.RemoveAt(index); binding = true; checklist.Items.RemoveAt(index); binding = false; MarkDirty(); UpdateProgress(); }
        void Import()
        {
            using (var dialog = new OpenFileDialog { Filter = "Libraries workspace copy (*.tmalibrary)|*.tmalibrary", Title = "Import documents from a Libraries copy" })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    var imported = Store.Read(dialog.FileName);
                    // Validate the complete merge before changing the live workspace.
                    var candidate = Store.ReadClone(workspace);
                    foreach (string f in imported.Folders) if (!candidate.Folders.Contains(f)) { if (candidate.Folders.Any(x => x.Equals(f, StringComparison.OrdinalIgnoreCase))) throw new System.Runtime.Serialization.SerializationException("Folder name collision."); candidate.Folders.Add(f); }
                    foreach (var d in imported.Documents) { d.Id = Guid.NewGuid().ToString("N"); candidate.Documents.Add(d); }
                    Store.Encode(candidate);
                    workspace.Folders = candidate.Folders; workspace.Documents.AddRange(imported.Documents); MarkDirty(); RefreshNavigation(); Save();
                }
                catch (Exception e) { if (!(e is IOException || e is UnauthorizedAccessException || e is System.Runtime.Serialization.SerializationException || e is System.Xml.XmlException || e is ArgumentException)) throw; MessageBox.Show(this, "Libraries E003 · This copy could not be imported. It may be damaged, too large, from a newer version, or contain a conflicting folder name. No imported documents were added. See Libraries-KB3.", "Import failed"); }
            }
        }
        void Export()
        {
            using (var dialog = new SaveFileDialog { Filter = "Libraries workspace copy (*.tmalibrary)|*.tmalibrary", DefaultExt = "tmalibrary", FileName = "Libraries copy.tmalibrary", Title = "Export all documents and folders" })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try { Store.Export(dialog.FileName, workspace); SetStatus("Exported all documents and folders. This copy is unencrypted; store it privately."); }
                catch (Exception e) { if (!(e is IOException || e is UnauthorizedAccessException || e is System.Runtime.Serialization.SerializationException)) throw; MessageBox.Show(this, "Libraries E004 · Export failed. Check space and access at the chosen location. See Libraries-KB3.", "Export failed"); }
            }
        }
        Form Dialog(string name, int width, int height) { return new Form { Text = name, Size = new Size(width, height), StartPosition = FormStartPosition.CenterParent, Font = Font, MinimizeBox = false, MaximizeBox = false, FormBorderStyle = FormBorderStyle.FixedDialog, ShowInTaskbar = false }; }
        static FlowLayoutPanel Stack(Form dialog) { var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, Padding = new Padding(20) }; dialog.Controls.Add(panel); return panel; }
        void Setup()
        {
            using (var dialog = Dialog("Welcome to TMA-Libraries", 560, 380))
            {
                var panel = Stack(dialog); panel.Controls.Add(new Label { Text = "Create and organise documents offline", AutoSize = true, Font = new Font(Font, FontStyle.Bold) });
                panel.Controls.Add(new Label { Text = "Your work stays in your Windows user profile. No account is needed.\nOptional accessibility adjustments are off by default. Standard\nkeyboard navigation and labelled controls are always available.", AutoSize = true, Margin = new Padding(0, 12, 0, 12) });
                var large = new CheckBox { Text = "Use larger text", AutoSize = true }; var contrast = new CheckBox { Text = "Use high contrast", AutoSize = true }; panel.Controls.Add(large); panel.Controls.Add(contrast);
                var tour = new CheckBox { Text = "Show the feature tour", Checked = true, AutoSize = true }; panel.Controls.Add(tour);
                panel.Controls.Add(Button("Start using Libraries", delegate { workspace.Settings.LargeText = large.Checked; workspace.Settings.HighContrast = contrast.Checked; workspace.Settings.SetupComplete = true; dirty = true; if (!Save()) return; ApplyAppearance(); dialog.DialogResult = DialogResult.OK; }, true));
                if (dialog.ShowDialog(this) == DialogResult.OK && tour.Checked) Tour();
            }
        }
        void Tour()
        {
            string[] steps = { "1 of 4 · Your workspace\n\nUse New document to create a note or checklist. This tour uses no real document and does not change your work.", "2 of 4 · Find your work\n\nUse folders, favourites, recent documents and search. Comma-separated tags appear as coloured labels in the document list.", "3 of 4 · Write and track progress\n\nNotes contain plain text. Checklists support completion toggles and an optional progress bar. Each document also has a Side notes tab.", "4 of 4 · Save and recover\n\nCtrl+S saves immediately. Autosave defaults to every 5 seconds when there are changes. Export copy creates a portable workspace backup. Settings explains storage, recovery and performance." };
            using (var dialog = Dialog("Feature tour · 0.1.0", 560, 320))
            {
                var panel = Stack(dialog); var text = new Label { Width = 495, Height = 175 }; panel.Controls.Add(text); int step = 0; text.Text = steps[step];
                var next = Button("Next", delegate { }); next.Click += delegate { if (++step == steps.Length) dialog.Close(); else { text.Text = steps[step]; next.Text = step == steps.Length - 1 ? "Finish tour" : "Next"; } }; panel.Controls.Add(next); dialog.ShowDialog(this);
            }
            if (current == null) title.Focus();
        }
        void Settings()
        {
            using (var dialog = Dialog("Settings", 720, 690))
            {
                var panel = Stack(dialog);
                panel.Controls.Add(new Label { Text = "Appearance and accessibility", AutoSize = true, Font = new Font(Font, FontStyle.Bold) });
                var theme = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Width = 280, AccessibleName = "Appearance" }; theme.Items.AddRange(new object[] { "Light", "Grey", "Black" }); theme.SelectedItem = workspace.Settings.Theme; panel.Controls.Add(theme);
                var large = new CheckBox { Text = "Use larger text", AutoSize = true, Checked = workspace.Settings.LargeText }; var contrast = new CheckBox { Text = "Use high contrast", AutoSize = true, Checked = workspace.Settings.HighContrast }; panel.Controls.Add(large); panel.Controls.Add(contrast);
                var automatic = new CheckBox { Text = "Autosave changed workspace", AutoSize = true, Checked = workspace.Settings.Autosave }; panel.Controls.Add(automatic);
                panel.Controls.Add(new Label { Text = "Autosave interval in seconds  2–300", AutoSize = true }); var seconds = new NumericUpDown { Minimum = 2, Maximum = 300, Value = workspace.Settings.AutosaveSeconds, Width = 150, AccessibleName = "Autosave interval in seconds" }; panel.Controls.Add(seconds);
                panel.Controls.Add(new Label { Text = "Shorter intervals use more disk and CPU. Autosave writes the entire workspace\nonly when changed. One previous save is retained; export copies for longer retention.\nA workspace is limited to 16 MiB and is not encrypted. No cloud sync is included.", AutoSize = true, Margin = new Padding(0, 10, 0, 10) });
                panel.Controls.Add(Button("Save settings", delegate { workspace.Settings.Theme = theme.Text; workspace.Settings.LargeText = large.Checked; workspace.Settings.HighContrast = contrast.Checked; workspace.Settings.Autosave = automatic.Checked; workspace.Settings.AutosaveSeconds = (int)seconds.Value; autosave.Interval = (int)seconds.Value * 1000; dirty = true; if (Save()) { ApplyAppearance(); dialog.Close(); } }, true));
                panel.Controls.Add(new Label { Text = "Help and application information", AutoSize = true, Font = new Font(Font, FontStyle.Bold) });
                panel.Controls.Add(Button("Open Word KB draft", OpenKB)); panel.Controls.Add(Button("New features · 0.1.0", delegate { MessageBox.Show(dialog, "0.1.0 · Native Windows desktop foundation\n\nOffline notes and checklists; folders, favourites and tags; recent documents; side notes; atomic local saves and previous-save recovery; native workspace import/export; first-run setup, feature tour and appearance settings.\n\nAdvanced editors and TMApps integrations remain pending.", "New features"); }));
                panel.Controls.Add(Button("GitHub branch (online)", delegate { Process.Start(new ProcessStartInfo("https://github.com/DaddyTylerXO/TMApps/tree/TMA-Libraries") { UseShellExecute = true }); }));
                panel.Controls.Add(new Label { Text = "Shortcuts: Ctrl+N new document, Ctrl+S save, Ctrl+F search, F1 help.\nSupport forms, master KB, TMA-Mail patterns and launcher integration await verified\nreferences. Their requirements remain pending. No crash report is transmitted.", AutoSize = true, Margin = new Padding(0, 10, 0, 0) });
                dialog.ShowDialog(this);
            }
        }
        void OpenKB()
        {
            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "docs", "TMA-Libraries KB Library.docx");
            if (!File.Exists(path)) { MessageBox.Show(this, "Libraries-KB1: Create notes and checklists using New document.\nLibraries-KB2: Saving and exporting work offline.\nLibraries-KB3: E001 startup/recovery, E002 save, E003 import and E004 export.\n\nThe Word KB document is missing from this build. Rebuild with the docs folder present.", "KB Library"); return; }
            try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); } catch (System.ComponentModel.Win32Exception) { MessageBox.Show(this, "Install a free DOCX viewer such as LibreOffice to open the KB Library.", "KB Library"); }
        }
        void ApplyAppearance()
        {
            bool contrast = workspace.Settings.HighContrast, dark = workspace.Settings.Theme != "Light";
            Color background = contrast ? Color.Black : dark ? (workspace.Settings.Theme == "Black" ? Color.FromArgb(19, 19, 19) : Color.FromArgb(44, 44, 44)) : Color.FromArgb(248, 246, 243);
            Color foreground = dark || contrast ? Color.White : Color.FromArgb(35, 30, 27);
            ApplyColors(this, background, foreground); Font = new Font("Segoe UI", workspace.Settings.LargeText ? 11 : 10); documents.ItemHeight = workspace.Settings.LargeText ? 94 : 88; documents.Invalidate();
        }
        void ApplyColors(Control control, Color back, Color fore)
        {
            control.BackColor = back; control.ForeColor = fore;
            if ((string)control.Tag == "brand") { control.BackColor = Brown; control.ForeColor = Color.White; }
            foreach (Control child in control.Controls) ApplyColors(child, back, fore);
        }
        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == (Keys.Control | Keys.S)) { Save(); return true; }
            if (keyData == (Keys.Control | Keys.N)) { NewDocument(); return true; }
            if (keyData == (Keys.Control | Keys.F)) { search.Focus(); return true; }
            if (keyData == Keys.F1) { OpenKB(); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("Desktop smoke check failed."); smokeAssertions++; }
        public void RunSmoke()
        {
            workspace.Settings.SetupComplete = true;
            workspace.Folders.Add("Launch project"); RefreshNavigation(); CreateDocument("Note"); title.Text = "Project notes"; body.Text = "Offline notes with Unicode: café 世界"; tags.Text = "Planning, Ideas"; favourite.Checked = true; folder.SelectedItem = "Launch project"; sideNotes.Text = "Questions for next week";
            Assert(current.Body == body.Text && current.Favourite && current.Folder == "Launch project" && current.SideNotes == sideNotes.Text);
            CreateDocument("Checklist"); title.Text = "Launch checklist"; tags.Text = "Planning"; newItem.Text = "Prepare the document"; AddItem(); newItem.Text = "Review the document"; AddItem(); checklist.SetItemChecked(0, true); Application.DoEvents(); Assert(current.Items[0].Done && progress.Value == 50); Assert(Save());
            navigation.SelectedItem = "Favourites"; Assert(documents.Items.Count == 1); navigation.SelectedItem = "Recent documents"; Assert(documents.Items.Count == 2); navigation.SelectedItem = "All documents"; search.Text = "café"; Assert(documents.Items.Count == 1); search.Clear();
            var reload = store.Load(); Assert(reload.Documents.Count == 2 && reload.Documents[1].Items[0].Done && reload.Documents[0].SideNotes != "");
            workspace.Settings.Theme = "Black"; ApplyAppearance(); Assert(BackColor.R == 19); workspace.Settings.HighContrast = true; ApplyAppearance(); Assert(BackColor == Color.Black); workspace.Settings.HighContrast = false; workspace.Settings.Theme = "Light"; ApplyAppearance();
            showProgress.Checked = false; Assert(!progress.Visible); showProgress.Checked = true;
            Size original = Size; Size = MinimumSize; workspace.Settings.LargeText = true; ApplyAppearance(); Application.DoEvents();
            using (var bitmap = new Bitmap(Width, Height)) { DrawToBitmap(bitmap, new Rectangle(Point.Empty, Size)); bitmap.Save(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "desktop-small.png")); }
            workspace.Settings.LargeText = false; Size = original; ApplyAppearance(); Save();
            var process = Process.GetCurrentProcess(); TimeSpan cpu = process.TotalProcessorTime; var watch = Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < 1000) { Application.DoEvents(); System.Threading.Thread.Sleep(20); }
            process.Refresh();
            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "desktop-smoke.txt"), smokeAssertions + " desktop assertions passed.\r\nDesktop idle sample: elapsedMs=" + watch.ElapsedMilliseconds + " cpuMs=" + (process.TotalProcessorTime - cpu).TotalMilliseconds + " workingSetMiB=" + (process.WorkingSet64 / 1048576));
        }
    }
}
