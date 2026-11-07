// Live smoke test: run the site's own quote code against real RPCs.
import { routeFor, tokenFor, formatAmount, parseAmount } from "../src/chain.js";
import { getLiveQuote } from "../src/fees.js";

async function show(from, to, sym, amountText) {
  const route = routeFor(from, to);
  const tk = tokenFor(route, sym);
  const amount = parseAmount(amountText, tk.src.decimals);
  const q = await getLiveQuote(route, tk, amount);
  console.log(`${from}->${to} ${sym} ${amountText}: kind=${q.kind} version=${q.version ?? "-"} paused=${q.paused ?? "-"} allowed=${q.allowed ?? "-"} min=${q.min != null ? formatAmount(q.min, tk.src.decimals) : "-"} bridgeFee=${q.bridgeFeeRaw != null ? formatAmount(q.bridgeFeeRaw, tk.src.decimals) : "-"} messagingFee=${q.messagingFeeRaw != null ? formatAmount(q.messagingFeeRaw, 18) : "-"} nativeFallback=${q.nativeFallback ?? "-"} receive=${q.receiveRaw != null ? formatAmount(q.receiveRaw, tk.dst.decimals) : "-"} mailbox=${q.mailbox ?? "-"} code=${q.codeBytes ?? "-"}`);
  return q;
}
await show("infinite", "ql1", "QOM", "100");
await show("infinite", "ethereum", "USDT", "100");
await show("infinite", "ethereum", "WBTC", "1");
await show("infinite", "bsc", "USDC", "100");
await show("ql1", "infinite", "QOM", "1000");
// Inbound routes (enabled 2026-11-07): the older BSC/ETH source routers
// revert quoteNative, so the quote must come back with the nativeOptional
// fallback (messaging fee 0, nativeFallback=true) — mirroring the official
// frontend — while quoteBridge / paused / allowed / min still verify.
for (const [from, sym, amt] of [
  ["bsc", "USDT", "100"], ["bsc", "USDC", "100"],
  ["ethereum", "USDT", "100"], ["ethereum", "USDC", "100"],
  ["ethereum", "WBTC", "1"],
]) {
  const q = await show(from, "infinite", sym, amt);
  const assert = (cond, msg) => { if (!cond) throw new Error(`inbound ${from} ${sym}: ${msg}`); };
  assert(q.kind === "bridgeRouter", "kind");
  assert(q.paused === false, "paused must be false");
  assert(q.allowed === true, "destination must be allowed");
  assert(q.nativeFallback === true, "quoteNative must fall back (nativeOptional)");
  assert(q.messagingFeeRaw === 0n, "messaging fee must be 0");
  assert(q.bridgeFeeRaw === 0n, "bridge fee must be 0 inbound");
  assert(q.receiveRaw != null && q.receiveRaw > 0n, "receive must be quoted");
}
// OSAK 42 Chain -> QL1: enabled with an unproven-route warning (user
// decision 2026-11-07). The router itself must still verify and quote
// like the other QL1-bound tokens (fee 0, messaging ~2.93 [42], 1:1).
{
  const q = await show("infinite", "ql1", "OSAK", "100");
  const assert = (cond, msg) => { if (!cond) throw new Error(`osak 42->ql1: ${msg}`); };
  assert(q.paused === false, "paused must be false");
  assert(q.allowed === true, "destination must be allowed");
  assert(q.bridgeFeeRaw === 0n, "bridge fee must be 0");
  assert(q.messagingFeeRaw != null && q.messagingFeeRaw > 0n, "messaging fee must be quoted");
  assert(q.receiveRaw === 100000000000000000000n, "receive must be 100 OSAK");
}
console.log("live smoke done");
