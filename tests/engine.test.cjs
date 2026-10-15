const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
test('real app jobs are never advanced by the simulation', () => {
  const state = E.initial({demo:true}); const job = E.task('Real action');
  Object.assign(job,{execution:'artcraft',flow:['atlas']}); state.jobs=[job];
  E.tick(state); assert.equal(job.status,'running');
  for(let i=0;i<100;i++) E.tick(state);
  assert.equal(job.progress,0); assert.equal(job.step,0); assert.equal(job.status,'running');
});
test('upgrade preserves existing jobs and adds zones, roster and preferences', () => {
  const old = {version:1, jobs:[E.task('Keep my work')], events:[], paused:true};
  E.upgrade(old); assert.equal(old.jobs[0].title, 'Keep my work'); assert.equal(old.agents.length, 6); assert.equal(old.projects.length, 0); assert.equal(old.appearance.theme, 'light');assert.equal(old.mode,'live');assert.equal(old.jobs[0].status,'archived');
  old.projects = []; E.upgrade(old); assert.equal(old.projects.length, 0);
});
test('stale threshold starts exactly at seven days, including completed and paused projects', () => {
  const now = Date.now();
  assert.equal(E.stale({lastTouched:now - 7 * 86400000 + 1}, now), false);
  for (const status of ['active','prototype','completed','paused']) assert.equal(E.stale({lastTouched:now - 7 * 86400000,status}, now), true);
});
test('custom teammates complete their stages and linked projects are touched', () => {
  const state = E.initial({demo:true}); state.jobs = [E.task('Custom job')];
  state.agents.push({id:'custom',name:'Spark',role:'Designer'});
  state.jobs[0].flow = ['atlas','custom','sentinel']; state.jobs[0].projectId = state.projects[0].id;
  state.projects[0].lastTouched = 0;
  for (let i = 0; i < 80; i++) E.tick(state);
  assert.equal(state.jobs[0].status, 'done'); assert.deepEqual(state.jobs[0].artifacts.map(a => a.agent), ['atlas','custom','sentinel']);
  assert.ok(state.projects[0].lastTouched > 0); assert.match(state.events.map(e=>e.text).join(' '), /Spark/);
});
test('jobs complete every stage in order and record handoffs', () => {
  const state = { paused:false, jobs:[E.task('Test feature')], events:[] };
  for (let i = 0; i < 100; i++) E.tick(state);
  assert.equal(state.jobs[0].status, 'done');
  assert.deepEqual(state.jobs[0].artifacts.map(a => a.agent), E.flows.feature);
  assert.equal(state.events.filter(e => e.kind === 'handoff').length, 4);
});
test('pause freezes work and the queue advances only after completion', () => {
  const state = { paused:true, jobs:[E.task('First'), E.task('Second')], events:[] };
  const snapshot = JSON.stringify(state); E.tick(state); assert.equal(JSON.stringify(state), snapshot);
  state.paused = false; E.tick(state); assert.equal(state.jobs[0].status, 'running'); assert.equal(state.jobs[1].status, 'queued');
  while (state.jobs[0].status !== 'done') E.tick(state);
  E.tick(state); assert.equal(state.jobs[1].status, 'running');
});
test('all workflows survive saving and loading during progress', () => {
  for (const type of Object.keys(E.flows)) {
    let state = { paused:false, jobs:[E.task('Persist me', type)], events:[] };
    for (let i = 0; i < 20; i++) E.tick(state);
    state = JSON.parse(JSON.stringify(state));
    for (let i = 0; i < 100; i++) E.tick(state);
    assert.equal(state.jobs[0].status, 'done'); assert.equal(state.jobs[0].artifacts.length, E.flows[type].length);
  }
});
