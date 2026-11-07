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
