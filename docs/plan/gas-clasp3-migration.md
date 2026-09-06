# GAS / clasp3 対応のための移行計画（議論メモ）

## 背景

現行 `adapter/gas-clasp` は

- **clasp 2.5** が TS をそのまま受け取り型剥がしして push する挙動
- **TypeScript の `namespace` 機能** による暗黙のグローバルマージ

の組み合わせを前提にしている。

clasp 3 では以下の方向に変わった:

- 単一スクリプトへ ESM をバンドルして push する流儀が中心
- TypeScript の `namespace` は今後なるべく避けたい情勢

そこで yatt-js の GAS サポートも、ESM ベースに作り直す必要がある。
本ドキュメントは方針検討のメモ。

---

## 現状の構造（読み解き結果）

### コア生成器

`core/codegen0/src/codegen0/` 配下に **3 系統** の生成器が共存している:

| 生成器 | 出力形態 | 主な利用先 |
|---|---|---|
| `generate_namespace` | TS `namespace` で包んだコード | `adapter/gas-clasp`（現行） |
| `generate_module` | ESM (`import` を含む `.mts`) | `adapter/express` ほか |
| `generate_populator` | `export function populate($yatt) { return {...} }` のみ | `core/codegen0/example/deno_serve` |

`build.ts:24` の `templateNamespace` フラグで namespace ↔ module を切替。populator は別系統で `cgenSettings('populator', ...)` 経由。

### gas-clasp adapter の構造

- `build.ts`: テンプレを `generate_namespace` で `root/_yatt/*.ts` へ。`runtime/_yatt.*.ts` を `root/` 直下にコピー。`$yatt.$staticMap` も生成。
- ランタイム (`runtime/_yatt.*.ts`) は **3 つの namespace に相乗り**:
  - `$yatt.$public.<name>` — 各テンプレ生成物
  - `$yatt.runtime` — 共通ランタイム
  - `$yatt` — entity 関数群
- GAS エントリ (`runtime/_yatt.gas.htmlservice.ts`): トップレベル `function doGet()` から `($yatt.$public as any)[fileName]` で文字列ルックアップ。
- ビルド: `module: "none"` + `target: es2015` で TS をそのまま結合させ、clasp 2.5 で push。

namespace 依存箇所は概ね **3 点に局在**:
1. 生成コードの外側 `namespace $yatt.$public.<name>`
2. ランタイムを namespace で包むコピー処理
3. `doGet` から `$yatt.$public[name]` の動的ルックアップ

---

## 検討した選択肢

### A. esbuild で IIFE バンドル（generate_module ベース）

`generate_module` の出力＋手書き runtime を esbuild で 1 ファイル `Code.js` に。
トップレベル関数（`doGet` 等）は明示的に `globalThis.doGet = …` 化する shim を用意。

- **+** 高速・設定が薄い・ソースマップの取り回しもしやすい
- **+** clasp3 自身も esbuild を内部利用する流れと整合
- **−** トップレベル global の手当てが必要

### B. Rollup（または Vite library mode）

`format: 'iife'` で同様の出力。

- **+** プラグイン資産が豊富
- **−** 本件の単純さに対して overspec

### C. clasp3 の組み込みバンドラに任せる

生成 ESM をそのまま push し、clasp 側のトランスパイル/結合に委ねる。

- **+** 一番手数が少ない
- **−** clasp の挙動に依存しすぎる／entity・ランタイムの global 注入が難しい
- 検証は必要だが本命にはしにくい

### D. ts-project-references + tsc の outFile (AMD 等)

namespace を捨てつつ tsc 単体で結合。

- **−** GAS 互換の出力形態に細工が要る
- **−** 結局 IIFE bundler 相当の苦労が増える。旨味薄

### E. **populator + bundler（本命）**

`generate_populator` は

- `export function populate($yatt) { return { render_X(...){...}, ... } }` のみを出力
- **生成コード内に `import` 文が一切ない**（兄弟テンプレも entity も runtime も `$yatt` 引数経由）
- 配線は呼び出し側の責務: `$yatt.$<ns>[modName] = mod.populate($yatt)`

これは GAS のような「リンカが弱い・実行時 import 不可・グローバル関数を要求する」環境にとても向く。

deno_serve 例では `data:text/typescript` で動的 import しているが、これはホットリロードのため。
GAS ではビルド時に静的に並べれば足りる。

---

## 4 案の比較表（GAS 文脈）

