const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const catalog = [
  ['photocraft','PhotoCraft','Image editing','#568acb'], ['vectorcraft','VectorCraft','Vector illustration','#dc705a'],
  ['filmcraft','FilmCraft','Video editing, color and sound','#9575ca'], ['lightcraft','LightCraft','Photo library and raw development','#c8a135'],
  ['pdfcraft','PdfCraft','Reading, organizing and protecting PDFs','#4ca692'], ['effectcraft','EffectCraft','Motion graphics and visual effects','#cc6da8'],
  ['designcraft','DesignCraft','Page layout and publishing','#9cba56'], ['wordcraft','WordCraft','Writing and document design','#6d8adb'],
  ['deckcraft','DeckCraft','Presentations and slide shows','#d8904d'], ['gridcraft','GridCraft','Spreadsheets and data','#5aab7c'],
  ['cadcraft','CADCraft','Computer-aided design and drafting','#5ca8c5'], ['soundcraft','SoundCraft','Recording, editing and mixing audio','#56a5b8'],
  ['figcraft','FigCraft','Interface design and prototyping','#4caa8d']
].map(([id,name,description,color]) => ({id,name,description,color, confined:['photocraft','vectorcraft','effectcraft','wordcraft','soundcraft'].includes(id)}));
function discover(overrides = {}, programFiles = process.env.ProgramFiles || 'C:\\Program Files') {
  return catalog.map(app => {
    const cli = overrides[app.id] || path.join(programFiles, app.name, `${app.id}-cli.exe`);
    const desktop = path.join(path.dirname(cli), `${app.id}.exe`);
    return {...app, cli, desktop, installed:fs.existsSync(cli), desktopInstalled:fs.existsSync(desktop)};
  });
}
class McpClient {
  constructor(executable, args, options = {}) {
    this.pending = new Map(); this.nextId = 1; this.buffer = ''; this.stderr = '';
    this.child = spawn(executable, args, { windowsHide:true, shell:false, stdio:['pipe','pipe','pipe'], ...options });
    this.child.stdout.setEncoding('utf8'); this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', data => {
      this.buffer += data;
      if (this.buffer.length > 16 * 1024 * 1024) { this.fail(new Error('App response exceeded 16 MB.')); this.close(); return; }
      let newline;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0,newline); this.buffer = this.buffer.slice(newline + 1);
        let reply; try { reply = JSON.parse(line); } catch { continue; }
        const request = this.pending.get(reply.id);
        if (!request) continue;
        clearTimeout(request.timer); this.pending.delete(reply.id);
        if (reply.error) request.reject(new Error(reply.error.message || 'ArtCraft request failed.'));
        else request.resolve(reply.result);
      }
    });
    this.child.stderr.on('data', data => { this.stderr = (this.stderr + data).slice(-2000); });
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', code => { this.closed = true; this.fail(new Error(this.stderr.trim() || `App automation exited (${code}).`)); });
    this.child.stdin.on('error', error => this.fail(error));
  }
  fail(error) { for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); } this.pending.clear(); }
  request(method, params = {}, timeout = 20000) {
    if (this.closed) return Promise.reject(new Error('App session has closed.'));
    const id = this.nextId++;
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`App request timed out: ${method}`)); this.close(); }, timeout);
      this.pending.set(id,{resolve,reject,timer});
      this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params}) + '\n');
    });
  }
  async initialize() {
    await this.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'Agent Office',version:'0.1.0'}});
    this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}) + '\n');
  }
  async tools() {
    const tools = []; let cursor;
    do { const result = await this.request('tools/list', cursor ? {cursor} : {}); tools.push(...(result.tools || [])); cursor = result.nextCursor; if (tools.length > 2000) throw new Error('Too many app tools.'); } while (cursor);
    return tools;
  }
  close() { this.closed = true; this.fail(new Error('App session closed.')); this.child.kill(); }
}
function argsFor(root, confined = true) { return confined ? ['mcp','--automation-read-root',root,'--automation-write-root',root] : ['mcp']; }
function authorize(config, agentId, appId) {
  if (!catalog.some(app => app.id === appId)) throw new Error('Unknown ArtCraft app.');
  if (!config.grants?.[agentId]?.includes(appId)) throw new Error('This agent has not been given access to this app.');
}
module.exports = { catalog, discover, McpClient, argsFor, authorize };
