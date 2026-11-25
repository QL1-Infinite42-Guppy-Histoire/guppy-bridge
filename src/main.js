// Guppy Bridge — a dedicated bridge frontend with the same routes as
// bridge.zaphod.one (config mirrored from its /api/state; see config.js).
// Send flow (verified patterns, same as the DEX aggregator's bridge code):
//   BridgeRouter chains (Infinite / BSC / Ethereum):
//     approve token -> BridgeRouter, then transferRemote payable with
//     value = quoteNative(dst, "0x").totalNative re-quoted at send time.
//   QL1 (no BridgeRouter): approve token -> Hyperlane warp router, then
//     transferRemote with value 0 (every sampled QL1 send paid 0).
// No route is statically disabled (full Zaphod parity, user decision
// 2026-11-07); every route is gated by the live check, and OSAK
// 42 Chain -> QL1 carries an unproven-route warning (chain.js
// routeWarning). BSC / Ethereum sources use the nativeOptional fee
// behaviour (their older routers revert quoteNative -> messaging fee 0,
// like the official frontend); see chain.js / fees.js.
import {
  CHAINS, SEL, routeFor, tokenFor, sendTarget, staticDisabled, routeWarning,
  encUint, encAddr, isAddress, parseAmount, formatAmount, percentOf,
  scaleToDst, readTokenBalance, readNativeBalance, readAllowance,
  fetchDelivered, extractMessageId,
  explorerTx, rpcCall,
} from "./chain.js";
import { getLiveQuote, driftGate } from "./fees.js";
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
  quoteCtx: null, // snapshot of what the displayed quote covers (drift gate)
  sending: false,
  watch: null,
  watchTimer: null,
  elapsedTimer: null,
};

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}
/* Presentation only: keep the icon-pill avatars (chain / token initials)
   in sync with the current selection. No effect on quoting or sending. */
const CHAIN_ICON = { infinite: "42", ql1: "Q", bsc: "B", ethereum: "Ξ" };
/* Chains with a real logo asset render it (circular-cropped PNG in
   the same 30px slot) instead of the letter avatar. Token icons are
   unaffected — this is the chain mark only. */
