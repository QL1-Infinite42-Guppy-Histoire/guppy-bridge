// Guppy Bridge — a dedicated bridge frontend with the same routes as
// bridge.zaphod.one (config mirrored from its /api/state; see config.js).
// Send flow (verified patterns, same as the DEX aggregator's bridge code):
//   BridgeRouter chains (Infinite / BSC / Ethereum):
//     approve token -> BridgeRouter, then transferRemote payable with
//     value = quoteNative(dst, "0x").totalNative re-quoted at send time.
//   QL1 (no BridgeRouter): approve token -> Hyperlane warp router, then
//     transferRemote with value 0 (every sampled QL1 send paid 0).
// Routes that failed live verification are disabled in chain.js
// (staticDisabled) and again dynamically if a live check fails.
import {
  CHAINS, SEL, routeFor, tokenFor, sendTarget, staticDisabled,
  encUint, encAddr, isAddress, parseAmount, formatAmount, percentOf,
  scaleToDst, readTokenBalance, readNativeBalance, readAllowance,
  fetchDelivered, extractMessageId,
  explorerTx, rpcCall,
} from "./chain.js";
import { getLiveQuote } from "./fees.js";
import { t, LANG } from "./i18n.js";

const DISPLAY = {
  infinite: "42 Chain",
  ql1: "QL1",
  bsc: "BNB Smart Chain (BSC)",
  ethereum: "Ethereum",
};
const $ = (id) => document.getElementById(id);
const state = {
  account: null,
  fromKey: "infinite",
  toKey: "ql1",
  tokenKey: "QOM",
  tokenBal: null,
  nativeBal: null,
  check: null, // last live check result
  quoteFor: null, // amount string the quote belongs to
  sending: false,
  watch: null,
  watchTimer: null,
  elapsedTimer: null,
};

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}
function setStatus(msg, isErr) {
  const el = $("sendStatus");
  el.textContent = msg || "";
  el.className = "status" + (isErr ? " err" : "");
}

/* ---------- selects ---------- */
function fillChainSelects() {
  const fromSel = $("fromSel"), toSel = $("toSel");
  fromSel.innerHTML = "";
  for (const k of Object.keys(CHAINS)) {
    const o = document.createElement("option");
    o.value = k; o.textContent = DISPLAY[k];
    fromSel.appendChild(o);
  }
  fromSel.value = state.fromKey;
  fillToOptions();
}
function fillToOptions() {
  const toSel = $("toSel");
  const tos = [...new Set(
    // all destinations reachable from state.fromKey
    ["infinite", "ql1", "bsc", "ethereum"].filter((k) => routeFor(state.fromKey, k))
  )];
  toSel.innerHTML = "";
  for (const k of tos) {
    const o = document.createElement("option");
    o.value = k; o.textContent = DISPLAY[k];
    toSel.appendChild(o);
  }
  if (!tos.includes(state.toKey)) state.toKey = tos[0];
  toSel.value = state.toKey;
  fillTokenOptions();
}
function currentRoute() { return routeFor(state.fromKey, state.toKey); }
function currentToken() { return tokenFor(currentRoute(), state.tokenKey); }
// The contract a send actually calls / approves.
function currentTarget(tk) {
  return sendTarget(tk);
}
function fillTokenOptions() {
  const sel = $("tokenSel");
  const route = currentRoute();
  sel.innerHTML = "";
  for (const tk of route ? route.tokens : []) {
    const o = document.createElement("option");
    o.value = tk.key; o.textContent = tk.key;
    if (staticDisabled(route, tk.key)) o.textContent += LANG === "ja" ? "（無効）" : " (disabled)";
    sel.appendChild(o);
  }
  if (!route || !tokenFor(route, state.tokenKey)) state.tokenKey = route?.tokens[0]?.key;
  sel.value = state.tokenKey;
  updateRouteNote();
}
function updateRouteNote() {
  const route = currentRoute();
  const dis = route ? staticDisabled(route, state.tokenKey) : null;
  const note = $("routeNote");
  if (dis === "osak") { note.textContent = t("osakNote"); note.classList.remove("hidden"); }
  else if (dis === "bscEthSrc") { note.textContent = t("bscEthSrcNote"); note.classList.remove("hidden"); }
  else if (route && route.from === "ql1") { note.textContent = t("ql1Note"); note.classList.remove("hidden"); }
  else if (route && route.from === "infinite" && (route.to === "bsc" || route.to === "ethereum")) {
    note.textContent = t("expClosedNote"); note.classList.remove("hidden");
  }
  else { note.textContent = ""; note.classList.add("hidden"); }
  const tk = currentToken();
  const d = $("detailsRouterLine");
  if (tk) {
    d.textContent =
      (tk.src.bridgeRouter ? t("detailsRouter") : t("detailsWarp")) +
      `: ${currentTarget(tk)} · ${DISPLAY[state.fromKey]} → ${DISPLAY[state.toKey]} · ${tk.key}` +
      ` · token ${tk.src.erc20}`;
  } else d.textContent = "";
}