| 観点 | namespace（現状） | generate_module + bundler | **populator + bundler** |
|---|---|---|---|
| 生成コード内の依存表現 | `namespace` の暗黙マージ | `import * as foo from './foo.mts'` | **なし**（`$yatt` 引数経由） |
| バンドラの仕事 | 不要（clasp が結合） | 多モジュール → IIFE | populate 関数を inline するだけ |
| 兄弟テンプレ参照の解決 | 名前空間ルックアップ | パスベース import | `$yatt.$public[name]` プロパティ参照 |
| entity の差し込み | namespace 下に手書き | import で固定 | **ホストが構築時に注入**（差し替え自由） |
| GAS 固有 runtime 差し替え | namespace 上書き | 型/import 整合に注意 | `$yatt.runtime` を入れ替えるだけ |
| 他アダプタとの共通化 | × GAS 専用 | △ 各アダプタで微妙に違う | ◎ deno_serve / express と同じ生成路 |
| clasp3 への適合性 | × namespace 廃止方向 | ○ | ○（より素直） |
| 実装コスト | （現状） | 中 | **小**（生成器そのまま、glue を書くだけ） |

---

## 推奨案: populator + esbuild

### ディレクトリ構造（案）

```
adapter/gas-clasp3/
├── build.ts                       … テンプレ走査 → generate_populator → _registry.ts 生成
├── runtime/
│   ├── _yatt.runtime.ts           … 共通 runtime の薄い再エクスポート
│   ├── _yatt.entity.ts            … 手書き entity
│   └── _yatt.gas.htmlservice.ts   … makeDoGet など
└── example/basic/
    ├── templates/*.{yatt,ytjs,ytmpl}
    ├── root/
    │   ├── Code.ts                … $yatt 構築 → wireAll → globalThis に貼る
    │   ├── _yatt/
    │   │   ├── <runtimeNs>/<modName>.ts   … generate_populator の出力
    │   │   ├── _registry.ts               … 自動生成: import + wireAll($yatt)
    │   │   └── _static.ts                 … 自動生成: staticMap
    │   ├── appsscript.json
    │   └── .clasp.json
    ├── dist/Code.js               … esbuild の出力（clasp が push）
    └── tsconfig.json              … "module": "ESNext", "target": "ES2019"
```

### Code.ts のイメージ

```ts
import { runtime } from './runtime/_yatt.runtime'
import * as entFns from './runtime/_yatt.entity'
import { wireAll } from './_yatt/_registry'
import { makeDoGet } from './runtime/_yatt.gas.htmlservice'

const $yatt = { runtime, $public: {}, ...entFns }
wireAll($yatt)

;(globalThis as any).doGet = makeDoGet($yatt)
```

### バンドル

```
esbuild Code.ts \
  --bundle --format=iife --target=es2019 --keep-names \
  --outfile=dist/Code.js
```

---

## 詰めるべき論点

1. **`_registry.ts` の自動生成**
   - `glob → import 文と wireAll 列挙 → 書き出し` を `adapter/gas-clasp3/build.ts` に追加
   - `generate_populator` を呼ぶループはほぼ現行 `build.ts` の流用で済む

2. **依存順序**
   - populate された `$this` は `$yatt.$<ns>[modName]` に登録され、別テンプレの `render_` から実行時に引かれる
   - 同一トップレベルの `wireAll` ループで全部登録してから `doGet` を呼ぶので循環参照は問題にならないはず（namespace 方式と同性質）
   - base/extend 関係（`generate_populator_for_declentry` の `template.base` 走査）を尊重する登録順を `_registry.ts` で再現するのが安全

3. **`typeof$yatt` の型整合**
   - populator は `generate_reference_interface` で各テンプレが要求する `$yatt` shape を出力
   - ホストの `$yatt` リテラルが全部を満たすか tsc に検証させたい
   - `Code.ts` で **明示的型注釈**（テンプレ側 interface の交差型）を付ける形に寄せる

4. **エントリ関数の保護**
   - esbuild の minify/IIFE 化で `doGet` が消えないよう、`globalThis.doGet = …` の明示代入＋`--keep-names`
   - もしくは IIFE ではなく `--format=esm` 出力を clasp3 のバンドラに食わせる二段式
   - **実機検証案件**

5. **GAS 固有エントリ（sidebar 等）**
   - 現行は namespace 関数として置いてある
   - populator 化後は `runtime/` 配下の通常 ESM にして、`Code.ts` で `globalThis.show_sidebar = …` するだけ