const CHAIN_LOGOS = {
  ql1: { src: "./ql1-logo.png", alt: "QL1" },
  infinite: { src: "./chain42-logo.png", alt: "42 Chain" },
};
function setChainIcon(id, key) {
  const el = $(id);
  if (!el) return;
  const logo = CHAIN_LOGOS[key];
  if (logo) {
    let img = el.querySelector("img.chain-logo");
    if (!img) {
      el.textContent = "";
      img = document.createElement("img");
      img.className = "chain-logo";
      el.appendChild(img);
    }
    if (img.getAttribute("src") !== logo.src) { img.src = logo.src; img.alt = logo.alt; }
    el.classList.add("has-logo");
  } else {
    el.classList.remove("has-logo");
    el.textContent = CHAIN_ICON[key] || "?";
  }
}
function syncPillIcons() {
  const tk = currentToken();
  const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  setChainIcon("fromChainIcon", state.fromKey);
  setChainIcon("toChainIcon", state.toKey);
  set("tokenIcon", tk ? tk.key.slice(0, 1) : "?");
  set("tokenIconTo", tk ? tk.key.slice(0, 1) : "?");
  set("tokenNameTo", tk ? tk.key : "");
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
  syncPillIcons();
}
function updateRouteNote() {
  const route = currentRoute();
  const warn = route ? routeWarning(route, state.tokenKey) : null;
  const note = $("routeNote");
  if (warn === "osak") { note.textContent = t("osakNote"); note.classList.remove("hidden"); }
  else if (route && (route.from === "bsc" || route.from === "ethereum")) {
    note.textContent = t("inboundNote"); note.classList.remove("hidden");
  }
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
  // Presentation only: the action area shows ONE big button — the
  // full-width Connect button while disconnected, the Bridge button
  // once connected (PancakeSwap style). Both call the existing flows.
  const ac = $("actionConnectBtn"), sb = $("sendBtn");
  if (!hasWallet()) {
    $("walletMissing").classList.remove("hidden");
    if (ac) ac.classList.add("hidden");
    if (sb) sb.classList.add("hidden");
    return;
  }
  $("walletMissing").classList.add("hidden");
  if (state.account) {
    // The connected chip is a button: tapping it opens the wallet
    // dialog (full address + Disconnect), same flow as the QOM DEX.
    const s = document.createElement("button");
    s.type = "button";
    s.className = "addr";
    s.textContent = t("connectedAs") + shortAddr(state.account);
    s.onclick = openConnDialog;
    box.appendChild(s);
    if (ac) ac.classList.add("hidden");
    if (sb) sb.classList.remove("hidden");
  } else {
    const b = document.createElement("button");
    b.className = "primary";
    b.textContent = t("connectBtn");
    b.onclick = connect;
    box.appendChild(b);
    if (ac) ac.classList.remove("hidden");
    if (sb) sb.classList.add("hidden");
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
/* ---------- wallet dialog (connected / disconnect) ----------
   Same behaviour as the QOM DEX frontend: tapping the connected
   chip opens a small dialog with the full address and a Disconnect
   button. Disconnect first asks the wallet to revoke this site's
   account permission where it supports that (MetaMask:
   wallet_revokePermissions) and then clears the local state either
   way. This site keeps no persisted "was connected" hint and only
   ever connects on an explicit button press, so after a disconnect
   a page reload stays disconnected. */
function openConnDialog() {
  if (!state.account) return;
  const dlg = $("connDlg");
  if (!dlg) return;
  $("connAddr").textContent = state.account;
  if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); }
  else dlg.setAttribute("open", "");
}
function closeConnDialog() {
  const dlg = $("connDlg");
  if (!dlg) return;
  if (typeof dlg.close === "function") { if (dlg.open) dlg.close(); }
  else dlg.removeAttribute("open");
}
async function disconnectWallet() {
  if (hasWallet()) {
    try {
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (e) { /* wallet without revoke support: local disconnect only */ }
  }
  state.account = null;
  closeConnDialog();
  renderAccount();
  refreshQuote();
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
    let tb = null, nb = null;
    try {
      tb = await readTokenBalance(state.fromKey, tk.src.erc20, state.account);
      nb = await readNativeBalance(state.fromKey, state.account);
    } catch (e) { /* both stay null = unknown */ }
    // Race guard (audit 2026-11-24): if the user switched chain/token
    // while these reads were in flight, a newer refresh owns the UI and
    // the shared balance state — this stale pass must not overwrite the
    // balance line, the amount panel, or state.tokenBal/nativeBal.
    if (seq !== quoteSeq) return;
    state.tokenBal = tb;
    state.nativeBal = nb;
  } else {
    // Disconnected: never leave a previous account's balances on screen
    // or in the shared state the % chips and checks read (audit 2026-11-24).
    state.tokenBal = null;
    state.nativeBal = null;
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
  // Snapshot of exactly what this displayed quote covers, for the
  // send-time drift gate (2026-11-24): doSend compares its fresh quote
  // against this snapshot and only trusts the on-screen receive figure
  // when the snapshot is for the SAME route/token/amount. receiveRaw is
  // the destination-scale figure the panel shows (BridgeRouter routes;
  // null when no quoteBridge answer was available for this amount).
  state.quoteCtx = {
    fromKey: state.fromKey, toKey: state.toKey, tokenKey: state.tokenKey,
    amountRaw: amount != null ? amount.toString() : null,
    receiveRaw: check && check.kind === "bridgeRouter" ? check.receiveRaw : null,
  };
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
    // The router's token() was already read by the live check — enforce it
    // against the mirrored config (audit 2026-11-24): if the router ever
    // pointed at a different token than the one this site would approve,
    // sending must stop, not just display.
    if (check.token && check.token.toLowerCase() !== tk.src.erc20.toLowerCase())
      problem = problem || t("routeQuoteFailed");
    if (check.quoteNative) {
      $("qNativeFee").textContent =
        formatAmount(check.quoteNative.totalNative, 18) + " " + CHAINS[state.fromKey].native.symbol +
        (check.nativeFallback
          ? " (" + t("nativeNoQuoteNote") + ")"
          : check.quoteNative.totalNative === 0n
            ? " (" + t("zeroNativeNote") + ")"
            : "");
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
    // Use the fee module's decimal-scaled receive figure (audit
    // 2026-11-24): formatting the source-scale amount with the
    // destination's decimals is only correct when both sides share
    // decimals.
    $("qReceive").textContent = amount != null && check.receiveRaw != null
      ? formatAmount(check.receiveRaw, tk.dst.decimals) + " " + tk.key : "—";
    if (!(check.codeBytes > 0) || !check.mailbox ||
        check.mailbox.toLowerCase() !== CHAINS.ql1.mailbox.toLowerCase())
      problem = problem || t("routeQuoteFailed");
  } else {
    problem = problem || t("routeQuoteFailed");
    $("qNativeFee").textContent = "—"; $("qBridgeFee").textContent = "—"; $("qReceive").textContent = "—";
  }
  // Zero-address recipient (audit 2026-11-24): tokens delivered to
  // 0x000…0 are irrecoverable — block it like any other invalid input.
  const recipientVal = $("recipientInput").value.trim();
  if (/^0x0{40}$/.test(recipientVal)) problem = problem || t("errRecipientZero");
  if (amount != null && state.tokenBal != null && amount > state.tokenBal)
    problem = problem || t("errOverBalance");
  if (amount != null && amount === 0n) problem = problem || t("errAmountPositive");
  // native fee + gas coverage warning (BridgeRouter routes with a fee)
  let nativeWarn = "";
  if (check && check.kind === "bridgeRouter" && check.quoteNative && state.nativeBal != null) {
    if (state.nativeBal <= check.quoteNative.totalNative) nativeWarn = t("errNativeLow");
  }
  // Unproven-route warning (OSAK 42 Chain -> QL1): shown in the quote
  // panel, but it is a warning only — it never blocks sending.
  const warn = routeWarning(route, state.tokenKey) === "osak" ? t("osakNote") : "";
  $("qRouteState").textContent = problem && !dis ? problem :
    (dis ? "—" : t("routeOk"));
  $("validLine").textContent = dis ? "" : (nativeWarn || problem || warn || "");
  $("validLine").className = "status" + ((nativeWarn || problem) ? " err" : "");
  const canSend = !!state.account && !state.sending && !dis && !problem && amount != null && amount > 0n && !nativeWarn;
  sendBtn.disabled = !canSend;
  // Presentation only: mirror the receive estimate into the To panel.
  const rp = $("qReceivePanel");
  if (rp) rp.textContent = $("qReceive").textContent;
}

/* ---------- send ---------- */
// Drift-gate aborts carry their own complete user-facing message; the
// catch block shows them verbatim instead of prefixing "Failed:".
function quoteGateError(msg) {
  const e = new Error(msg);
  e.quoteGate = true;
  return e;
}
async function doSend() {
  const route = currentRoute(), tk = currentToken();
  if (!route || !tk || !state.account || state.sending) return;
  const recipient = $("recipientInput").value.trim();
  if (!isAddress(recipient)) { setStatus(t("errRecipient"), true); return; }
  if (/^0x0{40}$/.test(recipient)) { setStatus(t("errRecipientZero"), true); return; }
  let amount;
  try { amount = parseAmount($("amountInput").value, tk.src.decimals); }
  catch (e) { setStatus(t("errAmountFormat"), true); return; }
  if (amount <= 0n) { setStatus(t("errAmountPositive"), true); return; }
  state.sending = true;
  $("sendBtn").disabled = true;
  try {
    await ensureChain(state.fromKey);
    // Fresh re-quote at send time (never reuse a stale messaging fee),
    // re-validating everything the confirmation panel enforced — the
    // button state can lag the inputs by one debounce, so the send path
    // must not trust it (audit 2026-11-24). Send construction itself
    // (target, calldata, value) is unchanged.
    let totalNative = 0n;
    if (tk.src.bridgeRouter) {
      const fresh = await getLiveQuote(route, tk, amount);
      if (!fresh.quoteNative || !fresh.quoteBridge || fresh.paused || fresh.allowed !== true)
        throw new Error(t("routeQuoteFailed"));
      if (fresh.token && fresh.token.toLowerCase() !== tk.src.erc20.toLowerCase())
        throw new Error(t("routeQuoteFailed"));
      if (fresh.min != null && amount < fresh.min)
        throw new Error(t("errBelowMin", formatAmount(fresh.min, tk.src.decimals), tk.key));
      if (fresh.max != null && fresh.max < (1n << 200n) && amount > fresh.max)
        throw new Error(t("errAboveMax"));
      totalNative = fresh.quoteNative.totalNative;
      // Quote-drift gate (user-approved 2026-11-24): the receive figure
      // the user reviewed on screen must still be EXACTLY what this fresh
      // quote returns (fixed-fee routes — any difference means the
      // router's fee parameters changed after the review; see fees.js).
      // Aborts here, before any approval or signing; the finally block
      // re-runs refreshQuote so the panel then shows the new figures.
      // QL1 warp routes have no quoteBridge and nothing to drift
      // (receive = sent amount scaled 1:1, fee 0) — their structural
      // re-check below is their gate.
      const gate = driftGate(state.quoteCtx, {
        fromKey: state.fromKey, toKey: state.toKey,
        tokenKey: state.tokenKey, amountRaw: amount.toString(),
      }, fresh.receiveRaw);
      if (gate.action === "review") throw quoteGateError(t("errQuoteReview"));
      if (gate.action === "changed") {
        throw quoteGateError(t("errQuoteChanged",
          formatAmount(gate.now, tk.dst.decimals) + " " + tk.key,
          formatAmount(gate.was, tk.dst.decimals) + " " + tk.key));
      }
    } else {
      // QL1 warp route: re-run the structural check at send time too.
      const fresh = await getLiveQuote(route, tk, amount);
      if (!(fresh.codeBytes > 0) || !fresh.mailbox ||
          fresh.mailbox.toLowerCase() !== CHAINS.ql1.mailbox.toLowerCase())
        throw new Error(t("routeQuoteFailed"));
    }
    // Balance re-check (best effort: a failed read does not block — the
    // contract still enforces — but a read that succeeds and shows the
    // amount exceeds the balance stops the send before any approval).
    try {
      const balNow = await readTokenBalance(state.fromKey, tk.src.erc20, state.account);
      if (balNow != null && amount > balNow) throw new Error(t("errOverBalance"));
    } catch (e) {
      if (e && e.message === t("errOverBalance")) throw e;
      /* read failure: proceed, on-chain enforcement still applies */
    }
    // recipient destination balance before the send (secondary arrival signal)
    let dstBalBefore = null;
    try { dstBalBefore = await readTokenBalance(state.toKey, tk.dst.erc20, recipient); }
    catch (e) { /* optional */ }
    const target = currentTarget(tk);
    // approve only if allowance is not enough; exact amount
    const allowance = await readAllowance(state.fromKey, tk.src.erc20, state.account, target);
    if (allowance === null) throw new Error(t("routeQuoteFailed"));
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
      srcDecimals: tk.src.decimals,
      dstErc20: tk.dst.erc20, dstDecimals: tk.dst.decimals,
      dstBalBefore: dstBalBefore != null ? dstBalBefore.toString() : null,
      startedAt: Date.now(), delivered: false,
    };
    saveWatch(watch);
    startWatch(watch);
    // If the receipt never came back within the wait window, do not
    // claim a confirmed send (audit 2026-11-24): the transfer may well
    // have landed, so the watch still starts — but the status says the
    // confirmation itself could not be read.
    setStatus(rc ? t("sentOk") : t("confirmTimeout"));
  } catch (e) {
    const msg = (e && e.quoteGate) ? e.message
      : (e && (e.code === 4001 || /rejected|denied/i.test(e.message || "")))
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
    // Shape-validate the persisted watch (audit 2026-11-24): the panel is
    // rendered from this data on every page load, so a malformed or
    // tampered entry must be dropped, never rendered or parsed loosely.
    if (!w || typeof w !== "object") return null;
    if (!/^0x[0-9a-fA-F]{64}$/.test(w.txHash || "")) return null;
    if (!(w.fromKey in CHAINS) || !(w.toKey in CHAINS)) return null;
    if (typeof w.tokenKey !== "string" || w.tokenKey.length > 12) return null;
    if (!/^\d+$/.test(w.amountRaw || "")) return null;
    if (!isAddress(w.recipient || "") || !isAddress(w.dstErc20 || "")) return null;
    const decOk = (d) => Number.isInteger(d) && d >= 0 && d <= 36;
    if (!decOk(w.dstDecimals)) return null;
    if (w.srcDecimals != null && !decOk(w.srcDecimals)) return null;
    if (!Number.isFinite(w.startedAt) || w.startedAt <= 0) return null;
    if (w.messageId != null && !/^0x[0-9a-fA-F]{64}$/.test(w.messageId)) return null;
    return w;
  } catch (e) { return null; }
}
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function renderWatch(w, delivered, dstBal) {
  const panel = $("watchPanel");
  panel.classList.remove("hidden");
  // Built with DOM APIs + textContent only (audit 2026-11-24): the watch
  // data round-trips through localStorage, so it is never interpolated
  // into innerHTML. The amount sent is formatted with the SOURCE token's
  // decimals (amountRaw is source-scale); older watches saved before
  // srcDecimals existed fall back to dstDecimals, as they did before.
  const body = $("watchBody");
  body.innerHTML = "";
  const kv = (label, valueNode) => {
    const row = document.createElement("div");
    row.className = "kv";
    const s = document.createElement("span");
    s.textContent = label;
    const b = document.createElement("b");
    if (typeof valueNode === "string") b.textContent = valueNode;
    else b.appendChild(valueNode);
    row.appendChild(s);
    row.appendChild(b);
    body.appendChild(row);
    return b;
  };
  const txLink = document.createElement("a");
  txLink.href = explorerTx(w.fromKey, w.txHash);
  txLink.target = "_blank";
  txLink.rel = "noreferrer";
  txLink.textContent = w.txHash.slice(0, 10) + "…";
  kv(t("watchTx"), txLink);
  if (w.messageId) {
    const mb = kv(t("watchMsg"), w.messageId.slice(0, 18) + "…");
    mb.className = "addr";
  }
  kv(
    `${w.tokenKey} ${DISPLAY[w.fromKey]} → ${DISPLAY[w.toKey]}`,
    `${formatAmount(BigInt(w.amountRaw), w.srcDecimals != null ? w.srcDecimals : w.dstDecimals)} ${w.tokenKey}`
  );
  if (dstBal != null)
    kv(t("watchBalance"), `${formatAmount(dstBal, w.dstDecimals)} ${w.tokenKey}`);
  const p = document.createElement("p");
  p.className = "status";
  if (delivered) {
    p.textContent = t("watchDelivered");
  } else {
    p.textContent = t("watchWaiting");
    const el = document.createElement("span");
    el.className = "watchElapsed";
    el.textContent = fmtElapsed(Date.now() - w.startedAt);
    p.appendChild(el);
  }
  body.appendChild(p);
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
    syncPillIcons();
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
  const acb = $("actionConnectBtn");
  if (acb) acb.addEventListener("click", connect);
  const connDlg = $("connDlg");
  if (connDlg) {
    $("connDlgTitle").textContent = t("walletDlgTitle");
    $("connDlgNote").textContent = t("walletDlgNote");
    $("disconnectBtn").textContent = t("disconnectBtn");
    $("connClose").textContent = t("closeBtn");
    $("connClose").addEventListener("click", closeConnDialog);
    $("disconnectBtn").addEventListener("click", disconnectWallet);
    // Backdrop tap dismisses without disconnecting (Esc is native
    // to <dialog>); clicks inside the card itself must not close it.
    connDlg.addEventListener("click", (e) => { if (e.target === connDlg) closeConnDialog(); });
  }
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
      // Keep an open wallet dialog truthful: close it when the
      // account goes away (e.g. a revoke landing), follow a switch.
      if (!state.account) closeConnDialog();
      else if (connDlg && connDlg.open) $("connAddr").textContent = state.account;
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
