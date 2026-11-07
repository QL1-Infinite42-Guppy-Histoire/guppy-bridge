// Live smoke test: run the site's own quote code against real RPCs.
import { routeFor, tokenFor, formatAmount, parseAmount } from "../src/chain.js";
import { getLiveQuote } from "../src/fees.js";

async function show(from, to, sym, amountText) {
  const route = routeFor(from, to);
  const tk = tokenFor(route, sym);
  const amount = parseAmount(amountText, tk.src.decimals);
  const q = await getLiveQuote(route, tk, amount);
  console.log(`${from}->${to} ${sym} ${amountText}: kind=${q.kind} version=${q.version ?? "-"} paused=${q.paused ?? "-"} allowed=${q.allowed ?? "-"} min=${q.min != null ? formatAmount(q.min, tk.src.decimals) : "-"} bridgeFee=${q.bridgeFeeRaw != null ? formatAmount(q.bridgeFeeRaw, tk.src.decimals) : "-"} messagingFee=${q.messagingFeeRaw != null ? formatAmount(q.messagingFeeRaw, 18) : "-"} receive=${q.receiveRaw != null ? formatAmount(q.receiveRaw, tk.dst.decimals) : "-"} mailbox=${q.mailbox ?? "-"} code=${q.codeBytes ?? "-"}`);
}
await show("infinite", "ql1", "QOM", "100");
await show("infinite", "ethereum", "USDT", "100");
await show("infinite", "ethereum", "WBTC", "1");
await show("infinite", "bsc", "USDC", "100");
await show("ql1", "infinite", "QOM", "1000");
await show("bsc", "infinite", "USDT", "100");
// experimental direct-warp quotes (42 -> BSC/ETH)
async function showExp(to, sym, amountText) {
  const route = routeFor("infinite", to);
  const tk = tokenFor(route, sym);
  const amount = parseAmount(amountText, tk.src.decimals);
  const q = await getLiveQuote(route, tk, amount, "experimental");
  console.log(`EXP infinite->${to} ${sym} ${amountText}: kind=${q.kind} code=${q.codeBytes} mailbox=${q.mailbox} hook=${q.hook} gasPayment=${q.gasPayment} bridgeFee=${q.bridgeFeeRaw} receive=${q.receiveRaw != null ? formatAmount(q.receiveRaw, tk.dst.decimals) : "-"}`);
}
await showExp("bsc", "USDT", "100");
await showExp("ethereum", "USDT", "100");
await showExp("ethereum", "WBTC", "1");
console.log("live smoke done");