6. **静的ファイルマップ**
   - `$yatt.$staticMap` は populator と独立
   - `_yatt/_static.ts` として `export const staticMap = {...}` を吐けば済む

7. **entity の置き場**
   - deno_serve では `baseCgen.entFns` を `$yatt` に折り込み
   - GAS では: 手書き `_yatt.entity.ts` を spread するか、`*.ytjs` の entity 宣言から生成 + 手書きを混ぜるか

8. **clasp3 のバンドラ挙動の判断**
   - PoC 段階で「esbuild を自前で回す」か「clasp3 内蔵に任せる」かを決める
   - 多分前者の方が制御しやすい

---

## populator 採用時のリスク

- **関数名の維持**: esbuild rename が `appsscript.json` トリガを壊さないよう `--keep-names` か明示再代入
- **closure サイズ**: 各 `populate` が `$yatt` を捕捉。大規模プロジェクトでの起動パース時間に注意
- **ソースマップ**: GAS では限定的。enable しても best-effort 扱い
- **型インターフェース drift**: 多テンプレ × 各々が要求する `$yatt` shape の和集合をホストが満たせているか、テストフィクスチャで検証

---

## ロードマップ

1. **PoC（半日〜1日）**: `adapter/gas-clasp3/` 新設、最小テンプレ1〜2枚で
   `populate 生成 → 手書き registry → esbuild → clasp3 push → doGet 動作` を通す。
   `Code.ts` も手書きで OK。
2. **`_registry.ts` 自動生成**: PoC で形が見えたら `build.ts` に組み込み
3. **`runtime/` の再構築**: namespace を全廃し、ESM の手書きヘルパに
4. **example/basic を ESM 版へ移植** & 旧 namespace 版を `gas-clasp/` に温存（参照用）
5. **clasp3 のバンドラ挙動の判断**: PoC 段階で esbuild 自前 vs clasp3 内蔵を決める

---

## Entity 関数の Connection 引き渡し規約

### 背景

yatt ではテンプレート内 entity 呼び出しを **静的に解決** したい
（未定義 entity を早期検知するため）。
そのため entity 関数一覧を高速に構築できる必要がある。

Perl 版では `Entity name => sub {...};` 記法で登録し、
Connection は global symbol 経由で `local *CON` により動的束縛していた。
テンプレート著者に毎回 `:con` を明示させたくないため。

ESM には `local *CON` 相当の動的束縛がない。
従来は `apply` で `this` 経由で渡していたが、
**entity 内から別 entity を呼ぶ際にも apply が必要** になり直感に反する。

### 競合案の評価

| 案 | 評価 |
|---|---|
| `this` + `apply` | ネスト呼び出しが非直感的、async との相性が悪い、TS の型推論が弱る。**却下** |
| AsyncLocalStorage | Node/Deno では使えるが GAS にない → 全プラットフォーム共通策にならない。**却下** |
| 都度 `$yatt` を clone して closure 化 | リクエスト毎にコスト発生、`$yatt` の identity が壊れて populator のキャッシュ前提が崩れる。**却下** |
| **第一引数名 `CON` 規約** | 「魔法」がコード生成の 1 箇所に閉じる。entity 同士の呼び出しは普通の関数呼び出し。型も自然。**採用候補** |

### 採用案: 「第一引数名が `CON` なら暗黙渡し」

「魔法」が起きる場所はテンプレートからのコード生成時の 1 箇所だけ:

```yatt
&yatt:param(name);
```
↓
```ts
$yatt.param(CON, "name")    // CON が必要なら第1引数として注入
$yatt.getUrl()              // 不要なら通常呼び出し
```

entity 著者から見れば CON は普通の引数。entity 間呼び出しは:

```ts
export function param(CON: Connection, name: string) { ... }

export function urlOf(CON: Connection, name: string) {
  return getUrl() + '?' + name + '=' + param(CON, name)  // 明示的、迷いなし
}
```

ネストが直感に反する問題が消える。`apply` の影もない。

### 設計上の細部

1. **検出方法**: TS Compiler API で entity ファイルをパース → 各 export function の第1引数 identifier が `CON` か判定。`list_entity_functions.ts` に `needsCon: boolean` フラグを足す形で済む。
2. **async 対応**: codegen 側は entity 呼び出しを常に `await` で包む（sync 関数を await しても問題ない）。あるいは戻り型から判定。前者が簡単。
3. **`Connection` の型**: アダプタ毎に違うので、entity 著者は自分のアダプタの `Connection` 型を import する。populator の `typeof$yatt` interface 構築時に各 entity のシグネチャをそのまま採用すれば、ホストの `$yatt` が要求型を満たすかは tsc が検査してくれる。
4. **規約名の選択**: `CON` 大文字を維持。Perl `*CON` の伝統と一致、見つけやすい、ローカル変数衝突しにくい。
5. **型レベルの安全網（将来）**: `type Entity<F> = F` のようなマーカ型を提供し、`Parameters<F>[0]` が `Connection` 互換なら `needsCon` を型でも表現する洗練を後付け可能。

