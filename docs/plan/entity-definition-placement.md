# entity 定義モジュールの置き場所・読み込み方式・CON 規約（計画）

## 背景

client(browser) 対応（`docs/discuss/browser-js.md`、Phase 2 以降は `docs/plan/browser-js-roadmap.md`）に
向けてディレクトリ構成を確定する前提として、**entity 関数定義の (a) 置き場所、(b) 読み込み方式、
(c) CON 受け渡し規約**の 3 点を刷新する。

### 現状（＝置き換え対象）

1. **文字列処理による発見**: entity の発見は
   `core/codegen0/src/codegen0/{namespace,module}/list_entity_functions.ts` による
   **テキスト正規表現スキャン**。単一ファイル（`entityDefinitionsFile`、既定 `${rootDir}/root/_yatt.entity.ts`）を
   `readFileSync` して `export function NAME` を拾い `entFns = {name: true}` を作るだけ
   （`namespace/generate.ts:52-59`）。**関数の形（CON を取るか / async か）を一切保持しない**。
2. **一律 `.apply(CON, [args])` 呼び出し**: `widget/entity/generate.ts:61` が全 entity を無条件に
   `${entFnPrefix}.NAME.apply(CON, [args])` で呼ぶ（**唯一の呼び出し生成箇所**）。これは
   「`this` を使うか否かに関係なく一律に呼べる」から成立していた ＝ **`this: Connection` 規約の存在理由**。
   `find_entity`（`part-finder/find.ts:131-143`）も `entFns[name]` の**有無しか見ない**。
3. **`this: Connection` 規約**: entity は `param(this: $yatt.runtime.Connection, name)` のように
   CON を `this` で受け、本体は `this.request…` で参照。呼び出し側は `.apply(CON, [...])` で `this` を束ねる。
4. **module/populator では entity ロードがコメントアウト**のまま（`module/generate.ts:44-49`）。
5. **共有 entity と target 専用 entity の混在**: `adapter/gas-clasp/runtime/_yatt.entity.ts` が実例。
   `param(this: Connection, name)`（共有可能）と `getUrl()`/`sheetNames()`/`getSSName()`
   （`ScriptApp`/`SpreadsheetApp` を使う **server(GAS)専用**、browser では動かない）が同居している。

### やりたいこと（user 確定）

1. **CON 規約の統一（`this: Connection` 廃止）**: entity は **第1 positional 引数 `CON: Connection` を
   明示したときのみ CON を渡す**規約に**全スタイル共通**で統一する。`this: Connection` 特殊引数は
   **廃止**。当初 gas-clasp 以外に適用予定だったこの方針を、**gas-clasp / namespace にも適用**する。
2. module/populator/namespace/browser のいずれでも、テキスト正規表現をやめ
   **公式 TypeScript コンパイラの `ts.createSourceFile()` による静的 AST 解析**に切り替え、
   各 export 関数の `EntFnMeta`（CON を取るか / async か / target）を得る。
3. **特定ディレクトリから `*.ts` を自動ロード**する仕組みにする（module/populator/browser）。
4. **共有（server/browser 兼用）** と **厳格分離（混同不可）** の両ケースを扱う。

## 確定した方向性（user 回答）

### A. CON 規約 = 統一（positional `CON`、`this:` 廃止）
- entity 関数が CON を必要とするなら **第1 positional 引数を `CON`（型は `Connection`、既定名。
  `connectionTypeName` で可変）** として宣言する。これは既に widget/action が CON を受け取る形
  （`implicitArgs` の先頭 `CON`）と**完全に一致**し、entity も「CON を先頭で受ける普通の関数」に揃う。
- `this: Connection`（および本体の `this.` 参照による CON アクセス）は**廃止**。
- **検出規則**: `takesCON = (第1 positional 引数の識別子 === 'CON')`。型注釈・本体の `this` 参照は見ない。
  → 旧 plan の「toString は `this:` を消すので本体の `this` 参照で推測…」という**注意は不要になり削除**。

### B. 区別の仕組み = preset で両対応
`core/codegen0/src/project/layout.ts` の既存 `endpoint`/`role-split` preset を再利用
（Phase 1 の client-entry 配置と一貫させ、両チームスタイルを温存）。
- **`endpoint`（svelte 風 `+` マーカー、co-located・フォルダ scope）**:
  ```
  public/
    index.yatt
    +entity.ts          # 共有（server/browser 兼用）
    +entity.server.ts   # server 専用
    +entity.client.ts   # browser 専用
  ```
- **`role-split`（専用ディレクトリ、プロジェクト全体ライブラリ）**:
  ```
  public/ index.yatt
  entities/             # 直下 = 共有
    server/  ...        # server 専用
    client/  ...        # browser 専用
  ```
  配下の `*.ts` を再帰的に自動ロードし、root(サブdir) で target をタグ付け。

### C. 越境参照はコンパイルエラー
server 専用 entity を browser(`js:`)文脈から（およびその逆）参照したら codegen 時に hard error。
共有 entity は両 target から可視。

## 設計の核: 置き場所(=target) と静的 AST ローダーは一体

