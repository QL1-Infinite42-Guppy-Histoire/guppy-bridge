# ブリッジ（Guppy Bridge）

42 Chain・QL1・BNB Smart Chain・Ethereum の間でトークンを移動するための静的サイト。
bridge.zaphod.one と**同じルート・同じ契約**を使う、Guppy's Guide の専用フロントエンドです。

## 言語（English / 日本語）
- ルート（`index.html`）は言語ゲート：保存済みの選択（localStorage `guppybridge_lang`）が
  「ja」のときだけ日本語ページへ、それ以外は **英語がデフォルト**。
- 日本語ページ：`ja.html` ／ 英語ページ：`en.html`。文言は `src/i18n.js` の文字列テーブルに集約。
- 手数料まわりの見積もり・計算は `src/fees.js` の1モジュールに隔離しています
  （将来、別の手数料方式に差し替える場合もこのファイルだけが対象）。

**公開サイト:** https://ql1-infinite42-guppy-histoire.github.io/guppy-bridge/ （入口＝言語ゲート）
- 日本語: https://ql1-infinite42-guppy-histoire.github.io/guppy-bridge/ja.html
- English: https://ql1-infinite42-guppy-histoire.github.io/guppy-bridge/en.html

## 対応ウォレット
- **EVM ウォレット全般**（`window.ethereum`）：MetaMask、FoxWallet（EVM モード）、
  GuppyWallet ブラウザ拡張機能など。4チェーン（42 Chain `0x66c9a`、QL1 `0x2fe`、
  BSC `0x38`、Ethereum `0x1`）へ自動で切り替え／追加を提案します。

## できること
- 送るチェーン／受け取るチェーンの選択（⇄ で入れ替え）、ルートに合ったトークン選択
- 金額入力に 25% / 50% / 75% / MAX チップ、残高表示（トークン＋ガスコイン）
- 受け取るアドレスの指定（初期値は自分のアドレス、変更可・形式チェック付き）
- 送る前の確認パネル：ブリッジ手数料、中継手数料（その場で取り直した見積もり）、
  最小／最大、受け取る量の見込み、使う契約、ルートのライブ確認結果
- 送信＝（必要なら）使用許可 → `transferRemote`。送信後は到着見守り
  （送信リンク、経過時間、相手チェーンのメールボックスで受信確認、受け取る人の残高）。
  見守り状態は localStorage に保存され、ページを開き直すと再開します。

## ルートと送り方（bridge.zaphod.one/api/state を 2026-11-07 に取得して写したもの）
- **QL1 ⇄ 42 Chain**：QOM、BABY、CAW、FATHER、HAWK、KET、O、OSAK（両側18桁）
- **42 Chain ⇄ BSC**：USDT、USDC（両側18桁）
- **42 Chain ⇄ Ethereum**：USDT（ETH側6桁）、USDC（ETH側6桁）、WBTC（両側8桁）
- 42 Chain／BSC／Ethereum から送る場合：Zaphod の **BridgeRouter** へトークンの使用許可をし、
  `quoteNative(宛先, "0x")` の `totalNative` をその場で取り直して上乗せし、
  `transferRemote(宛先ドメイン, bytes32(受け取る人), 金額)` を呼びます。
- QL1 から送る場合：BridgeRouter は無いので、**Hyperlane ワープルーター**へ使用許可をし、
  金額 0 で `transferRemote` を直接呼びます（実送信サンプル全件が 0 でした・2026-11-06 検証）。
- 宛先ドメイン＝宛先チェーンの EVM チェーンID。到着確認は宛先チェーンの Hyperlane
  メールボックス `delivered(messageId)`（messageId は送信レシートの
  BridgeInitiated／Dispatch ログから取得）＋受け取る人の残高変動。

## 手数料（全て見積もりはライブ取得・送信時に再取得。固定値は持ちません）
- ブリッジ手数料＝`quoteBridge(金額)` の fee。USDT／USDC（42 Chain 発）は一律 2.0 トークン
  （契約の feeFlat、そのまま差し引かれて 98 が届く形）、他は 0。
  この 2.0 は契約の所有者（Zaphod／MT 側）だけが変えられるもので、フロントエンドでは外せません。
- 中継手数料＝`quoteNative` の totalNative。実測（2026-11-07）：
  QL1 向けと WBTC→Ethereum は約 2.932 [42]、USDT／USDC の BSC・Ethereum 向けは **0 [42]**。
  QL1 発は手数料・中継手数料とも 0（ガス代のみ）。

