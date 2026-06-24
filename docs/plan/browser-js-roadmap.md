# client(browser) 側対応 ロードマップ（Phase 2 以降）

## 背景

`docs/discuss/browser-js.md` の議論を起点に、client(browser/worker) 側対応を段階的に進める。
ユーザ確認で確定した方向性:

1. browser widget の compile は **buffer-CON 再利用**（CON モデルを捨てない）。
2. ディレクトリ構成は **layout.ts の preset で両対応**（唯一解に絞らない）。
3. transpile/bundle は **yatt 内蔵で薄く**（esbuild。vite/React は当面コア外）。
4. 最初の prototype は **client TS の transpile/bundle 配管**。

このうち 4 を **Phase 1 として実装・コミット済み**（commit `950a9db`）:

- `core/codegen0/src/client/bundle.ts` — esbuild ラッパ（dynamic import）。`InlineSink`（JS 文字列）/
  `FileSink`（ファイル出力）。単体 CLI。
- `core/codegen0/src/project/layout.ts` + `config.ts` — client source フィールド
  （`clientDirs`/`clientExt`/`bundleOutDir`）と preset `endpoint`/`role-split`。
- `adapter/gas-clasp/build.ts` — `*.client.ts` を bundle し `$yatt.clientBundle$`（`staticMap$` と同型）を
  生成。テンプレは `<script><?yatt CON.append($yatt.clientBundle$.x) ?></script>` で inline。
  `</script` を narrow escape。DOM lib の `_yatt.client.tsconfig.json` を write-if-missing で生成。
- `core/codegen0/example/deno_serve/01_client` — populator + FileSink（`/_dist` 配信）のデモ。

本ドキュメントは **Phase 2 以降** の計画。

---

## 読み解き結果（既にある足場 / 再利用可能性）

調査により、Phase 2（browser で yatt widget を動かす）は機構面で想定より近いことが判明している。

### parser は既に multi-namespace 対応
- `core/lrxml/src/config.ts`: `namespace: string[]`（既定 `["yatt"]`）。
- `core/lrxml/src/template/tokenize.ts`: タグ正規表現は `ns.join("|")` で生成（namespace を増やせば追従）。
- `core/lrxml/src/template/parse.ts`: タグ名を `path = name.split(/:/)` で分解（`['js','func']` 等）。
- entity（`core/lrxml/src/entity/parse.ts`）・宣言（`core/lrxml/src/multipart/`）も同様に namespace 汎用。
- **`<script>` の中身は raw 扱いではなく通常パースされる**（実証: uktool2 `index.yatt` の `<script>` 内で
  既に `&yatt:is_dialog;` が機能）。→ `<js:...>` を `<script>` 内に書くための tokenizer 変更は不要。

→ **結論: `js:` namespace の認識は `namespace` 配列に `"js"` を足すだけ**でほぼ済む。

### CON モデルと buffer-CON
- widget は CON ストリームへ書き込む `void` 関数（`render_*`）。CON は暗黙引数として全所に焼き込み
  （`widget/generate.ts`、`widget/element/generate.ts` の `implicitArgs=['CON']`、
  `template_context/print.ts` の `CON.append`/`appendRuntimeValue`、`macro/if.ts`・`macro/foreach.ts`）。
- **buffer 版 Connection が既に存在**: `core/codegen0/src/codegen0/populator/runner.ts:59-71`
  （`append/appendUntrusted/appendRuntimeValue` を文字列 buffer に貯め、`render_(CON,..)` 後に
  `return CON.buffer`）。

→ **結論: widget を「文字列を返す関数」に作り変える必要はない**。`js:` 呼び出し境界で buffer-CON を作る
IIFE に compile すれば既存機械を全再利用できる。

### entity / escape は環境非依存
- entity は値を返す純関数（`core/codegen0/src/codegen0/entity/generate.ts`）。browser でもそのまま再利用可。
- `core/codegen0/src/yatt/runtime.ts` の `escape` は環境非依存。

---

## Phase 2: `js:` namespace の browser widget codegen

目標（`docs/discuss/browser-js.md` より）:
```js
function create_survey_button(survey) {
  const li = document.createElement('li')
  li.innerHTML = <js:survey_button survey/>;   // 宣言済み widget 呼び出し
  return li
}
```
および無名インライン:
```js
li.innerHTML = <js:function survey> ...html... </js:function>;  // IIFE 生成
```

### 設計（buffer-CON 再利用）
`<js:...>` は HTML 出力ではなく **JS 式（文字列を返す）** として展開する:
```js
(() => { const CON = $yatt.runtime.newBuffer();
         $this.render_survey_button(CON, {survey}); return CON.toString() })()
```
- doc の問い「browser で CON が役立つか？」への答え: **CON は内部機構として残し、`js:` 境界で文字列を露出**。
- 利点: 1 つの widget 定義が server(CON 直書き) でも browser(buffer 経由) でも使える＝ **write once, target both**。