置き場所は entity の **target** を決める。ローダーは各モジュールを **`ts.createSourceFile()` で
静的にパース**（**実行しない**）し、各 export 関数を AST から解析して **target タグ付きで拡張 `entFns`
に登録**する。この metadata が (a) 共有/分離の**強制**、(b) **呼び出し形の決定**（`takesCON` で
CON を渡すか、`isAsync` で `await` するか）を可能にする。マーカー方式 / 専用dir方式は
**発見方法だけが違い**、ローダーと metadata は共通。

### なぜ `ts.createSourceFile()` か（前回の結論）
- **実行しない**ので、browser 専用モジュール（top-level で DOM グローバル参照・browser 専用 import が
  あっても）を**安全に解析できる**。＝「browser 用モジュールは Deno で `import()` 出来ない」問題を回避。
  旧案の `import()`+`toString()` および esbuild fallback は**不要**。
- **新規依存ゼロ**。`typescript` は既に依存（`core/codegen0/package.json`）で、`utils/compileTs.ts:67`
  で既に `ts.createSourceFile()` を使用済み。型チェッカ（`createProgram`）不使用の**パースのみ**なので高速。
- `export const NAME = (CON, …) => {}` の arrow/const 形式も統一的に拾える。
- `import()`+`toString()` は「import-safe と分かっている shared/server モジュールの**任意クロスチェック**」に
  降格（必須機構ではない）。

### `entFns` metadata 拡張
- 現: `entFns: {[k: string]: any}`（`core/codegen0/src/declaration/context.ts` の `BuilderSettings`、値は `true`）。
- 新: `entFns: {[k: string]: EntFnMeta}`、
  `EntFnMeta = { target: 'shared'|'server'|'client', takesCON: boolean, isAsync: boolean, sourceFile: string }`。

## 実装ステップ

### 1. 静的 AST ローダー（新規）
- `core/codegen0/src/codegen0/entity/load-entity-fns.ts`（実行ビット付き CLI）。
  - 入力: entity モジュールのパス群（+各々の target タグ）。
  - `import ts from 'npm:typescript'` → `ts.createSourceFile(file, src, ScriptTarget.Latest, false)`。
    top-level statement を走査:
    - `ts.isFunctionDeclaration` + `export` 修飾 + `name` あり → entity。
    - `ts.isVariableStatement` + `export` + 初期化子が arrow/function → entity（const 形式）。
  - 各 entity から:
    - `isAsync = modifiers に AsyncKeyword`
    - `takesCON = (parameters[0]?.name.getText() === 'CON')`
    - `name`, `sourceFile`, `target`（置き場所から）
  - `{name: EntFnMeta}` を返す。**regex 版 `list_entity_functions.ts`（namespace/module 双方）は撤去**。
- CLI: `load-entity-fns.ts <entity.ts>...` で metadata マップを JSON 出力（目視確認用）。

### 2. 発見（discovery）を preset で
- `core/codegen0/src/project/layout.ts` + `config.ts` に entity 用フィールドを追加:
  - `entityMarker?: string`（既定 `"+entity"`。マーカー方式。target は infix `.server`/`.client`、無印=共有）
  - `entityDirs?: string[]`（ディレクトリ方式。既定 `["entities/"]`。`server/`・`client/` サブdir=target 別、
    直下=共有）
  - 既存 `applyProjectStyle` / `extractProjectStyle` の prefix 合成・trailing-slash 正規化に合わせる。
- preset を更新:
  - `"endpoint"`: `entityMarker: "+entity"`（co-located・フォルダ scope）。
  - `"role-split"`: `entityDirs: ["entities/"]`（プロジェクト全体ライブラリ）。
- スキャンは既存 client-entry 発見（`adapter/gas-clasp/build.ts` の glob、
  `core/codegen0/example/deno_serve/01_client/server.ts` の `readdirSync(recursive)`）と同型のヘルパで実装。
  マーカー方式はフォルダ単位、dir 方式は再帰。

### 3. 呼び出し形の統一（全スタイル、`widget/entity/generate.ts`）
唯一の生成箇所 `widget/entity/generate.ts:61` を **metadata 駆動の positional CON** に差し替える:
- `.apply(CON, [args])` を廃止し、
  - `takesCON` → `NAME(CON, ...args)`（引数無しなら `NAME(CON)`）
  - `!takesCON` → `NAME(...args)`
- `isAsync` の entity は呼び出しに `await` を付す（server 現状は非 async 前提のため当面は no-op、
  browser/`js:` Phase 2 で本格化）。
- `$this.`（template-local entity、`entitySpec.template === ctx.template` かつ `ctx.hasThis`）/
  `entFnPrefix().` の前置ロジックはそのまま。**注意: この `hasThis`/`$this` は「ハンドラオブジェクト
  `$this`」であって CON とは無関係**。今回の `this: Connection`(=CON) 廃止とは別物なので触らない。
- `find_entity`（`part-finder/find.ts:131-143`）: `entFns[name]` の **`EntFnMeta` を返す**ように拡張。
  template-local entity（`partMap.entity`）の metadata は宣言から導出（既定 `takesCON: true`）。

