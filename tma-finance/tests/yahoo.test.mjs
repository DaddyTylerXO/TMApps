import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { createRequire } from "node:module";
const { createYahooClient } = createRequire(import.meta.url)(
  "../desktop/yahoo.cjs",
);
function harness() {
  let calls = [],
    streamChild;
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      child.emit("close", null);
    };
    child.stdin = new Writable({
      write(chunk, encoding, callback) {
        const payload = JSON.parse(chunk.toString());
        calls.push(payload);
        process.nextTick(() => {
          if (
            payload.operation === "stream" ||
            payload.operation === "async-stream"
          ) {
            streamChild = child;
            return;
          }
          child.stdout.end(
            JSON.stringify(
              payload.operation === "status"
                ? { data: { available: true } }
                : payload.params.symbol === "FAIL"
                  ? { error: "private test details" }
                  : { data: { c: 123, dp: 1, t: 100 } },
            ),
          );
          child.emit("close", payload.params.symbol === "FAIL" ? 1 : 0);
        });
        callback();
      },
    });
    return child;
  };
  return {
    client: createYahooClient({ executable: process.execPath, spawnImpl }),
    calls,
    get stream() {
      return streamChild;
    },
  };
}
test("Yahoo transport requires personal enablement, caches normalized requests and redacts worker errors", async () => {
  const h = harness();
  await assert.rejects(h.client.request("quote", { symbol: "IBM" }), /Enable/);
  await h.client.connect();
  assert.equal(h.client.status().configured, true);
  const rows = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      h.client.request("quote", { symbol: "IBM", force: i }),
    ),
  );
  assert.equal(h.calls.filter((c) => c.operation === "quote").length, 1);
  assert.equal(rows[0].c, 123);
  rows[0].c = 1;
  assert.equal(rows[1].c, 123);
  await assert.rejects(
    h.client.request("https://example.invalid", {}),
    /Unsupported/,
  );
  await assert.rejects(
    h.client.request("quote", { symbol: "FAIL" }),
    (e) => !e.message.includes("private test details"),
  );
  h.client.disconnect();
  assert.equal(h.client.status().configured, false);
});
test("Yahoo stream validates symbols and stops its child without affecting request clients", async () => {
  const h = harness(),
    messages = [],
    errors = [];
  await h.client.connect();
  assert.throws(
    () =>
      h.client.startStream(
        ["../../bad"],
        false,
        () => {},
        () => {},
      ),
    /valid tickers/,
  );
  h.client.startStream(
    ["IBM"],
    true,
    (m) => messages.push(m),
    (e) => errors.push(e),
  );
  await new Promise((r) => setImmediate(r));
  h.stream.stdout.write(
    JSON.stringify({ symbol: "IBM", currency: "USD", price: 125 }) + "\n",
  );
  h.stream.stdout.write(
    JSON.stringify({ symbol: "OTHER", currency: "USD", price: 1 }) + "\n",
  );
  assert.equal(messages.length, 1);
  assert.equal(h.calls.at(-1).operation, "async-stream");
  h.client.stop();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(errors, []);
  assert.equal(h.client.status().configured, true);
  h.client.shutdown();
});
