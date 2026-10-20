'use strict';
const { entry } = require('./vault.cjs');
function parseCSV(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 8 * 1024 ** 2) throw Error('Import must be smaller than 8 MB.');
  source = source.replace(/^\uFEFF/, ''); const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i <= source.length; i++) {
    const c = source[i];
    if (quoted) { if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else if (c === undefined) throw Error('Unclosed CSV quote.'); else cell += c; }
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r' || c === undefined) { row.push(cell); cell = ''; closed = false; if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && source[i + 1] === '\n') i++; } }
    else { if (closed || c === '"') throw Error('Malformed CSV quoting.'); cell += c; }
  }
  if (rows.length < 2 || rows.length > 10001) throw Error('Import needs 1–10000 logins.');
  const names = rows.shift().map(v => v.trim().toLowerCase()); if (new Set(names).size !== names.length) throw Error('Duplicate CSV columns.');
  const col = (...keys) => keys.map(k => names.indexOf(k)).find(i => i >= 0);
  const url = col('url', 'origin', 'hostname'), user = col('username'), pass = col('password'), title = col('name', 'title'), notes = col('note', 'notes');
  if ([url, user, pass].includes(undefined)) throw Error('Expected URL, username, and password columns from a browser export.');
  const entries = [], skipped = [];
  rows.forEach((r, i) => { try { if (r.length !== names.length) throw Error('Column count mismatch.'); entries.push(entry({ title: r[title] || new URL(r[url]).hostname, username: r[user], password: r[pass], url: r[url], notes: r[notes] || '', expiryDays: 0 })); } catch { skipped.push(i + 2); } });
  if (!entries.length) throw Error('No supported HTTPS logins found.'); return { entries, skipped };
}
module.exports = { parseCSV };
