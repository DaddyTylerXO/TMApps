'use strict';
// A lock cancels both active asynchronous work and work waiting in the IPC queue.
class SessionQueue {
  constructor() { this.epoch = 0; this.tail = Promise.resolve(); }
  invalidate() { this.epoch++; }
  check(epoch) { if (epoch !== this.epoch) throw Error('Operation cancelled because the vault locked.'); }
  run(action) {
    const epoch = this.epoch;
    const result = this.tail.then(async () => { this.check(epoch); const value = await action(); this.check(epoch); return value; });
    this.tail = result.catch(() => {});
    return result;
  }
}
module.exports = { SessionQueue };
