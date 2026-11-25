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
- **EVM ウォレット全般**（`window.ethereum`）：MetaMask、FoxWallet（EVM モード）
  など。4チェーン（42 Chain `0x66c9a`、QL1 `0x2fe`、
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
  ただし **BSC／Ethereum 発（42 Chain 向け）は例外**です。送信元ルーターが旧バージョン
  （1.1.0／1.2.0）で `quoteNative` がエラー（revert）になるため、公式サイト
  bridge.zaphod.one と同じく、中継手数料は **0（金額 0 で送信）** として扱います
  （この方式は 2026-10-30 にオンチェーン検証され、ウォレットアプリ v2 で実装済みのものです）。
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
- **BSC／Ethereum 発（42 Chain 向け）** は、旧契約が見積もり自体を返さない（revert）ため、
  公式方式どおり中継手数料 **0** で送信します。到着実績は公式統計で BSC 発 159 件・
  Ethereum 発 116 件（2026-10-30 時点）が記録されています。ブリッジ手数料はこの向きも 0
  （`quoteBridge` は正常に答え、forward／fee／totalRequired を送信前に確認します）。

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
| BSC→42 | USDT | 0x2f136BaA… | **1.1.0** | なし | ✓ | ✓ | 見積もりなし（revert）→ **0 で送信** | 100→100, 0 | 1.0 |
| BSC→42 | USDC | 0x4F69A9cF… | **1.1.0** | なし | ✓ | ✓ | 見積もりなし（revert）→ **0 で送信** | 100→100, 0 | 1.0 |
| ETH→42 | USDT | 0x56d962fD… | **1.2.0** | なし | ✓ | ✓ | 見積もりなし（revert）→ **0 で送信** | 100→100, 0 | 1.0 |
| ETH→42 | USDC | 0x1613e840… | **1.1.0** | なし | ✓ | ✓ | 見積もりなし（revert）→ **0 で送信** | 100→100, 0 | 1.0 |
| ETH→42 | WBTC | 0xF2ecB173… | **1.2.0** | なし | ✓ | ✓ | 見積もりなし（revert）→ **0 で送信** | 1→1, 0 | 0.0008 |

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

## 無効にしているルート
**ありません（全26トークンルートが有効です）。** bridge.zaphod.one と完全一致させる、
というユーザーの判断（2026-11-07）によるものです。残っているのは「無効」ではなく
「警告」が1件だけです：
- **OSAK の 42 Chain → QL1**：送信は有効です。ただしこの向きの送信は公式ルーターの
  全履歴で 0 件のため「未証明」であり、サイトではこのルートを選んだときに警告を
  表示します（仕組みは他のトークンと同じですが到着は未確認。少額テスト推奨）。
  QL1 → 42 Chain の OSAK は到着サンプル 2/2 確認済みで、通常どおり使えます。
  なお **DEX アグリゲーターではこの向きを引き続き無効**にしています
  （別プロダクトであり、そちらの方針は変更していません）。
- **訂正履歴**：v0.3.0 までは BSC／Ethereum 発（42 Chain 向け）も無効にしていましたが、
  それは誤りでした。旧契約が `quoteNative` に答えないことは、公式フロントエンドが
  「中継手数料 0 で送る」合図であり、無効化の理由にはなりません（2026-10-30 に
  オンチェーン検証され、ウォレットアプリ v2 で同じ方式で実装済み）。v0.4.0 で有効化しました。
- なお、サイトは送信直前にもライブ確認をやり直し、停止中・宛先不許可・`quoteBridge`
  の見積もり失敗のときは送信ボタンを押せないようにしています。

## 正直な制限
- **初の実送金は成功済みです（2026年11月25日）。** BSC の USDT 3ドル → 42 Chain をこのサイトから
  送り、着金まで確認しました（BSC 側 tx：0x84c9…ee15／42 側の着金 tx：0x3af5…a5f）。
  読み取りと見積もりは全ルートでライブ確認済みです。初めて送るときは少額から試してください。
- 到着には数分かかります（実測した 42→QL1 の QOM 1件は約337秒）。
- 価格や APY の表示はありません（このサイトは価格を持ちません）。