---

## Entity 関数の配置と登録

### 結論

「規約スキャン + ビルド時 registry 生成 + 軽量ホットスワップ」で **Vite は不要**。
Vite の機能のごく一部（しかも特殊形）しか使わないため、内製した方が GAS との両対応が綺麗にまとまる。

### 登録モデル: 規約に基づくファイルスキャン

```
entities/                         ← 設定可能なディレクトリ
├── core.ts        export function param(CON, name) {...}
├── url.ts         export function getUrl() {...}
└── sheet/
    └── name.ts    export function sheetNames() {...}
```

ルール:

- `entities/**/*.ts` の **export された関数すべて** が entity
- 名前 = 関数名（フラットな namespace）
- ビルド時にスキャンして `entityRegistry` を作る
  - codegen はこれを参照して `&yatt:foo();` を解決
  - 未定義 entity の参照はビルドエラー → 早期検知の目的を満たす

### 名前衝突の扱い

最初は **ビルドエラー** で良い。「a.ts と b.ts の両方で `foo` が定義されている」と止める。

- 暗黙の優先順位ルールはバグの温床
- Perl 版の `Entity name => sub {...}` も後勝ち/エラーを開発者がコントロール出来た方が良い
- 拡張が必要になったら、`entities/<group>/...` を `&yatt:group:foo();` 構文にマップする方向（後付け可能）で逃げる

### Dev hot-swap: Vite なしで十分達成可能

Perl の「ファイル更新 → 読み直して差し替え」は ESM でも素朴に再現できる:

```ts
// dev mode 用ローダー (~30行程度)
const watcher = Deno.watchFs(entityDir)
for await (const ev of watcher) {
  for (const path of ev.paths) {
    if (!/\.ts$/.test(path)) continue
    const url = `file://${path}?v=${Date.now()}`   // cache-bust
    const mod = await import(url)
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn === 'function') $yatt[name] = fn  // 上書き
    }
    rebuildEntityRegistryIfChanged()  // 名前集合が変わった時のみ
  }
}
```

ポイント:

- テンプレ側は populate 時に `$yatt` を **参照で** 捕捉している
- `$yatt.foo = newFn` の代入だけで、全テンプレが新しい `foo` を見るようになる
- **テンプレの再 populate は不要**（entity 名集合が変わって codegen 結果に影響する場合を除く）
- 必要な機構は「watcher + import-with-cachebust + プロパティ代入」の3点だけ

これで Perl 版の使用感をほぼ再現できる。Vite の HMR グラフ・依存解決・middleware はこの用途には完全にオーバースペック。

### GAS ターゲットでの静的 glue

GAS には実行時の再読み込み概念がないので、スキャン結果から静的 glue を生成:

```ts
// _yatt/_entities.ts (自動生成)
import * as e_core from '../entities/core'
import * as e_url  from '../entities/url'
import * as e_sheet_name from '../entities/sheet/name'

export const entFns = { ...e_core, ...e_url, ...e_sheet_name }
```

`Code.ts` 側で `const $yatt = { runtime, $public: {}, ...entFns }`。esbuild がバンドル。

**dev/GAS で同じスキャナを使い、出力ファイルだけ変える** 構造にできる。

### 静的解析の高速化

ビルド毎に全 entity ファイルを TS でフルパースするのは重いので:

- 第1段: `glob` + 軽量パーサ（TS API の `createSourceFile` で `setParentNodes:false`）で `export function NAME(FIRSTARG, ...)` だけ抽出 → `{name, file, needsCon}` のリスト
- 第2段: 上記を mtime ベースでキャッシュ
- 型検査は tsc に任せる（codegen のフェーズではなく最終バンドル前）

これで「entity 一覧を高速に構築」という当初要件を満たせる。

---

## 未決事項 / 続けて議論したい点

- async entity の判定詳細（常に `await` で良いか、型ベース判定が必要か）
- Connection 型のアダプタ間バリエーション設計
- `&yatt:group:foo();` 風グルーピング構文の将来
- （以降、追記予定）
