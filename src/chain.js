// Low-level chain helpers: raw JSON-RPC with endpoint rotation, ABI word
// encoding/decoding, amount math (BigInt only). No external dependencies —
// the same hand-rolled style as the DEX aggregator's proven bridge code.
import { STATE } from "./config.js";

export const CHAINS = STATE.chains;
export const ROUTES = STATE.routes;

export const SEL = {
  version: "0xffa1ad74", // VERSION()
  paused: "0x5c975abb", // paused()
  token: "0xfc0c546a", // token()
  allowedDestinations: "0xef78a402", // allowedDestinations(uint32)
  quoteNative: "0xe9e64e40", // quoteNative(uint32,bytes)
  quoteBridge: "0x15b2393a", // quoteBridge(uint256)
  minTransferAmount: "0x68841431",
  maxTransferAmount: "0xa9e75723",
  transferRemote: "0x81b4e8b4", // transferRemote(uint32,bytes32,uint256)
  mailboxFn: "0xd5438eae", // mailbox()
  delivered: "0xe495f1d4", // delivered(bytes32)
  balanceOf: "0x70a08231",
  allowance: "0xdd62ed3e",
  approve: "0x095ea7b3",
};

export const TOPIC_BRIDGE_INITIATED =
  "0x8f90f45f78e58a284c9aa2b93fed3647c4fed38904c460c2c07a6f5a26f2c1fd";
export const TOPIC_DISPATCH_ID =
  "0x788dbc1b7152732178210e7f4d9d010ef016f9eafbe66786bd7169f56e0c353a";

// ---- static route policy (evidence-based, 2026-11-07; see README) ----------
// OSAK Infinite -> QL1: zero transferRemote sends in the Infinite
// BridgeRouter's entire history — unproven direction, disabled (same rule
// as the DEX aggregator).
// BSC -> Infinite and Ethereum -> Infinite: the source BridgeRouters are
// older versions (1.1.0 / 1.2.0) whose quoteNative() reverts, so the
// messaging fee cannot be quoted before sending — disabled until that
// changes. All other checks on them passed (paused=false, token match,
// destination allowed, quoteBridge answers).
export function staticDisabled(route, tokenKey) {
  if (route.from === "infinite" && route.to === "ql1" && tokenKey === "OSAK")
    return "osak";
  if (route.from === "bsc" || route.from === "ethereum") return "bscEthSrc";
  return null;
}

export function routeFor(from, to) {
  return ROUTES.find((r) => r.from === from && r.to === to) || null;
}
export function tokenFor(route, key) {
  return route ? route.tokens.find((tk) => tk.key === key) || null : null;
}
// The contract a send actually calls + approves on the source chain.
// BridgeRouter chains: the BridgeRouter. QL1: the Hyperlane warp router.
export function sendTarget(tokenEntry) {
  return tokenEntry.src.bridgeRouter || tokenEntry.src.router;
}

// ---- encoding helpers --------------------------------------------------------
export function encUint(v) {
  return BigInt(v).toString(16).padStart(64, "0");
}
export function encAddr(a) {
  return a.toLowerCase().replace("0x", "").padStart(64, "0");
}
export function encodeRecipient32(address) {
  return "0x" + encAddr(address);
}
export function isAddress(s) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(s || "").trim());
}