/* ---------- wallet ---------- */
function hasWallet() { return typeof window !== "undefined" && !!window.ethereum; }
function renderAccount() {
  const box = $("accountBox");
  box.innerHTML = "";
  if (!hasWallet()) { $("walletMissing").classList.remove("hidden"); return; }
  $("walletMissing").classList.add("hidden");
  if (state.account) {
    const s = document.createElement("span");
    s.className = "addr";
    s.textContent = t("connectedAs") + shortAddr(state.account);
    box.appendChild(s);
  } else {
    const b = document.createElement("button");
    b.className = "primary";
    b.textContent = t("connectBtn");
    b.onclick = connect;
    box.appendChild(b);
  }
}
async function connect() {
  if (!hasWallet()) return;
  try {
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accs && accs[0]) {
      state.account = accs[0];
      const rec = $("recipientInput");
      if (!rec.value) rec.value = state.account;
      renderAccount();
      refreshQuote();
    }
  } catch (e) {
    setStatus(t("connectFailed") + (e.message || e), true);
  }
}
async function ensureChain(chainKey) {
  const c = CHAINS[chainKey];
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: c.hex }],
    });
  } catch (e) {
    if (e && (e.code === 4902 || /Unrecognized chain|not added/i.test(e.message || ""))) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: c.hex,
          chainName: DISPLAY[chainKey],
          rpcUrls: c.walletRpcUrls,
          nativeCurrency: { name: c.native.symbol, symbol: c.native.symbol, decimals: c.native.decimals },
          blockExplorerUrls: [c.scan],
        }],
      });
    } else throw e;
  }
}
async function walletSend(tx) {
  return window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
}
async function waitReceipt(hash) {
  for (let i = 0; i < 60; i++) {
    const rc = await window.ethereum.request({
      method: "eth_getTransactionReceipt", params: [hash],
    });
    if (rc) return rc;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

/* ---------- quote ---------- */
let quoteSeq = 0;
async function refreshQuote() {
  const seq = ++quoteSeq;
  const route = currentRoute(), tk = currentToken();
  if (!route || !tk) return;
  updateRouteNote();
  // balances
  if (state.account) {
    try {
      state.tokenBal = await readTokenBalance(state.fromKey, tk.src.erc20, state.account);
      state.nativeBal = await readNativeBalance(state.fromKey, state.account);
    } catch (e) { state.tokenBal = null; state.nativeBal = null; }
  }
  $("balLine").textContent = state.tokenBal != null
    ? t("balance") + formatAmount(state.tokenBal, tk.src.decimals) + " " + tk.key : "";
  $("nativeLine").textContent = state.nativeBal != null
    ? t("nativeBalance") + formatAmount(state.nativeBal, 18) + " " + CHAINS[state.fromKey].native.symbol : "";
  // amount
  let amount = null, amountErr = null;
  const rawText = $("amountInput").value;
  if (rawText.trim()) {
    try { amount = parseAmount(rawText, tk.src.decimals); }
    catch (e) { amountErr = e.message === "decimals" ? t("errAmountDecimals", tk.src.decimals) : t("errAmountFormat"); }
  }
  $("qSend").textContent = amount != null ? formatAmount(amount, tk.src.decimals) + " " + tk.key : "—";
  $("qRecipient").textContent = $("recipientInput").value.trim() || "—";
  $("qRouter").textContent = shortAddr(currentTarget(tk));
  // live check
  $("qRouteState").textContent = t("routeChecking");
  let check = null;
  try {
    check = await getLiveQuote(route, tk, amount);
  } catch (e) { check = null; }
  if (seq !== quoteSeq) return;
  state.check = check;
  state.quoteFor = rawText;
  renderQuote(route, tk, amount, amountErr, check);
}
function renderQuote(route, tk, amount, amountErr, check) {
  const dis = staticDisabled(route, state.tokenKey);
  const sendBtn = $("sendBtn");
  let problem = null;
  if (amountErr) problem = amountErr;
  if (check && check.kind === "bridgeRouter") {
    $("qMin").textContent = check.min != null ? formatAmount(check.min, tk.src.decimals) + " " + tk.key : "—";
    $("qMax").textContent = check.max != null && check.max < (1n << 200n)
      ? formatAmount(check.max, tk.src.decimals) + " " + tk.key : "∞";
    if (check.paused === true) problem = problem || t("routePaused");
    else if (check.paused === null || check.allowed !== true) problem = problem || t("routeNotAllowed");
    else if (!check.quoteNative) problem = problem || t("routeQuoteFailed");
    if (check.quoteNative) {
      $("qNativeFee").textContent =
        formatAmount(check.quoteNative.totalNative, 18) + " " + CHAINS[state.fromKey].native.symbol +
        (check.quoteNative.totalNative === 0n ? " (" + t("zeroNativeNote") + ")" : "");
    } else $("qNativeFee").textContent = "—";
    if (check.quoteBridge && amount != null) {
      $("qBridgeFee").textContent = formatAmount(check.quoteBridge.fee, tk.src.decimals) + " " + tk.key;
      $("qReceive").textContent =
        formatAmount(check.receiveRaw ?? scaleToDst(check.quoteBridge.forward, tk.src.decimals, tk.dst.decimals), tk.dst.decimals) +
        " " + tk.key;
    } else {
      $("qBridgeFee").textContent = "—";
      $("qReceive").textContent = "—";
    }
    if (amount != null && check.min != null && amount < check.min)
      problem = problem || t("errBelowMin", formatAmount(check.min, tk.src.decimals), tk.key);
    if (amount != null && check.max != null && check.max < (1n << 200n) && amount > check.max)
      problem = problem || t("errAboveMax");
  } else if (check && check.kind === "warp") {
    $("qMin").textContent = "—";
    $("qMax").textContent = "—";
    $("qNativeFee").textContent = "0 " + CHAINS[state.fromKey].native.symbol;
    $("qBridgeFee").textContent = "0 " + tk.key;
    $("qReceive").textContent = amount != null ? formatAmount(amount, tk.dst.decimals) + " " + tk.key : "—";
    if (!(check.codeBytes > 0) || !check.mailbox ||
        check.mailbox.toLowerCase() !== CHAINS.ql1.mailbox.toLowerCase())
      problem = problem || t("routeQuoteFailed");
  } else {
    problem = problem || t("routeQuoteFailed");
    $("qNativeFee").textContent = "—"; $("qBridgeFee").textContent = "—"; $("qReceive").textContent = "—";
  }
  if (amount != null && state.tokenBal != null && amount > state.tokenBal)
    problem = problem || t("errOverBalance");
  if (amount != null && amount === 0n) problem = problem || t("errAmountPositive");
  // native fee + gas coverage warning (BridgeRouter routes with a fee)
  let nativeWarn = "";
  if (check && check.kind === "bridgeRouter" && check.quoteNative && state.nativeBal != null) {
    if (state.nativeBal <= check.quoteNative.totalNative) nativeWarn = t("errNativeLow");
  }
  $("qRouteState").textContent = problem && !dis ? problem :
    (dis ? "—" : t("routeOk"));
  $("validLine").textContent = dis ? "" : (nativeWarn || problem || "");
  $("validLine").className = "status" + ((nativeWarn || problem) ? " err" : "");
  const canSend = !!state.account && !state.sending && !dis && !problem && amount != null && amount > 0n && !nativeWarn;
  sendBtn.disabled = !canSend;
}

/* ---------- send ---------- */
async function doSend() {
  const route = currentRoute(), tk = currentToken();
  if (!route || !tk || !state.account || state.sending) return;
  const recipient = $("recipientInput").value.trim();
  if (!isAddress(recipient)) { setStatus(t("errRecipient"), true); return; }
  let amount;
  try { amount = parseAmount($("amountInput").value, tk.src.decimals); }
  catch (e) { setStatus(t("errAmountFormat"), true); return; }
  state.sending = true;
  $("sendBtn").disabled = true;
  try {
    await ensureChain(state.fromKey);
    // fresh re-quote at send time (never reuse a stale messaging fee)
    let totalNative = 0n;
    if (tk.src.bridgeRouter) {
      const fresh = await getLiveQuote(route, tk, amount);
      if (!fresh.quoteNative || fresh.paused || fresh.allowed !== true)
        throw new Error(t("routeQuoteFailed"));
      if (fresh.min != null && amount < fresh.min)
        throw new Error(t("errBelowMin", formatAmount(fresh.min, tk.src.decimals), tk.key));
      totalNative = fresh.quoteNative.totalNative;
    }
    // recipient destination balance before the send (secondary arrival signal)
    let dstBalBefore = null;
    try { dstBalBefore = await readTokenBalance(state.toKey, tk.dst.erc20, recipient); }
    catch (e) { /* optional */ }
    const target = currentTarget(tk);
    // approve only if allowance is not enough; exact amount
    const allowance = await readAllowance(state.fromKey, tk.src.erc20, state.account, target);
    if (allowance < amount) {
      setStatus(t("approveStep"));
      const ah = await walletSend({
        from: state.account, to: tk.src.erc20,
        data: SEL.approve + encAddr(target) + encUint(amount),
        value: "0x0",
      });
      const arc = await waitReceipt(ah);
      if (arc && arc.status === "0x0") throw new Error(t("errFailed") + ah);
    }
    setStatus(t("sendStep"));
    const data = SEL.transferRemote + encUint(CHAINS[state.toKey].domain) + encAddr(recipient) + encUint(amount);
    const hash = await walletSend({
      from: state.account, to: target, data,
      value: "0x" + totalNative.toString(16),
    });
    setStatus(t("waitingTx"));
    const rc = await waitReceipt(hash);
    if (rc && rc.status === "0x0") throw new Error(t("errFailed") + hash);
    const messageId = extractMessageId(rc);
    const watch = {
      txHash: hash, messageId,
      routeType: tk.src.bridgeRouter ? "standard-bridgerouter" : "standard-ql1-warp",
      fromKey: state.fromKey, toKey: state.toKey, tokenKey: state.tokenKey,
      amountRaw: amount.toString(), recipient,
      dstErc20: tk.dst.erc20, dstDecimals: tk.dst.decimals,
      dstBalBefore: dstBalBefore != null ? dstBalBefore.toString() : null,
      startedAt: Date.now(), delivered: false,
    };
    saveWatch(watch);
    startWatch(watch);
    setStatus(t("sentOk"));
  } catch (e) {
    const msg = (e && (e.code === 4001 || /rejected|denied/i.test(e.message || "")))
      ? t("errCancelled") : t("errFailed") + ((e && e.message) || e);
    setStatus(msg, true);
  } finally {
    state.sending = false;
    refreshQuote();
  }
}

/* ---------- arrival watch ---------- */
const WATCH_KEY = "guppybridge_watch_v1";
function saveWatch(w) {
  state.watch = w;
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(w)); } catch (e) { /* ignore */ }
}
function loadWatch() {
  try {
    const w = JSON.parse(localStorage.getItem(WATCH_KEY) || "null");
    return w && w.txHash ? w : null;
  } catch (e) { return null; }
}
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function renderWatch(w, delivered, dstBal) {
  const panel = $("watchPanel");
  panel.classList.remove("hidden");
  const lines = [];
  lines.push(`<div class="kv"><span>${t("watchTx")}</span><b><a href="${explorerTx(w.fromKey, w.txHash)}" target="_blank" rel="noreferrer">${w.txHash.slice(0, 10)}…</a></b></div>`);
  if (w.messageId) lines.push(`<div class="kv"><span>${t("watchMsg")}</span><b class="addr">${w.messageId.slice(0, 18)}…</b></div>`);
  lines.push(`<div class="kv"><span>${w.tokenKey} ${DISPLAY[w.fromKey]} → ${DISPLAY[w.toKey]}</span><b>${formatAmount(BigInt(w.amountRaw), w.dstDecimals)} ${w.tokenKey}</b></div>`);
  if (dstBal != null)
    lines.push(`<div class="kv"><span>${t("watchBalance")}</span><b>${formatAmount(dstBal, w.dstDecimals)} ${w.tokenKey}</b></div>`);
  lines.push(delivered
    ? `<p class="status">${t("watchDelivered")}</p>`
    : `<p class="status">${t("watchWaiting")}<span class="watchElapsed">${fmtElapsed(Date.now() - w.startedAt)}</span></p>`);
  $("watchBody").innerHTML = lines.join("");
}
function startWatch(w) {
  saveWatch(w);
  renderWatch(w, !!w.delivered, null);
  if (state.watchTimer) clearInterval(state.watchTimer);
  if (state.elapsedTimer) clearInterval(state.elapsedTimer);
  if (w.delivered) return;
  state.elapsedTimer = setInterval(() => {
    const el = document.querySelector(".watchElapsed");
    if (el && state.watch) el.textContent = fmtElapsed(Date.now() - state.watch.startedAt);
  }, 1000);
  const poll = async () => {
    const cur = state.watch;
    if (!cur || cur.delivered) return;
    let delivered = null, dstBal = null;
    if (cur.messageId) {
      try { delivered = await fetchDelivered(cur.toKey, cur.messageId); } catch (e) { /* retry next tick */ }
    }
    try { dstBal = await readTokenBalance(cur.toKey, cur.dstErc20, cur.recipient); } catch (e) { /* optional */ }
    if (delivered === true) {
      cur.delivered = true;
      saveWatch(cur);
      renderWatch(cur, true, dstBal);
      clearInterval(state.watchTimer);
      clearInterval(state.elapsedTimer);
      return;
    }
    renderWatch(cur, false, dstBal);
  };
  poll();
  state.watchTimer = setInterval(poll, 20000);
}