### 4. codegen 配線（module / populator / namespace）
- `codegen0/{module,populator}/generate.ts`: `list_entity_functions` 呼び出しを新ローダーに差し替え、
  `session.entFns` に metadata マップを格納。`module/generate.ts` のコメントアウトを新ローダーで有効化。
- `codegen0/namespace/generate.ts`: **regex → 新ローダー（AST）に差し替え**（`takesCON`/`isAsync` を得るため）。
  - namespace は単一ファイル（`entityDefinitionsFile`）発見のまま。**自動ディレクトリロード・target 概念・
    client target は適用しない**（GAS は server 専用・静的名前空間解決で足りる。target は `'server'` 固定扱い）。
  - ※「namespace 完全無変更」は撤回。**発見は単一ファイル維持だが、パーサは AST 化し、呼び出し形は
    positional CON に統一される**（＝gas-clasp の生成 `.apply(CON,[…])` → `NAME(CON,…)`/`NAME(…)` に変化）。
- `codegen0/widget/entity/generate.ts`: **越境チェック（コンパイルエラー）**。現行 codegen target（server）から
  `target:'client'` の entity を参照したら `ctx.token_error`。共有は許可。
  （browser→server の逆方向は Phase 2 の `js:` 実装時に有効化。）

### 5. 既存 entity 定義の移行（`this: Connection` → `CON: Connection`）
規約統一に伴い、リポジトリ内の entity 関数を機械的に書き換える（**検証に必要なので今回スコープ内**）。
`this:` を第1引数に持つ **entity 関数のみ** が対象。**`Connection` 自身のメソッド定義
（`append(this: Connection, str)` 等）は本当の `this` なので対象外**。
- スコープ内（gas-clasp、今回の検証に使用）:
  - `adapter/gas-clasp/runtime/_yatt.entity.ts`: `param(this: $yatt.runtime.Connection, name)` →
    `param(CON: $yatt.runtime.Connection, name)`、本体 `this.request` → `CON.request`。
    `getUrl`/`sheetNames`/`getSSName` は CON 不要のまま（`takesCON:false`）。
  - `adapter/gas-clasp/example/basic/root/.htyattrc.ts`: `param(this: yatt.Connection, name)` → `CON:`。
- 別課題として追随（express adapter 修復とセット。現状 express の build は bit-rot 中）:
  - `adapter/express/example/{basic,basic2,basic3}/…/.htyattrc.ts` の
    `export function param/query/req(this: Connection, …)` → `CON:`。
    同ファイルの `append`/`appendUntrusted`（Connection メソッド）は**変更しない**。

### 6. tsconfig 分割の位置づけ（設計メモ、必要なら生成）
- マーカー/dir とも、共有+server（DOM 抜き）／共有+client（DOM 有り）の 2 tsconfig を対象化できる。
  Phase 1 の `_yatt.client.tsconfig.json`（write-if-missing）と同方針。今回は配管優先、生成は最小限。

### 7. browser target は Phase 2 に接続
- `target:'client'` entity の**タグ付け・可視性・越境エラー**は今回入れるが、実際に browser 用コードを
  emit するのは Phase 2（`js:` namespace codegen、buffer-CON IIFE。`docs/plan/browser-js-roadmap.md`）。
  今回はその足場を server 側で先に通す。

## 検証（実行可能 CLI 活用）

- `load-entity-fns.ts <entity.ts> ...` を直接実行し、`{name:{target,takesCON,isAsync}}` を目視確認。
  - サンプル: `getUrl`（server, no-CON, sync）/ `param(CON,name)`（CON 有り）/ `coalesce(a,b)`（shared, no-CON）。
- `module/generate.ts` / `populator/generate.ts` / `namespace/generate.ts` を、entity を持つテンプレフォルダに
  対し直接実行し、`&yatt:foo;` が新ローダー経由で解決され、**呼び出し形が `.apply(CON,[…])` から
  positional（`NAME(CON,…)` / `NAME(…)`）に変わっている**ことを確認。
- **越境エラーの負テスト**: server 文脈から `target:'client'` entity を参照 → コンパイルエラーになること。
- `populator/runner.ts` で実レンダリングし、共有 entity（`param(CON,…)`）が動くことを確認。
- **回帰の期待差分**: 従来 `.apply(CON, [a])` を含む出力は `NAME(CON, a)`（または `NAME(a)`）へ変化する。
  namespace 出力も**この呼び出し形だけ変化**する（それ以外は不変）。スナップショットがあれば更新。
- 回帰: 各パッケージ `deno test -RE`（`core/codegen0`, `core/lrxml`, `util/xhf`）。

## スコープ外 / 継続

- `js:` browser widget codegen 本体（Phase 2）と評価タイミング境界（Phase 3）。→ `browser-js-roadmap.md`。
- 実プロジェクト（uktool2 等）の適用・書き換えは user 側。yatt-js は配管と検証まで。
- express adapter 修復（別課題）。express example の `this:`→`CON:` 移行はこの修復とセットで行う。