// ---- amount helpers (BigInt only) --------------------------------------------
export function parseAmount(text, decimals) {
  const s = String(text == null ? "" : text).trim();
  if (!s || !/^\d*(\.\d*)?$/.test(s) || s === ".") throw new Error("format");
  const [ip, fpRaw = ""] = s.split(".");
  if (fpRaw.length > decimals) throw new Error("decimals");
  const fp = fpRaw.padEnd(decimals, "0");
  return BigInt(ip || "0") * 10n ** BigInt(decimals) + (fp ? BigInt(fp) : 0n);
}
export function formatAmount(raw, decimals, maxFrac = 6) {
  if (raw == null) return "—";
  const v = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const ip = v / base;
  let fp = (v % base).toString().padStart(decimals, "0");
  fp = fp.slice(0, maxFrac).replace(/0+$/, "");
  return fp ? `${ip}.${fp}` : `${ip}`;
}
export function percentOf(maxWei, pct) {
  return (BigInt(maxWei) * BigInt(pct)) / 100n;
}
// Convert a forwardAmount expressed in SOURCE-token raw units into
// DESTINATION-token raw units by decimal conversion. Verified against the
// routers' destinationScaleFactor: Infinite -> Ethereum USDT/USDC returns
// scaleFactor 1e12 = 10^(18-6), i.e. forward 98e18 (source scale) is
// delivered as 98e6 (destination scale) — exactly this conversion. Where a
// router reports scaleFactor 0 it means "no extra scaling", and decimal
// conversion still holds (e.g. Ethereum -> Infinite USDT: quoteBridge(100
// USDT = 100e6) forwards 100e6 source-scale = 100e18 destination-scale).
export function scaleToDst(forwardRaw, srcDecimals, dstDecimals) {
  const f = BigInt(forwardRaw);
  if (srcDecimals === dstDecimals) return f;
  if (dstDecimals > srcDecimals)
    return f * 10n ** BigInt(dstDecimals - srcDecimals);
  return f / 10n ** BigInt(srcDecimals - dstDecimals);
}

// ---- RPC (read-only, with rotation across the chain's public endpoints) -----
const rpcIdx = {};
export async function rpcCall(chainKey, method, params) {
  const c = CHAINS[chainKey];
  const urls = [...new Set([c.rpc, ...(c.walletRpcUrls || [])])];
  let lastErr = null;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[(rpcIdx[chainKey] || 0) % urls.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || "rpc error");
      rpcIdx[chainKey] = urls.indexOf(url);
      return j.result;
    } catch (e) {
      lastErr = e;
      rpcIdx[chainKey] = ((rpcIdx[chainKey] || 0) + 1) % urls.length;
    }
  }
  throw lastErr || new Error("rpc failed");
}
export async function ethCall(chainKey, to, data) {
  return rpcCall(chainKey, "eth_call", [{ to, data }, "latest"]);
}
export async function getCode(chainKey, addr) {
  return rpcCall(chainKey, "eth_getCode", [addr, "latest"]);
}
export function decUint(hex) {
  if (!hex || hex === "0x") return null;
  return BigInt(hex);
}
export function decBool(hex) {
  const v = decUint(hex);
  return v === null ? null : v === 1n;
}
export function decAddr(hex) {
  if (!hex || hex.length < 66) return null;
  return "0x" + hex.slice(-40);
}
export function words(hex) {
  if (!hex || hex === "0x") return [];
  return (hex.slice(2).match(/.{64}/g) || []).map((x) => BigInt("0x" + x));
}

