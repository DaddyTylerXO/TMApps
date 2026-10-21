import BetterSqlite3 from "better-sqlite3";
import { DatabaseSync, backup } from "node:sqlite";
import fs from "node:fs";
// Keep the approved binding when a matching native binary is available. Electron's
// own SQLite is a free, transactional fallback on development machines without C++.
class BuiltinSQLite {
  constructor(filename, options = {}) {
    if (options.fileMustExist && !fs.existsSync(filename))
      throw Error("Recovery backup missing.");
    this.database = new DatabaseSync(filename, {
      readOnly: !!options.readonly,
    });
    this.depth = 0;
    this.provider = "node:sqlite";
  }
  prepare(sql) {
    return this.database.prepare(sql);
  }
  exec(sql) {
    return this.database.exec(sql);
  }
  pragma(sql, options = {}) {
    const rows = this.database.prepare("PRAGMA " + sql).all();
    return options.simple ? Object.values(rows[0] || {})[0] : rows;
  }
  transaction(fn) {
    return (...args) => {
      const depth = this.depth++;
      const name = "libraries_" + depth;
      this.database.exec(depth ? "SAVEPOINT " + name : "BEGIN IMMEDIATE");
      try {
        const result = fn(...args);
        this.database.exec(depth ? "RELEASE SAVEPOINT " + name : "COMMIT");
        return result;
      } catch (e) {
        this.database.exec(
          depth ? "ROLLBACK TO SAVEPOINT " + name : "ROLLBACK",
        );
        if (depth) this.database.exec("RELEASE SAVEPOINT " + name);
        throw e;
      } finally {
        this.depth--;
      }
    };
  }
  async backup(target) {
    return backup(this.database, target);
  }
  close() {
    this.database.close();
  }
}
export default function Database(filename, options) {
  try {
    return new BetterSqlite3(filename, options);
  } catch (e) {
    if (
      !/bindings file|NODE_MODULE_VERSION|Module did not self-register|not a valid Win32 application/.test(
        e.message,
      )
    )
      throw e;
    return new BuiltinSQLite(filename, options);
  }
}