## 受け取る量の計算（小数桁の変換）
`quoteBridge` の forwardAmount は**送る側トークンの桁**で返ります。受け取る量は
桁の差で変換します（例：42 Chain→Ethereum の USDT 100 → forward 98（18桁表現）→
98 USDT（6桁））。これは契約の `destinationScaleFactor` と一致します
（同ルートで実測 1e12 ＝ 10^(18−6)）。逆向き（Ethereum→42 Chain）も同じ考え方で、
100 USDT（6桁）→ forward 100（6桁表現）→ 100 USDT（18桁）です。WBTC は両側8桁で変換なし。

## 検証結果（2026-11-07、全ルートを eth_call でライブ確認）
| 向き | トークン | 契約 | VERSION | 停止 | token()一致 | 宛先許可 | quoteNative | quoteBridge（サンプル） | 最小 |
|---|---|---|---|---|---|---|---|---|---|
| 42→QL1 | QOM | BridgeRouter 0x049a78Fe… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 手数料0 | 1.0 |
| 42→QL1 | BABY | 0x4aba9dBE… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→QL1 | FATHER | 0x056c116c… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→QL1 | HAWK | 0x0d198200… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→QL1 | KET | 0x3BC94E9F… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→QL1 | CAW | 0x82bA5D61… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→QL1 | O | 0xcB893a7e… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→QL1 | OSAK | 0xA2093426… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 100→100, 0 | 1.0 |
| 42→BSC | USDT | 0x8667682B… | 1.3.0 | なし | ✓ | ✓ | 0 [42] | 100→98, 手数料2.0 | 1.0 |
| 42→BSC | USDC | 0xCDbf8dA8… | 1.3.0 | なし | ✓ | ✓ | 0 [42] | 100→98, 2.0 | 1.0 |
| 42→ETH | USDT | 0x8667682B… | 1.3.0 | なし | ✓ | ✓ | 0 [42] | 100→98, 2.0 | 1.0 |
| 42→ETH | USDC | 0xCDbf8dA8… | 1.3.0 | なし | ✓ | ✓ | 0 [42] | 100→98, 2.0 | 1.0 |
| 42→ETH | WBTC | 0xb436C84a… | 1.3.0 | なし | ✓ | ✓ | 2.932045 [42] | 1→1, 0 | 0.00003 |
| QL1→42 | QOM 他7種 | ワープルーター（各種） | — | — | — | — | （対象外・金額0） | （手数料0・1:1） | — |
| BSC→42 | USDT | 0x2f136BaA… | **1.1.0** | なし | ✓ | ✓ | **エラー（revert）** | 100→100, 0 | 1.0 |
| BSC→42 | USDC | 0x4F69A9cF… | **1.1.0** | なし | ✓ | ✓ | **エラー** | 100→100, 0 | 1.0 |
| ETH→42 | USDT | 0x56d962fD… | **1.2.0** | なし | ✓ | ✓ | **エラー** | 100→100, 0 | 1.0 |
| ETH→42 | USDC | 0x1613e840… | **1.1.0** | なし | ✓ | ✓ | **エラー** | 100→100, 0 | 1.0 |
| ETH→42 | WBTC | 0xF2ecB173… | **1.2.0** | なし | ✓ | ✓ | **エラー** | 1→1, 0 | 0.0008 |

- QL1 ワープルーター（8種とも）：コード 11,922 バイト、`mailbox()` ＝ QL1 メールボックス
  `0x2f136BaA…`、`localDomain()` ＝ 766 を確認。配送実績は 2026-11-06 のサンプリングで
  QL1→42 は 16/16 到着確認済み。
- 最大はいずれも事実上無制限（2^256−1）。BSC／ETH 発の旧バージョン契約では
  `feeBps()`／`feeFlat()` も存在せずエラーでした。

## 実験ルート（手数料0・直接ワープ）— テスト済み・閉鎖（2026-11-07、v0.3.0 で削除）
ユーザーの判断（2026-11-07、選択肢②）で v0.2.0 に追加した実験機能です。合意した実地テストの
結果、**仕組みとして不可能**であることが硬い証拠つきで判明したため、サイトから削除しました
（通常ルートは影響を受けていません）。

