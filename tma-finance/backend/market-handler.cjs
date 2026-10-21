// Preparation only: the operator must supply a real session authorizer and HTTPS host.
const { createMarketClient } = require("../desktop/market.cjs");
function createMarketHandler({
  authorize,
  client = createMarketClient(),
} = {}) {
  return async function handle(request) {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    if (typeof authorize !== "function")
      return new Response("Service not configured", { status: 503 });
    let user;
    try {
      user = await authorize(request);
    } catch {}
    if (!user?.userId) return new Response("Sign-in required", { status: 401 });
    const text = await request.text();
    if (text.length > 2000)
      return new Response("Request too large", { status: 413 });
    try {
      const { provider, operation, params } = JSON.parse(text);
      const data = await client.request(provider, operation, params);
      return Response.json(
        { data },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch {
      return Response.json(
        { error: "Market request unavailable. Check permissions and quota." },
        { status: 400 },
      );
    }
  };
}
module.exports = { createMarketHandler };