## UI（v0.8.0、表示のみの変更）
Uniswap / PancakeSwap のモバイル画面を手本にしたカード型 UI に刷新しました：大きな角丸パネル
（From / To）にアイコン付きピル型のチェーン・トークン選択、パネルの継ぎ目に重なる反転ボタン、
受け取り見込みの大きな表示、受取アドレスのパネル化、見積もり詳細を同じカード内に集約。
ウォレット接続は明示ボタン式で、ヘッダー右上に接続ボタン、未接続時は操作エリアに幅いっぱいの
大きな「ウォレットで接続」ボタンが出て、接続後は大きな送信ボタン1つだけに切り替わります。
v0.6.0 では見た目をさらに磨きました：丸みのある書体（英数字は Nunito、日本語は
M PLUS Rounded 1c、Google Fonts から `display=swap` で読み込み）、彩度を上げた鮮やかな
アクセント色（青→紫のグラデーション基調）、PancakeSwap 風の「下端の濃い縁＋押し込み」
立体ボタン、カードの柔らかい影と背景の淡いグラデーション。白基調デフォルト＋
`guppy-theme` の白/黒切替は従来どおりで、鮮やかな配色は両テーマで使えます。
v0.7.0 ではデバイス別の最適化を入れました：スマホ（〜640px）は1カラムで
カードが画面幅いっぱい・ボタン幅いっぱい、タブレット（641〜1023px）は
カード幅を抑えて中央寄せ＋文章セクションは中間の幅、PC（1024px〜）は
コンテナ1120pxのまま操作カードを中央に最大640pxで固定（横に伸ばさない）、
文字・余白を一段大きくし、到着ウォッチ等はカードと同じ中央カラムに揃えます。
ブリッジ・見積もり・送信のロジック（src/chain.js / src/fees.js / src/config.js / src/i18n.js）
は無変更で、src/main.js の変更も表示の配線のみです（v0.7.0 では CSS のみ変更）。
v0.7.1 では黒テーマの読みにくさを直しました（CSS のみ）：テーマごとに
`color-scheme`（light / dark）を宣言し、ネイティブのドロップダウンやスクロールバーが
テーマに追従するようにしました。これまでは宣言が無く、黒テーマでトークン選択の
ドロップダウンが白背景に白に近い文字で開き、選択肢が見えない問題がありました。
あわせて `select option` の地色・文字色を明示し、黒テーマの補助文字色
（--muted）を明るく（#9aa7c2 → #b0bedd）し、パネルラベルは黒テーマで本文色に
寄せました。
v0.8.0 では、ユーザーの要望（「パソコン版もっと横幅広く出来る？」）を受けて
PC（1024px〜）のレイアウトを広げました（CSS のみ）。これは v0.7.0 の
「操作カードを中央に最大640pxで固定」という方針を置き換えるものです：
操作カードはコンテナ1120pxの中で最大960px・中央寄せになり、From / To
パネルは横並び（反転ボタンは継ぎ目の中央で90°回転し、横向きの矢印として
表示）、見積もりの明細行はカード内で2カラムに流れ、到着ウォッチ・
ウォレット警告・詳細・フッターも同じ960pxのカラムに揃えました。
スマホ（〜640px）とタブレット（641〜1023px）のレイアウトは無変更です。

## 監査修正（v0.8.1、2026-11-24）
全ルートの再検証（Zaphod の現行 /api/state との差分ゼロ、全26件の契約・見積もりを
ライブ再確認、OSAK ルーターの送信履歴は依然 0 件で警告文は正確）を受けた堅牢化です。
送信の組み立て（送信先・コールデータ・付随させる値）は無変更で、検証と表示の修正のみ：
- 到着ウォッチの保存データは形を検証してから使い、描画は textContent のみに
  （localStorage 由来データの innerHTML 挿入を廃止）。送信量の表示は送る側の
  小数桁で整形するよう修正（6桁→18桁ルートで桁がずれていた）。
- 見積もりの競合対策（チェーン/トークン切替中に古い残高が画面と状態を上書きしない）。
- 送信時の再検証を完全化：最大量・quoteBridge・ルーターの token() 一致・残高・
  QL1 ワープの構造を送信直前にも確認。ゼロアドレス宛は送信不可に。
- 読み取り失敗を 0 と表示しない（空応答は「不明」として扱う）。RPC に
  15 秒のタイムアウトを追加。受信確認が時間切れの場合は「送りました」と
  表示せず、未確認であることを正直に表示。