/* ---------- wiring ---------- */
function init() {
  const langSel = $("langSel");
  if (langSel) {
    langSel.value = LANG;
    langSel.addEventListener("change", () => {
      try { localStorage.setItem("guppybridge_lang", langSel.value); } catch (e) { /* ignore */ }
      location.href = (langSel.value === "ja" ? "ja.html" : "en.html") + location.search + location.hash;
    });
  }
  renderAccount();
  fillChainSelects();
  $("fromSel").addEventListener("change", () => {
    state.fromKey = $("fromSel").value;
    fillToOptions();
    refreshQuote();
  });
  $("toSel").addEventListener("change", () => {
    state.toKey = $("toSel").value;
    fillTokenOptions();
    refreshQuote();
  });
  $("flipBtn").addEventListener("click", () => {
    const f = state.fromKey;
    state.fromKey = state.toKey;
    state.toKey = f;
    $("fromSel").value = state.fromKey;
    fillToOptions();
    refreshQuote();
  });
  $("tokenSel").addEventListener("change", () => {
    state.tokenKey = $("tokenSel").value;
    refreshQuote();
  });
  let deb = null;
  $("amountInput").addEventListener("input", () => {
    clearTimeout(deb);
    deb = setTimeout(refreshQuote, 450);
  });
  $("recipientInput").addEventListener("input", () => {
    clearTimeout(deb);
    deb = setTimeout(refreshQuote, 450);
  });
  document.querySelectorAll(".chip").forEach((b) => {
    b.addEventListener("click", () => {
      if (state.tokenBal == null) { setStatus(t("connectBtn"), true); return; }
      const tk = currentToken();
      if (!tk) return;
      const pct = Number(b.dataset.pct);
      const v = percentOf(state.tokenBal, pct);
      $("amountInput").value = formatAmount(v, tk.src.decimals, tk.src.decimals);
      if (pct === 100 && currentRoute()?.from !== "ql1") $("validLine").textContent = t("maxWarnNative");
      refreshQuote();
    });
  });
  $("sendBtn").addEventListener("click", doSend);
  $("watchClear").addEventListener("click", () => {
    try { localStorage.removeItem(WATCH_KEY); } catch (e) { /* ignore */ }
    state.watch = null;
    if (state.watchTimer) clearInterval(state.watchTimer);
    if (state.elapsedTimer) clearInterval(state.elapsedTimer);
    $("watchPanel").classList.add("hidden");
  });
  if (hasWallet() && window.ethereum.on) {
    window.ethereum.on("accountsChanged", (accs) => {
      state.account = accs && accs[0] ? accs[0] : null;
      renderAccount();
      refreshQuote();
    });
    window.ethereum.on("chainChanged", () => refreshQuote());
  }
  const saved = loadWatch();
  if (saved) {
    $("watchResume").textContent = t("watchResume");
    startWatch(saved);
  }
  refreshQuote();
}
document.addEventListener("DOMContentLoaded", init);
