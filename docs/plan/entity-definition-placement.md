# entity 定義モジュールの置き場所と読み込み方式（計画）

## 背景

client(browser) 対応（`docs/discuss/browser-js.md`、Phase 2 以降は `docs/plan/browser-js-roadmap.md`）に
向けてディレクトリ構成を確定する前提として、**entity 関数定義の置き場所と読み込み方式**を刷新する。

### 現状（＝置き換え対象の「文字列処理」）

- entity の発見は `core/codegen0/src/codegen0/{namespace,module}/list_entity_functions.ts` による
  **テキスト正規表現スキャン**。単一ファイル（`entityDefinitionsFile`、既定 `${rootDir}/root/_yatt.entity.ts`）を
  `readFileSync` して `export function NAME` を拾い、`entFns = {name: true}` を作るだけ
  （`namespace/generate.ts:52-59`）。**関数の形（CON を取るか / async か）を一切保持しない**。
- その結果 `widget/entity/generate.ts:61` は全 entity を無条件に
  `${entFnPrefix}.NAME.apply(CON, [args])` で呼ぶ。`find_entity`（`part-finder/find.ts:131-143`）も
  `entFns[name]` の**有無しか見ない**（見つかれば name 文字列を返すだけ）。
- `module/generate.ts` では entity ロードが**コメントアウト**されたまま（`module/generate.ts:44-49`）。
- 実例 `adapter/gas-clasp/runtime/_yatt.entity.ts` が混在問題を示す:
  - `param(this: $yatt.runtime.Connection, name)` … `this`(=CON) を使う共有可能な entity。
  - `getUrl()` / `sheetNames()` / `getSSName()` … `ScriptApp`/`SpreadsheetApp` を使う **server(GAS)専用**。
    browser では動かない。共有 entity と target 専用 entity が同じファイルに同居している。

### やりたいこと（user 確定）

1. module/populator/browser スタイルでは、テキスト処理をやめ **`await import()` でモジュール実体を
   ロード → 各関数を `toString()` して宣言解析**（CON 引数の有無 / async の有無）に切り替える。
   **namespace スタイルは変更不要**（全 entity が 1 つの `namespace $yatt {…}` に畳まれ tsc が静的解決するため）。
2. **特定ディレクトリから `*.ts` を自動ロード**する仕組みにする。
3. **共有（server/browser 兼用）** と **厳格分離（混同不可）** の両ケースを扱う。

## 確定した方向性（user 回答）

- **区別の仕組み = preset で両対応**（`core/codegen0/src/project/layout.ts` の既存 `endpoint`/`role-split`
  preset を再利用。Phase 1 の client-entry 配置と一貫させ、両チームスタイルを温存）。
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
- **越境参照はコンパイルエラー**。server 専用 entity を browser(`js:`)文脈から（およびその逆）参照したら
  codegen 時に hard error。共有 entity は両 target から可視。

## 設計の核: 置き場所（=target）と introspection ローダーは一体

置き場所は entity の **target** を決める。ローダーは各モジュールを `import()` し、各 export を
`toString()` で解析して、**target タグ付きで拡張 `entFns` に登録**する。この metadata が
(a) 共有/分離の**強制**を可能にし、(b) browser/`js:` target で正しい呼び出し形（buffer-CON IIFE、`await`）
を選べるようにする。マーカー方式 / 専用dir方式は**発見方法だけが違い**、ローダーと metadata は共通。

### `entFns` metadata 拡張
- 現: `entFns: {[k: string]: any}`（`core/codegen0/src/declaration/context.ts` の `BuilderSettings`、値は `true`）。
- 新: `entFns: {[k: string]: EntFnMeta}`、
  `EntFnMeta = { target: 'shared'|'server'|'client', takesCON: boolean, isAsync: boolean, sourceFile: string }`。

### introspection の注意（実装時の判断点）
- `toString()` は**トランスパイル後**の関数に効く。TS 専用の `this: Connection` 第一引数は実行時に
  消えるため、`param(this: Connection, name)` は実行時 `function param(name)` になる。よって
  **「CON を取る」判定**は「第一 positional 引数が `CON`」or「本体が `this` を参照」で行う。信頼度重視なら
  **トランスパイル前ソースの `this:` 第一引数**を併用。`async` キーワードはトランスパイル後も残るので確実。
