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
//   - QL1 source (no BridgeRouter): bridge fee 0, messaging fee 0
//       (warp router transferRemote with value 0; sampled on real sends).
//
// A future fee-free variant (direct-warp route, or an operator-funded
// reimbursement/sponsor scheme) would replace ONLY this module: the rest
// of the site consumes the normalized shape returned by getLiveQuote().
import { checkBridgeRouter, checkWarpRouter, scaleToDst } from "./chain.js";

export async function getLiveQuote(route, tokenEntry, amountRaw) {
  if (tokenEntry.src.bridgeRouter) {
    const c = await checkBridgeRouter(route, tokenEntry, amountRaw);
    return {
      ...c,
      feeModel: "zaphod-bridgerouter",
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
    receiveRaw: amountRaw != null && amountRaw > 0n ? amountRaw : null,
  };
}