- esbuild を 0.25.12 に更新（開発時のみの脆弱性 GHSA-67mh-4wv8-2f99 対策）。

## 見積もり変化チェック（v0.8.2、2026-11-24）
監査の判断事項1件（ユーザー承認済み）の実装です。BridgeRouter ルートでは、
送信直前の再見積もりで得た「受け取る量」が、画面で確認した見積もりの
「受け取る量」と 1 単位でも違ったら、承認・署名の前に送信を中止し、
新しい見積もりを表示して「確認してもう一度押してください」と伝えます。
これらのルートは固定手数料（定額または 0）なので、同じ金額に対する
受け取り量はルーターの手数料設定だけで決まります。差が出るのは設定が
変わったときだけであり、誤検出の余地がないため、許容幅なしの完全一致で
比較します。画面の見積もりが今の金額・ルートに対するものではない場合
（見積もり表示後に入力を変えた等）も、古い表示のまま送らず、見積もりを
更新して再押下を求めます。QL1 ワープルートには quoteBridge がなく、
受け取り量は送信量の 1:1 換算（手数料 0）で変化のしようがないため、
このチェックの対象外です（送信直前の構造確認は従来どおり実施）。
送信の組み立て自体（送信先・コールデータ・付随させる値）は無変更です。

## ウォレット切断ダイアログ（v0.9.0、2026-11-25）
QOM DEX（qomdex.com）と操作を統一しました。接続中にヘッダーの
「接続中: 0x…」チップを押すと小さなダイアログが開き、接続中の
アドレス全文と「接続を解除」ボタンを表示します。解除時は、対応
ウォレットには `wallet_revokePermissions`（`eth_accounts`）で
サイトの許可取り消しを先に依頼し（非対応ウォレットではエラー
を無視）、その後ローカル状態をクリアします。このサイトは接続
状態を保存せず、接続は常に明示的なボタン操作でのみ行うため、
解除後に再読み込みしても勝手に再接続しません。解除後は残高・
見積もり表示もクリアされます（v0.8.1 の切断時挙動と同じ経路）。
ダイアログは ✕ ボタン・背景タップ・Esc で解除せずに閉じられます。

## QL1 チェーンロゴ（v0.9.1、2026-11-25）
QL1 を表す箇所（From／To のチェーンピルのアイコン）に、QL1 の
イーグルロゴ（円形 PNG、`src/ql1-logo.png`、256×256）を使うように
しました。従来の「Q」の文字アバターと同じ 30px の円形スロットに
表示され、レイアウトは変わりません。他チェーンの文字アバターと
トークンのアイコンは従来どおりです。

## 42 Chain チェーンロゴ（v0.9.2、2026-11-25）
42 Chain を表す箇所（From／To のチェーンピルのアイコン）にも、
42 Chain のロゴ（円形 PNG、`src/chain42-logo.png`、256×256）を
使うようにしました。QL1 ロゴと同じ円形スロット・同じ仕組みで、
BSC（B）と Ethereum（Ξ）の文字アバター、トークンのアイコンは
従来どおりです。

