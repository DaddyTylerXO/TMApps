// Preparation only: the operator must supply a real session authorizer and HTTPS host.
const { createMarketClient, validate } = require("../desktop/market.cjs");
function createMarketHandler({
  authorize,
  enforcePolicy,
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
    if (typeof enforcePolicy !== "function")
      return new Response("Central refresh policy not configured", {
        status: 503,
      });
    const text = await request.text();
    if (text.length > 2000)
      return new Response("Request too large", { status: 413 });
    try {
      const { provider, operation, params } = JSON.parse(text);
      if (provider !== "alphavantage")
        throw Error("Only Alpha Vantage is enabled for shared access.");
      const normalized = validate(provider, operation, params);
      const data = await enforcePolicy(
        { provider, operation, params: normalized, userId: user.userId },
        () => client.request(provider, operation, normalized),
      );
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