- 送り方（だったもの）：BridgeRouter を通さず、トークンの **Hyperlane ワープルーターへ直接**
  使用許可をして `transferRemote(宛先, bytes32(受け取る人), 金額)` を金額 0 で呼ぶ。
  USDT ワープ `0xaf16100C…`、USDC ワープ `0xe20C0c64…`、WBTC ワープ `0x111031c2…`。
  目的は、通常ルートのブリッジ手数料（USDT/USDC の一律 2.0）の回避でした。
- **実地テスト（2026-11-07）**：ユーザーが合意したテスト（0.1 USDT、42 Chain → BSC、実験ルート）を
  実行。使用許可（approve）は成功し（使用許可 user→warp ＝ 0.1 USDT、残高 0.15 USDT を
  チェーン上で確認）、しかし `warp.transferRemote(56, recipient, 0.1e18)` はウォレットの
  ガス見積もり（estimateGas）の段階で "execution reverted" となり、送信できませんでした。
- **再現（同日）**：ユーザーのアドレスからオフチェーンで正確に再現。`eth_call` と
  `estimateGas` の両方が、カスタムエラー **`0x0c3dba28(sender)`** で revert しました。
  セレクタ `0x0c3dba28` は USDT ワープ自身のバイトコード（10,487 バイト）の中に存在し、
  トークン側のバイトコードには存在しません。
- **呼び出し元の切り分け（同日）**：USDT ワープの `transferRemote` への模擬呼び出しは、
  EOA からでも、DEX ルーター契約からでも、ワープの所有者／デプロイヤー `0xe15c7747…` からでも、
  すべて `0x0c3dba28(caller)` で revert しました。このチェックを通過するのは
  **BridgeRouter のアドレスだけ**です（BridgeRouter からは通常の ERC20 allowance チェックまで
  進みます）。
- **結論**：Infinite 側のワープルーターは、対になる BridgeRouter からの `transferRemote` しか
  受け付けない設計です。直接ワープによる迂回は、Infinite 発のどのルートでも成立しません。
  ユーザーの資金は無事でした（残高は不変）。
- サイト上では、42 Chain → BSC／Ethereum を選んだときに短い注記を表示します
  （「手数料無料の直接ルートは2026-11-07に実地テストしましたが、できませんでした。…」）。
  画面に残る送信経路は通常ルートだけです。

## 無効にしているルート（理由つき・サイト上にも表示）
- **BSC から送る／Ethereum から送る（全トークン）**：契約が旧バージョン（1.1.0／1.2.0）で、
  中継手数料の見積もり `quoteNative` がエラーになり、送る前に手数料を確認できないため。
  他の確認（停止状態・token・宛先許可・quoteBridge）は通っています。
  この2チェーンで**受け取る**こと（42 Chain から送る）は使えます。
- **OSAK の 42 Chain → QL1**：42 Chain 側 BridgeRouter の全履歴で、この向きの送信が 0 件
  （未証明）のため。QL1 → 42 Chain の OSAK は使えます（到着サンプル 2/2 確認済み）。
- なお、サイトは送信直前にもライブ確認をやり直し、停止中・宛先不許可・見積もり失敗の
  ときは送信ボタンを押せないようにしています。

## 正直な制限
- **実際の送金はまだテストしていません。** 読み取りと見積もりは全ルートでライブ確認済みですが、
  このサイトからの初回の送信が、そのままエンドツーエンドの確認になります。少額から試してください。
- 到着には数分かかります（実測した 42→QL1 の QOM 1件は約337秒）。
- 価格や APY の表示はありません（このサイトは価格を持ちません）。

## 開発
```sh
npm install
npm run build        # docs/ に静的ファイルを出力（GitHub Pages が /docs を配信）
node test/unit.mjs   # 金額計算・桁変換・ルート方針の単体テスト
node test/live-smoke.mjs  # サイト自身のコードでのライブ見積もりスモークテスト
```

---

## English summary

A static site for moving tokens between **42 Chain, QL1, BNB Smart Chain and
Ethereum**, using the **same routes and contracts as bridge.zaphod.one**
(config mirrored exactly from its `/api/state`, fetched 2026-11-07).
A Guppy's Guide product, sister site to the DEX Aggregator and the staking sites.

- **Language**: the root page is a language gate — English by default, Japanese
  (`ja.html`) only when that choice was saved (`guppybridge_lang` in localStorage).
  UI strings live in `src/i18n.js`; all fee logic is isolated in `src/fees.js`.