## BSC・Ethereum チェーンロゴ（v0.9.6、2026-11-25）
BSC と Ethereum を表す箇所（From／To のチェーンピルのアイコン）にも、
各チェーンのロゴ（円形 PNG、`src/bsc-logo.png`／`src/eth-logo.png`、
256×256）を使うようにしました。QL1・42 Chain と同じ円形スロット・
同じ仕組みで、これで4チェーンすべてにロゴがそろいました。トークンの
アイコンと、見積もり・送信の仕組みは従来どおりです。

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
- **Wallets**: `window.ethereum` only (MetaMask, FoxWallet EVM mode, …),
  with automatic switch/add for all four chains. Since v0.9.3 the wallet
  examples named anywhere in the site copy and this README are generic
  only (MetaMask / FoxWallet); a unit-test guard keeps it that way.
  Since v0.9.4 the Connect buttons (header + full-width action-area)
  are always visible while disconnected, even when no provider exists
  at page load: detection happens at click time (`window.ethereum` is
  read fresh on every Connect click, and an `ethereum#initialized`
  listener wires up provider events for late injections, as wallet
  in-app browsers often inject only after load). The no-wallet
  guidance card appears only after a Connect click found no provider,
  and it never hides the Connect buttons. Since v0.9.0 the
  connected chip in the header opens a wallet dialog (full address +
  Disconnect), mirroring the QOM DEX frontend: disconnect first asks the wallet
  to revoke this site's `eth_accounts` permission via
  `wallet_revokePermissions` where supported (errors ignored), then clears the
  local state. The site never auto-reconnects — connection is explicit-only and
  no "was connected" state is persisted, so a reload after disconnect stays
  disconnected. Since v0.9.1 the QL1 chain pill icon shows the QL1 eagle logo
  (circular PNG, `src/ql1-logo.png`) instead of the "Q" letter avatar, in the
  same 30px circular slot; other chains' letter avatars and the token icons
  are unchanged. Since v0.9.2 the 42 Chain pill icon likewise shows the
  42 Chain logo (`src/chain42-logo.png`, circular crop of the black-square
  artwork) instead of the "42" letter avatar. Since v0.9.6 the BSC and
  Ethereum pill icons likewise show their chain logos (`src/bsc-logo.png`,
  `src/eth-logo.png`, circular PNGs) instead of the "B" / "Ξ" letter
  avatars, so all four chains now carry logo marks; token icons and the
  quote/send mechanics are unchanged.
- **Routes**: QL1 ⇄ 42 Chain (QOM, BABY, CAW, FATHER, HAWK, KET, O, OSAK),
  42 Chain ⇄ BSC (USDT, USDC), 42 Chain ⇄ Ethereum (USDT/USDC at 6 decimals on
  the Ethereum side, WBTC at 8). Amount chips 25/50/75/MAX, editable recipient,
  a pre-send quote panel (bridge fee, fresh messaging fee, min/max, estimated
  receive), and an arrival watch (destination mailbox `delivered(messageId)` +
  recipient balance) that persists in localStorage and resumes after reload.
- **Send mechanics**: BridgeRouter chains approve the token to the BridgeRouter
  and call `transferRemote` with `value = quoteNative(dst, "0x").totalNative`
  re-quoted at send time. Since v0.8.2 the send also passes a quote-drift gate:
  if the fresh send-time receive amount differs at all from the figure the user
  reviewed on screen (fixed-fee routes, so any difference means the router's
  fee parameters changed), the send aborts before approval/signing, shows the
  new quote, and asks the user to press send again; the same happens when no
  reviewed quote covers the exact current route/token/amount. QL1 warp routes
  have no `quoteBridge` (receive is the sent amount scaled 1:1, fee 0 — nothing
  can drift) and are covered by their send-time structural re-check instead.
  QL1 has no BridgeRouter: approve to the Hyperlane warp
  router and call `transferRemote` with value 0 (verified on sampled real sends).
  Exception: BSC/Ethereum as the SOURCE (toward 42 Chain) — their routers are
  older versions (1.1.0 / 1.2.0) whose `quoteNative` reverts, so, exactly like
  the official frontend, the messaging fee falls back to 0 and the send uses
  value 0 ("nativeOptional"; verified on-chain 2026-10-30 for the wallet app v2).
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
- **Disabled routes: none (26/26 — full Zaphod parity; user decision
  2026-11-07).** Two evidence notes instead of disables: (1) BSC/Ethereum ->
  42 Chain inbound routes are enabled with the nativeOptional behaviour above
  (deliveries proven — 159 BSC-origin and 116 Ethereum-origin in Zaphod's
  stats at 2026-10-30; an earlier build, <= v0.3.0, disabled them by mistake
  and v0.4.0 fixed that). (2) OSAK from 42 Chain to QL1 is enabled WITH an
  unproven-route warning (zero sends in that direction in the router's whole
  history; QL1->42 Chain OSAK is proven, 2/2 sampled). The DEX aggregator
  keeps its own OSAK-disabled rule — different product, unchanged.
- **First real send: done (2026-11-25).** 3 USDT was sent from BSC to
  42 Chain through this site and confirmed arrived (BSC tx 0x84c9…ee15;
  42 Chain arrival tx 0x3af5…a5f), completing the end-to-end check.
  Read/quote verification covers all routes; still start with a small
  amount on your own first send.