### 実装ステップ
1. **parser**: `namespace` に `"js"` を追加できるようにする（config 既定 or テンプレ単位）。コード変更ほぼ不要。
2. **runtime**: `$yatt.runtime.newBuffer()`（buffer-CON ファクトリ。`populator/runner.ts:59-71` を runtime 化）。
3. **call-site codegen**: `core/codegen0/src/codegen0/widget/element/generate.ts` の呼び出し生成に
   `js:` 分岐を追加し、上記 IIFE を **式コンテキスト**で出力する（現状は文コンテキストで `CON.append(...)`）。
   - 式コンテキスト判定: `<js:...>` が `<script>` 本文（= 生 JS テキスト）の中に現れる点を利用。
4. **無名 widget**: `<js:function args>...</js:function>` を、その場で定義した buffer-CON IIFE に変換。
5. **browser codegen target**: 呼ばれた widget/entity を browser 向けに emit する出力経路を、既存
   namespace/module/populator の隣に追加（cgenStyle に `'browser'` 系を足す or sub-target 化）。
   - 出力先は Phase 1 の sink（GAS=InlineSink / その他=FileSink）に流す。

### 留意（要設計）
- widget 宣言に **target 区別の構文**（client / server / both）。既定 target-agnostic、例外をマーク。
- browser 用に必要な widget/entity の **依存閉包**を求めて同梱する（cross-widget 呼び出しの解決）。
- 生成 JS のサイズ／重複（複数 `js:` 呼び出しで同 widget を使う場合の共有）。

---

## Phase 3: 評価タイミング境界モデル（中核研究課題）

Phase 2 の最大の難所は codegen 機構ではなく **「いつ・どこで評価されるか」**。doc の例が示す:

- `onclick_handler` entity は **browser 実行時**に survey ごとに走る → browser へ emit して同梱。
- 同じ本体内の `&yatt:is_dialog;` は **server render 時**に確定する値。
- すなわち **server-time 値が browser-time コードに埋め込まれる**境界が同居しうる。

### 論点
1. **評価フェーズの型付け**: 各 entity / 変数を server-time / browser-time / 両対応 に分類するモデル。
2. **server→client 値の受け渡し**: Phase 1 のデモでは `window.__UKTOOL__ = {is_dialog: &yatt:is_dialog;}`
   のように server で global を render → browser bundle が読む、という手当てで回避した。これを yatt の
   構文・規約として整理するか（例: `<js:...>` 呼び出しに server 値を引数で渡す）。
3. **宣言構文**: widget/entity の target と、引数の評価フェーズを宣言する記法。
4. **デバッグ性**: server では CON へ逐次出力する設計がエラー追跡を助けた。browser でも同等の追跡性を
   どう保つか（buffer-CON でスタック位置を保てるか）。

この Phase は実装より先に設計議論を要する（`docs/discuss/` で詰める）。

---

## その後の課題（独立 / 将来）

- **express adapter の修復**: `adapter/express/src/build.ts` は現在壊れている（`generate_*` の
  `Promise<TranspileOutput>` を await せず `.template`/`.outputText` を参照）。client 対応とは独立に要修復。
  当面は populator `deno_serve` を優先。
- **layout の target matrix 一般化**: 現状の cgenStyle 選択を
  `target(server/browser/webworker/cloudflare) × codegen × runtime × tsconfig lib × sink` へ拡張し、
  `project/layout.ts` をその home に育てる（複数 platform を 1 プロジェクトで）。
- **`<script>` 内 TS の直書き transpile**: テンプレの `<script>` に TS を書き、transpile 結果を元の
  `<script>` に書き戻す sink（Phase 1 の `.client.ts` 分離方式とは別経路）。
- **vite/React 等の外部枠組み委譲**: やるなら「委譲」。複雑さとのトレードオフを見極めてから。
- **`internTemplateRuntimeNamespace` 自動命名**: rootDir 定義・推奨ディレクトリ構成の確定待ち（継続課題）。

---

## 検証方針

- 各 generator/bundler は実行ビット付き単体 CLI（`docs/dev/runnable-modules.md`）。直接実行で目視確認。
- Phase 2 の検証ゴール: uktool2 の `create_survey_button` 相当を `<js:survey_button>` 化し、
  `<script>` から呼べること（Phase 1 で TS 化・bundle 済みのコードと統合）。
- 回帰は各パッケージ `deno test -RE`（`core/codegen0`, `core/lrxml`, `util/xhf`）。
- 既存 namespace/module/populator 生成を壊さないこと（target 追加は加算的に行う）。