// ---- contract reads -----------------------------------------------------------
export async function readTokenBalance(chainKey, tokenAddr, account) {
  const hex = await ethCall(chainKey, tokenAddr, SEL.balanceOf + encAddr(account));
  return decUint(hex) ?? 0n;
}
export async function readNativeBalance(chainKey, account) {
  const hex = await rpcCall(chainKey, "eth_getBalance", [account, "latest"]);
  return BigInt(hex);
}
export async function readAllowance(chainKey, tokenAddr, owner, spender) {
  const hex = await ethCall(
    chainKey, tokenAddr, SEL.allowance + encAddr(owner) + encAddr(spender)
  );
  return decUint(hex) ?? 0n;
}
// Full live check + quote for a BridgeRouter route. Returns null fields on
// failure rather than throwing for each individual call, so the UI can say
// exactly what failed.
export async function checkBridgeRouter(route, tokenEntry, amountRaw) {
  const br = tokenEntry.src.bridgeRouter;
  const dst = CHAINS[route.to];
  const out = { kind: "bridgeRouter", target: br };
  const call = async (data) => ethCall(route.from, br, data);
  try { out.version = await call(SEL.version).then((h) => decodeString(h)); }
  catch (e) { out.version = null; }
  try { out.paused = decBool(await call(SEL.paused)); } catch (e) { out.paused = null; }
  try { out.token = decAddr(await call(SEL.token)); } catch (e) { out.token = null; }
  try {
    out.allowed = decBool(await call(SEL.allowedDestinations + encUint(dst.domain)));
  } catch (e) { out.allowed = null; }
  try { out.min = decUint(await call(SEL.minTransferAmount)); } catch (e) { out.min = null; }
  try { out.max = decUint(await call(SEL.maxTransferAmount)); } catch (e) { out.max = null; }
  try {
    // quoteNative(dstDomain, "0x"): data = selector + uint + offset(64) + len(0)
    const h = await call(SEL.quoteNative + encUint(dst.domain) + encUint(64) + encUint(0));
    const w = words(h);
    out.quoteNative = w.length >= 3
      ? { nativeFee: w[0], gasPayment: w[1], totalNative: w[2] }
      : null;
  } catch (e) { out.quoteNative = null; }
  if (amountRaw != null && amountRaw > 0n) {
    try {
      const h = await call(SEL.quoteBridge + encUint(amountRaw));
      const w = words(h);
      out.quoteBridge = w.length >= 3
        ? { forward: w[0], fee: w[1], totalRequired: w[2] }
        : null;
    } catch (e) { out.quoteBridge = null; }
  }
  return out;
}
export function decodeString(hex) {
  if (!hex || hex === "0x") return null;
  try {
    const w = words(hex);
    if (w.length < 2) return null;
    const len = Number(w[1]);
    const bytesHex = hex.slice(2 + 128, 2 + 128 + len * 2);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(bytesHex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  } catch (e) { return null; }
}
// NOTE (2026-11-07): a direct-warp route on Infinite (calling a token's
// Hyperlane warp router directly, bypassing its BridgeRouter) was tested
// with a real 0.1 USDT send and PROVEN IMPOSSIBLE: the Infinite warp
// routers revert every transferRemote that does not come from their
// paired BridgeRouter (custom error 0x0c3dba28(caller)). The experimental
// route that used this was removed in v0.3.0 — see README. QL1 sends are
// unaffected: QL1 has no BridgeRouter and its warps accept direct calls
// (proven on sampled real sends).

// QL1 warp router structural check: code exists + mailbox() == QL1 mailbox.
export async function checkWarpRouter(route, tokenEntry) {
  const router = tokenEntry.src.router;
  const out = { kind: "warp", target: router };
  try {
    const code = await getCode(route.from, router);
    out.codeBytes = code && code !== "0x" ? (code.length - 2) / 2 : 0;
  } catch (e) { out.codeBytes = null; }
  try { out.mailbox = decAddr(await ethCall(route.from, router, SEL.mailboxFn)); }
  catch (e) { out.mailbox = null; }
  return out;
}
export async function fetchDelivered(dstChainKey, messageId) {
  const mailbox = CHAINS[dstChainKey].mailbox;
  const hex = await ethCall(dstChainKey, mailbox, SEL.delivered + messageId.replace("0x", ""));
  return decBool(hex);
}
export function extractMessageId(receipt) {
  if (!receipt || !Array.isArray(receipt.logs)) return null;
  for (const l of receipt.logs) {
    const t0 = (l.topics && l.topics[0] || "").toLowerCase();
    if ((t0 === TOPIC_BRIDGE_INITIATED || t0 === TOPIC_DISPATCH_ID) && l.topics.length > 1)
      return l.topics[1].toLowerCase();
  }
  return null;
}
export function explorerTx(chainKey, hash) {
  return CHAINS[chainKey].scan.replace(/\/$/, "") + "/tx/" + hash;
}
export function explorerAddr(chainKey, addr) {
  return CHAINS[chainKey].scan.replace(/\/$/, "") + "/address/" + addr;
}