- **Wallets**: `window.ethereum` only (MetaMask, FoxWallet EVM mode, GuppyWallet
  extension, …), with automatic switch/add for all four chains.
- **Routes**: QL1 ⇄ 42 Chain (QOM, BABY, CAW, FATHER, HAWK, KET, O, OSAK),
  42 Chain ⇄ BSC (USDT, USDC), 42 Chain ⇄ Ethereum (USDT/USDC at 6 decimals on
  the Ethereum side, WBTC at 8). Amount chips 25/50/75/MAX, editable recipient,
  a pre-send quote panel (bridge fee, fresh messaging fee, min/max, estimated
  receive), and an arrival watch (destination mailbox `delivered(messageId)` +
  recipient balance) that persists in localStorage and resumes after reload.
- **Send mechanics**: BridgeRouter chains approve the token to the BridgeRouter
  and call `transferRemote` with `value = quoteNative(dst, "0x").totalNative`
  re-quoted at send time. QL1 has no BridgeRouter: approve to the Hyperlane warp
  router and call `transferRemote` with value 0 (verified on sampled real sends).
- **Fees (all live-quoted, never hard-coded)**: bridge fee from `quoteBridge` —
  flat 2.0 tokens for USDT/USDC leaving 42 Chain (the contract's on-chain
  feeFlat, set by its Zaphod/MT-side owner; a frontend cannot waive it), 0
  otherwise. Messaging fee from `quoteNative` — measured 2026-11-07: ~2.932 [42]
  for QL1 routes and WBTC→Ethereum, **0 [42]** for USDT/USDC routes to BSC/Ethereum.
- **Receive-amount scaling**: `quoteBridge` returns the forward amount in
  source-token units; the delivered amount is that value converted by the
  decimal difference, which matches the routers' `destinationScaleFactor`
  (1e12 = 10^(18−6) measured on Infinite→Ethereum USDT/USDC).
- **Verification (2026-11-07, every route eth_call-checked live)**: all
  Infinite-source BridgeRouters are VERSION 1.3.0, not paused, token matches
  `/api/state`, destination allowed, min/max sane, both quotes answer. QL1 warp
  routers: 11,922 bytes of code, `mailbox()` = the QL1 mailbox, `localDomain()` = 766.
- **Experimental fee-free route — TESTED AND CLOSED (2026-11-07, removed in
  v0.3.0)**: v0.2.0 added an opt-in route that approved the token to the
  token's Hyperlane warp router (USDT `0xaf16100C…`, USDC `0xe20C0c64…`, WBTC
  `0x111031c2…`) and called `transferRemote` with value 0, bypassing the
  BridgeRouter to skip the flat 2.0 USDT/USDC fee. The user then made the
  agreed test: 0.1 USDT, 42 Chain -> BSC, experimental route. The approve
  succeeded (allowance user->warp = 0.1 USDT on-chain; balance 0.15 USDT),
  but the wallet's estimateGas on `warp.transferRemote(56, recipient,
  0.1e18)` reverted: "execution reverted". Reproduced exactly off-chain from
  the user's address: eth_call and estimateGas both revert with custom
  error **0x0c3dba28(sender)**. The selector 0x0c3dba28 is present in the
  USDT warp's own bytecode (10,487 B) and NOT in the token's. Simulated
  calls to the USDT warp's transferRemote from an EOA, from the DEX router
  contract, and from the warp owner/deployer 0xe15c7747… ALL revert with
  0x0c3dba28(caller). ONLY the BridgeRouter address gets past this check
  (it then fails on ordinary ERC20 allowance). Conclusion: the
  Infinite-side warp routers accept transferRemote solely from their
  paired BridgeRouter, by design. The direct-warp bypass cannot work on
  any Infinite-origin route. User funds unaffected (balance unchanged).
  The site now shows a short note to this effect when 42 Chain -> BSC /
  Ethereum is selected, and only the standard route remains.
- **Disabled, with reasons shown in the UI**: sending FROM BSC and FROM Ethereum
  (older BridgeRouters, 1.1.0 / 1.2.0, whose `quoteNative` reverts — the
  messaging fee cannot be checked before sending; receiving on those chains
  works), and OSAK from 42 Chain to QL1 (zero sends in that direction in the
  router's whole history — unproven; QL1→42 Chain OSAK is enabled).
- **Honest limit**: read/quote-verified only — **no real-money send has been
  made from this site yet**; the first small transfer is the end-to-end check.
