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

console.log("unit tests OK");
