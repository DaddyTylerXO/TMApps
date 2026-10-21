// Shared access stays disabled until the hosted authenticated service is integrated.
function sharedMarket(payload) {
  if (payload.provider !== "alphavantage")
    throw Error("Shared access supports Alpha Vantage only.");
  if (payload.action === "request")
    throw Error(
      "Shared Alpha Vantage is awaiting backend setup. Choose a personal key in Settings to connect now.",
    );
  if (!["status", "disconnect"].includes(payload.action))
    throw Error("Shared access does not accept personal keys.");
  return { configured: false, source: "shared", pending: true };
}
module.exports = { sharedMarket };