- codegen は Deno 上で走るため、**browser 専用モジュールは Deno で import-safe** である必要がある
  （DOM は関数本体での参照なら可＝`toString()` は実行しない。ただし module top-level の DOM グローバル
  参照は不可）。import 不能なモジュールは esbuild で transpile → パースする fallback にする。

## 実装ステップ

### 1. introspection ローダー（新規）
- `core/codegen0/src/codegen0/entity/load-entity-fns.ts`（実行ビット付き CLI）。
  - 入力: entity モジュールのパス群（+各々の target タグ）。
  - `populator/loader.ts` の `importTypescript` / `textToBase64`（`data:text/typescript;base64,` import）を
    再利用。相対 import 等を含む場合は実ファイル `import(pathToFileURL(fn))` も許容。
  - 各 export 関数を `toString()` 解析（`async`、第一引数 `CON`）して `EntFnMeta` を構築、
    `{name: EntFnMeta}` を返す。
  - `list_entity_functions.ts`（regex 版）は **module/populator では置換**、**namespace では現状維持**。
- CLI: `load-entity-fns.ts <+entity.ts>...` で metadata マップを JSON 出力（目視確認用）。

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

### 3. codegen 配線（module / populator、server target）
- `codegen0/{module,populator}/generate.ts`: `list_entity_functions` 呼び出しを新ローダーに差し替え、
  `session.entFns` に metadata マップを格納。`module/generate.ts` のコメントアウトを新ローダーで有効化。
- `part-finder/find.ts` の `find_entity`（131-143）: `entFns[name]` の **metadata を返す**ように拡張。
- `codegen0/widget/entity/generate.ts`: metadata を使い
  - **越境チェック（コンパイルエラー）**: 現行 codegen target（server）から `target:'client'` の entity を
    参照したら `ctx.token_error`。共有は許可。（browser→server の逆方向は Phase 2 の `js:` 実装時に有効化。）
  - （将来）`takesCON` / `isAsync` で呼び出し形を選択。当面 server では現行 `.apply(CON,[...])` を維持。

### 4. namespace スタイル
- **無変更**。`list_entity_functions.ts`（regex）と単一 `entityDefinitionsFile` のまま。
  target 概念・自動ディレクトリロードは適用しない（静的名前空間解決で足りるため）。

### 5. tsconfig 分割の位置づけ（設計メモ、必要なら生成）
- マーカー/dir とも、共有+server（DOM 抜き）／共有+client（DOM 有り）の 2 tsconfig を対象化できる。
  Phase 1 の `_yatt.client.tsconfig.json`（write-if-missing）と同方針。今回は配管優先、生成は最小限。

### 6. browser target は Phase 2 に接続
- `target:'client'` entity の**タグ付け・可視性・越境エラー**は今回入れるが、実際に browser 用コードを
  emit するのは Phase 2（`js:` namespace codegen、buffer-CON IIFE。`docs/plan/browser-js-roadmap.md`）。
  今回はその足場を server 側で先に通す。

## 検証（実行可能 CLI 活用）

- `load-entity-fns.ts <+entity.ts> ...` を直接実行し、`{name:{target,takesCON,isAsync}}` を目視確認。
  - サンプル: `getUrl`（server, no-CON, sync）/ `param`（this=CON）/ `coalesce`（shared, value）を用意。
- `module/generate.ts` / `populator/generate.ts` を、`+entity.ts` を持つテンプレフォルダに対し直接実行し、
  `&yatt:foo;` が新ローダー経由で解決され server 出力が現状維持であることを確認。
- **越境エラーの負テスト**: server 文脈から `+entity.client.ts` の entity を参照 → コンパイルエラーになること。
- `populator/runner.ts` で実レンダリングし、共有 entity が動くことを確認。
- 回帰: 各パッケージ `deno test -RE`（`core/codegen0`, `core/lrxml`, `util/xhf`）。
- **namespace 出力が完全に無変更**であること（regex 経路を触らない）。

## スコープ外 / 継続

- `js:` browser widget codegen 本体（Phase 2）と評価タイミング境界（Phase 3）。→ `browser-js-roadmap.md`。
- 実プロジェクト（uktool2 等）の適用・書き換えは user 側。yatt-js は配管と検証まで。
- express adapter 修復（別課題）。
- `this: Connection` 旧規約 → positional `CON` への移行判断（introspection 実装時に確定）。
