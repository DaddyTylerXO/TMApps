(function (root) {
  const agents = [
    { id: 'atlas', name: 'Atlas', role: 'Orchestrator', color: '#5c8570', glyph: 'A', x: 49, y: 22 },
    { id: 'scout', name: 'Scout', role: 'Researcher', color: '#c29b55', glyph: 'S', x: 22, y: 43 },
    { id: 'nova', name: 'Nova', role: 'Developer', color: '#8b85b1', glyph: 'N', x: 49, y: 49 },
    { id: 'pixel', name: 'Pixel', role: 'Designer', color: '#d38f76', glyph: 'P', x: 77, y: 43 },
    { id: 'sentinel', name: 'Sentinel', role: 'Reviewer', color: '#6b9aaa', glyph: 'S', x: 30, y: 75 },
    { id: 'echo', name: 'Echo', role: 'Writer', color: '#b3829b', glyph: 'E', x: 68, y: 75 }
  ];
  const flows = { feature: ['atlas', 'scout', 'pixel', 'nova', 'sentinel'], research: ['atlas', 'scout', 'echo', 'sentinel'], design: ['atlas', 'pixel', 'nova', 'sentinel'] };
  const zones = [
    { id: 'forge', name: 'FORGE', icon: '🔨', color: '#d58a42', description: 'Brainstorming, experiments, tool learning' },
    { id: 'content', name: 'CONTENT', icon: '📝', color: '#568acb', description: 'Blog publishing (3 languages)' },
    { id: 'sns', name: 'SNS', icon: '💬', color: '#cf7dab', description: 'AI character auto-posting' },
    { id: 'products', name: 'PRODUCTS', icon: '⚙', color: '#b79a28', description: 'Desktop apps, tools' },
    { id: 'infra', name: 'INFRA', icon: '🛡', color: '#5b9b70', description: 'Bots, infrastructure' },
    { id: 'business', name: 'BUSINESS', icon: '💼', color: '#9a79be', description: 'Business, portfolio' },
    { id: 'games', name: 'GAMES', icon: '🎮', color: '#459e9c', description: 'Game dev' },
    { id: 'archive', name: 'ARCHIVE', icon: '📦', color: '#8c939d', description: 'Paused projects' }
  ];
  const defaultZones = { atlas: 'business', scout: 'forge', nova: 'products', pixel: 'games', sentinel: 'infra', echo: 'content' };
  function roster(state) { return state.agents || agents; }
  function workflow(job) { return job.flow || flows[job.type]; }
  function project(name, zone, status = 'active') {
    return { id: 'project-' + Math.random().toString(36).slice(2, 10), name, zone, status, lastTouched: Date.now() };
  }
  function stale(project, now = Date.now()) { return now - project.lastTouched >= 7 * 24 * 60 * 60 * 1000; }
  function upgrade(state) {
    state.mode ||= 'live';
    for (const job of state.jobs) {
      job.execution ||= 'demo';
      if (state.mode === 'live' && !job.native && ['queued','running'].includes(job.status)) {job.status='archived';job.error='Imported from the demo. Create a live job to execute this work with OpenAI.';}
    }
    state.agents ||= agents.map(a => ({ ...a, zone: defaultZones[a.id], description: '' }));
    state.appearance ||= { theme: 'light', reducedMotion: false };
    state.appearance.textSize = [100,110,120,130,140,150,160,170,180,190,200].includes(state.appearance.textSize) ? state.appearance.textSize : 100;
    if (!Array.isArray(state.projects)) {
      state.projects = state.mode === 'demo' ? [project('Idea laboratory', 'forge', 'prototype'), project('Multilingual blog', 'content'), project('Character studio', 'sns', 'prototype'), project('Agent Office', 'products'), project('Bot workshop', 'infra'), project('Portfolio', 'business', 'completed'), project('Tiny worlds', 'games', 'prototype'), project('Earlier experiments', 'archive', 'paused')] : [];
    }
    return state;
  }
  function task(title, type = 'feature', priority = 'medium') {
    return { id: 'JOB-' + Math.random().toString(36).slice(2, 7).toUpperCase(), execution:'demo', title, type, priority, step: 0, progress: 0, status: 'queued', created: Date.now(), artifacts: [] };
  }
  function initial({demo=false}={}) {
    const jobs = demo ? [task('Build the onboarding experience', 'feature', 'high'), task('Research competitor pricing', 'research'), task('Design the analytics dashboard', 'design'), task('Explore accessibility improvements', 'research', 'low')] : [];
    if(demo){jobs[0].status = 'running'; jobs[0].step = 2; jobs[0].progress = 35;}
    return upgrade({ version: 1, mode:demo?'demo':'live', paused: false, jobs, events: [{ time: Date.now(), agent: 'atlas', text: 'Office is ready. Let’s make something great.', kind: 'system' }], selected: null, view: 'office' });
  }
  function log(state, agent, text, kind = 'handoff') { state.events.unshift({ time: Date.now(), agent, text, kind }); state.events = state.events.slice(0, 100); }
  function tick(state) {
    if (state.mode === 'live') return false;
    if (state.paused) return false;
    let job = state.jobs.find(j => j.status === 'running');
    if (!job) {
      job = state.jobs.find(j => j.status === 'queued');
      if (!job) return false;
      job.status = 'running'; log(state, 'atlas', `Started “${job.title}”.`, 'start'); return true;
    }
    if (job.execution === 'artcraft') return false;
    const flow = workflow(job);
    const linkedProject = state.projects?.find(p => p.id === job.projectId);
    if (linkedProject) linkedProject.lastTouched = Date.now();
    job.progress += 7;
    if (job.progress >= 100) {
      const owner = flow[job.step];
      job.artifacts.push({ agent: owner, text: `${roster(state).find(a => a.id === owner).role} demo stage completed for “${job.title}”.`, time: Date.now() });
      job.progress = 0; job.step++;
      if (job.step >= flow.length) { job.status = 'done'; log(state, owner, `Completed “${job.title}”. All demo stages passed.`, 'complete'); }
      else log(state, owner, `Handed “${job.title}” to ${roster(state).find(a => a.id === flow[job.step]).name}.`);
    }
    return true;
  }
  const api = { agents, flows, zones, roster, workflow, project, stale, upgrade, task, initial, tick, log };
  if (typeof module !== 'undefined') module.exports = api;
  else root.OfficeEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
