// Unit tests for the pure helpers in src/chain.js (no network).
import assert from "node:assert";
import {
  parseAmount, formatAmount, percentOf, scaleToDst,
  encodeRecipient32, isAddress, extractMessageId, staticDisabled, routeWarning, nativeOptional, routeFor,
  TOPIC_BRIDGE_INITIATED, TOPIC_DISPATCH_ID,
} from "../src/chain.js";

// parse / format
assert.equal(parseAmount("1.5", 18), 1500000000000000000n);
assert.equal(parseAmount("100", 6), 100000000n);
assert.equal(parseAmount("0.0008", 8), 80000n);
assert.throws(() => parseAmount("1.1234567", 6), /decimals/);
assert.throws(() => parseAmount("abc", 18), /format/);
// audit 2026-11-24: hostile / sloppy amount inputs must never parse
assert.throws(() => parseAmount("1e5", 18), /format/); // exponent notation
assert.throws(() => parseAmount("1,000", 18), /format/); // comma separator
assert.throws(() => parseAmount("１２３", 18), /format/); // full-width digits
assert.throws(() => parseAmount("-5", 18), /format/); // negative
assert.throws(() => parseAmount("1 0", 18), /format/); // inner space
assert.throws(() => parseAmount(".", 18), /format/);
assert.equal(parseAmount(" 1.5 ", 18), 1500000000000000000n); // outer spaces trimmed
assert.equal(parseAmount(".5", 18), 500000000000000000n);
assert.equal(parseAmount("1.", 18), 1000000000000000000n);
assert.equal(parseAmount("0", 18), 0n); // parses; >0 enforced by UI/send path
assert.equal(parseAmount("9".repeat(40), 18), BigInt("9".repeat(40)) * 10n ** 18n); // no overflow
// the zero address is a syntactically valid address — it is blocked
// separately in the UI/send path (errRecipientZero), not here
assert.ok(isAddress("0x0000000000000000000000000000000000000000"));
assert.equal(formatAmount(1500000000000000000n, 18), "1.5");
assert.equal(formatAmount(98000000n, 6), "98");
assert.equal(percentOf(1000n, 25), 250n);

// decimal scaling for receive amounts (verified against destinationScaleFactor)
assert.equal(scaleToDst(98000000000000000000n, 18, 6), 98000000n); // Inf -> ETH USDT: 98 in 18-dec scale -> 98 in 6-dec scale
assert.equal(scaleToDst(100000000n, 6, 18), 100000000000000000000n); // ETH -> Inf USDT
assert.equal(scaleToDst(100000000n, 8, 8), 100000000n); // WBTC 8 -> 8
assert.equal(scaleToDst(5n, 18, 18), 5n);

// recipient encoding
assert.equal(
  encodeRecipient32("0x1111111111111111111111111111111111111111"),
  "0x0000000000000000000000001111111111111111111111111111111111111111"
);
assert.ok(isAddress("0x1111111111111111111111111111111111111111"));
assert.ok(!isAddress("0x123"));

// messageId extraction from both known topics
const mid = "0x" + "ab".repeat(32);
assert.equal(extractMessageId({ logs: [{ topics: [TOPIC_BRIDGE_INITIATED, mid] }] }), mid);
assert.equal(extractMessageId({ logs: [{ topics: [TOPIC_DISPATCH_ID, mid] }] }), mid);
assert.equal(extractMessageId({ logs: [{ topics: ["0xdeadbeef", mid] }] }), null);
assert.equal(extractMessageId(null), null);

// static route policy
const infQl1 = routeFor("infinite", "ql1");
const ql1Inf = routeFor("ql1", "infinite");
const bscInf = routeFor("bsc", "infinite");
const ethInf = routeFor("ethereum", "infinite");
const infBsc = routeFor("infinite", "bsc");
// OSAK 42 Chain -> QL1 is ENABLED (user decision 2026-11-07, full Zaphod
// parity on the bridge site) with an unproven-route warning instead of a
// disable. Nothing is statically disabled anymore.
assert.equal(staticDisabled(infQl1, "OSAK"), null);
assert.equal(staticDisabled(infQl1, "QOM"), null);
assert.equal(staticDisabled(ql1Inf, "OSAK"), null);
assert.equal(routeWarning(infQl1, "OSAK"), "osak");
assert.equal(routeWarning(infQl1, "QOM"), null);
assert.equal(routeWarning(ql1Inf, "OSAK"), null);
assert.equal(routeWarning(bscInf, "USDT"), null);
// Inbound BSC/ETH -> 42 Chain is ENABLED (2026-11-07 correction): the older
// source routers revert quoteNative, which the official frontend treats as
// "messaging fee 0" (nativeOptional) — it is not a disabling condition.
assert.equal(staticDisabled(bscInf, "USDT"), null);
assert.equal(staticDisabled(bscInf, "USDC"), null);
assert.equal(staticDisabled(ethInf, "USDT"), null);
assert.equal(staticDisabled(ethInf, "USDC"), null);
assert.equal(staticDisabled(ethInf, "WBTC"), null);
assert.equal(staticDisabled(infBsc, "USDT"), null);

