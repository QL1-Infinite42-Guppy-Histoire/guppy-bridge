// Fee logic — ISOLATED IN THIS ONE MODULE on purpose.
//
// Current model (shipped): standard Zaphod parity. All fee figures come
// from FRESH live quotes at display time and are re-quoted at send time:
//   - Bridge fee: BridgeRouter.quoteBridge(amount).fee
//       (flat 2.0 tokens for USDT/USDC on Infinite, 0 for everything else;
//        the flat fee is the BridgeRouter's on-chain feeFlat, set by its
//        owner on the Zaphod/MT side — a frontend cannot waive it.)
//   - Messaging fee: BridgeRouter.quoteNative(dstDomain, "0x").totalNative,
//       paid as msg.value in the source chain's native coin.
//       Measured 2026-11-07: USDT/USDC routes to BSC/Ethereum quote 0 [42];
//       QL1 routes and WBTC -> Ethereum quote ~2.932 [42].
//       EXCEPTION (nativeOptional): the BSC/Ethereum SOURCE routers are
//       older versions (1.1.0 / 1.2.0) whose quoteNative reverts. Like the
//       official frontend (and GuppyWallet v2, shipped 2026-10-31), the
//       messaging fee then falls back to 0 and the send uses value 0;
//       deliveries on those inbound routes are proven. See chain.js.
//   - QL1 source (no BridgeRouter): bridge fee 0, messaging fee 0
//       (warp router transferRemote with value 0; sampled on real sends).
//
// The fee-free direct-warp variant that briefly lived here (v0.2.0) was
// tested with a real send on 2026-11-07 and PROVEN IMPOSSIBLE — the
// Infinite warp routers accept transferRemote solely from their paired
// BridgeRouter (custom error 0x0c3dba28) — and removed in v0.3.0.
// An operator-funded reimbursement/sponsor scheme would still replace
// ONLY this module: the rest of the site consumes the normalized shape
// returned by getLiveQuote().
import {
  checkBridgeRouter, checkWarpRouter, scaleToDst,
} from "./chain.js";

export async function getLiveQuote(route, tokenEntry, amountRaw) {
  if (tokenEntry.src.bridgeRouter) {
    const c = await checkBridgeRouter(route, tokenEntry, amountRaw);
    return {
      ...c,
      feeModel: "zaphod-bridgerouter",
      // true when quoteNative reverted on an older BSC/Ethereum router and
      // the messaging fee fell back to 0 (nativeOptional behaviour).
      nativeFallback: !!c.nativeFallback,
      messagingFeeRaw: c.quoteNative ? c.quoteNative.totalNative : null,
      bridgeFeeRaw: c.quoteBridge ? c.quoteBridge.fee : null,
      receiveRaw: c.quoteBridge
        ? scaleToDst(c.quoteBridge.forward, tokenEntry.src.decimals, tokenEntry.dst.decimals)
        : null,
    };
  }
  const c = await checkWarpRouter(route, tokenEntry);
  return {
    ...c,
    feeModel: "ql1-warp-direct",
    messagingFeeRaw: 0n,
    bridgeFeeRaw: 0n,
    receiveRaw: amountRaw != null && amountRaw > 0n
      ? scaleToDst(amountRaw, tokenEntry.src.decimals, tokenEntry.dst.decimals)
      : null,
  };
}

// ---- send-time quote-drift gate (user-approved 2026-11-24) -------------------
// The confirmation panel shows a receive figure from the displayed quote.
// Before any approval or signing, doSend re-quotes and this gate decides
// whether the send may proceed against what the user actually reviewed.
//
// Comparison semantics: EXACT BigInt equality on the raw receive amount
// (destination scale), no tolerance. That is safe here because these are
// fixed-fee routes: quoteBridge(amount).forward is a pure function of the
// amount and the router's fee parameters (feeFlat), and both the displayed
// quote and the send-time quote call it with the SAME parsed amount (the
// context match below enforces that). So a difference can only mean the
// router's fee parameters changed after the user reviewed the quote —
// there is no legitimate drift to tolerate.
//
// `reviewed` is the snapshot taken when the displayed quote was committed:
//   { fromKey, toKey, tokenKey, amountRaw (string|null), receiveRaw (BigInt|null) }
// `current` is the send's own context: { fromKey, toKey, tokenKey, amountRaw (string) }.
// The recipient is deliberately NOT part of the context: the receive amount
// does not depend on it (flat/zero fee), and doSend re-reads and validates
// the recipient itself at send time.
//
// Returns one of:
//   { action: "proceed" }                          — reviewed figure still exact
//   { action: "changed", was, now }                — fee parameters moved; abort
//   { action: "review" }                           — no reviewed quote covers
//     exactly this send (inputs changed after the last displayed quote, or
//     its receive figure could not be read): the caller refreshes the panel
//     and asks the user to press send again — never send against a stale
//     or unread display.
// The caller guarantees freshReceiveRaw is a BigInt (doSend has already
// required a successful quoteBridge before reaching the gate).
export function driftGate(reviewed, current, freshReceiveRaw) {
  if (!reviewed ||
      reviewed.fromKey !== current.fromKey ||
      reviewed.toKey !== current.toKey ||
      reviewed.tokenKey !== current.tokenKey ||
      reviewed.amountRaw !== current.amountRaw ||
      reviewed.receiveRaw == null) {
    return { action: "review" };
  }
  if (freshReceiveRaw !== reviewed.receiveRaw) {
    return { action: "changed", was: reviewed.receiveRaw, now: freshReceiveRaw };
  }
  return { action: "proceed" };
}