// nativeOptional applies exactly to routes whose SOURCE chain is BSC/ETH
assert.equal(nativeOptional(bscInf), true);
assert.equal(nativeOptional(ethInf), true);
assert.equal(nativeOptional(infBsc), false);
assert.equal(nativeOptional(infQl1), false);
assert.equal(nativeOptional(ql1Inf), false);
assert.equal(nativeOptional(null), false);

// route table shape mirrors /api/state: 6 directional routes, 26 token entries
const { ROUTES } = await import("../src/chain.js");
assert.equal(ROUTES.length, 6);
assert.equal(ROUTES.reduce((s, r) => s + r.tokens.length, 0), 26);

// send-time quote-drift gate (user-approved 2026-11-24): the fresh
// send-time receive must EXACTLY equal the reviewed receive for the same
// route/token/amount, or the send aborts before approval/signing.
const { driftGate } = await import("../src/fees.js");
const ctx = { fromKey: "infinite", toKey: "bsc", tokenKey: "USDT", amountRaw: "100000000" };
const reviewed = { ...ctx, receiveRaw: 98000000n }; // 100 USDT - flat 2.0 fee, 6-dec scale
// equal -> proceed
assert.deepEqual(driftGate(reviewed, ctx, 98000000n), { action: "proceed" });
// changed receive (fee parameters moved) -> abort, carrying was/now
assert.deepEqual(driftGate(reviewed, ctx, 97000000n),
  { action: "changed", was: 98000000n, now: 97000000n });
// even a 1-unit difference aborts: exact equality, no tolerance
assert.equal(driftGate(reviewed, ctx, 98000001n).action, "changed");
// no reviewed quote at all -> review (refresh + press send again)
assert.deepEqual(driftGate(null, ctx, 98000000n), { action: "review" });
// reviewed quote was for a different amount (user edited after the quote)
assert.equal(driftGate(reviewed, { ...ctx, amountRaw: "50000000" }, 98000000n).action, "review");
// different token / route -> review
assert.equal(driftGate(reviewed, { ...ctx, tokenKey: "USDC" }, 98000000n).action, "review");
assert.equal(driftGate(reviewed, { ...ctx, toKey: "ethereum" }, 98000000n).action, "review");
assert.equal(driftGate(reviewed, { ...ctx, fromKey: "bsc" }, 98000000n).action, "review");
// reviewed quote had no receive figure (quoteBridge unavailable then)
assert.equal(driftGate({ ...ctx, receiveRaw: null }, ctx, 98000000n).action, "review");
// reviewed quote had no amount (empty/invalid input at quote time)
assert.equal(driftGate({ ...ctx, amountRaw: null, receiveRaw: null }, ctx, 98000000n).action, "review");
// zero-fee route: receive == amount scaled; equality still exact
const qomCtx = { fromKey: "infinite", toKey: "ql1", tokenKey: "QOM", amountRaw: "1000000000000000000" };
assert.deepEqual(driftGate({ ...qomCtx, receiveRaw: 1000000000000000000n }, qomCtx, 1000000000000000000n),
  { action: "proceed" });

// Guard (2026-11-25, user order): the erased wallet name must never creep
// back into any site-facing copy or the built bundle. Scans the page
// sources, the string table, the app entry, and the built docs output.
{
  const { readFileSync, existsSync } = await import("node:fs");
  const banned = /guppy\s*wallet|グッピーウォレット/i;
  const files = [
    "en.html", "ja.html", "index.html",
    "src/i18n.js", "src/main.js",
    "docs/en.html", "docs/ja.html", "docs/index.html", "docs/app.js",
  ];
  for (const f of files) {
    if (!existsSync(f)) continue; // docs/ absent on a fresh checkout pre-build
    assert.ok(!banned.test(readFileSync(f, "utf8")), `banned wallet name found in ${f}`);
  }
}

console.log("unit tests OK");
