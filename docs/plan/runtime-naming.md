# Runtime の名前空間と命名規約 ── 現状整理と改善提案

## 背景

yatt-js の runtime には `$` プレフィクスを冠した識別子が複数あるが、
適用ポリシーが揺れていたり、TypeScript の組み込み構文と紛らわしかったりする。
gas-clasp3 への移行で生成コードと runtime を作り直す機会があるので、
このタイミングで命名規約を整理しておきたい。

関連: [gas-clasp3-migration.md](./gas-clasp3-migration.md)

---

## 現状のカタログ

| 識別子 | 種類 | 居場所 | 役割 | 由来 |
|---|---|---|---|---|
| `$yatt` | 変数/引数 | 生成 `populate($yatt)` の仮引数 | runtime コンテナ | 設計上の sigil |
| `$yatt.runtime` | プロパティ | コンテナ直下 | システム関数群 (`escape` 等) | 手書き runtime |
| `$yatt.$public` | プロパティ | コンテナ直下 | 既定 template folder の生成物 | `internTemplateRuntimeNamespace` 既定値 `public` に `$` を後付け |
| `$yatt.$<folder>` | プロパティ | 同上 | 他の template folder | `Path.basename(dir)` の動的命名 |
| `$yatt.<entity>` | プロパティ | コンテナ直下 | ユーザ entity 関数 | spread |
| `$yatt.$staticMap` | プロパティ | コンテナ直下 | 静的ファイルマップ（gas のみ） | gas-clasp 固有 |
| `$this` | 変数 | `populate()` のローカル | 構築中の handler set | populator 内部慣習 |
| `render_X` | メソッド名 | `$this`/`$yatt.$public.index` 等 | widget の renderer | snake_case 接頭辞 |
| `populate` | export 関数 | 各生成 ESM | 注入入口 | populator の規約 |
| `typeof$yatt` | **interface 名** | `loader.ts`, `interface.ts` | コンテナの型 | TypeScript の `typeof` 演算子と紛らわしい綴り |
| `Connection` | interface | runtime 共通 | 出力先抽象 | 一般的 |
| `CON`, `BODY` | 変数名規約 | 生成コードの実引数 | conn / body 受け渡し | Perl YATT 由来 (ALL_CAPS) |
| `runtimeNamespace` | TS フィールド | `TemplateDeclaration` | folder 識別子 | jargon |
| `modName` | TS フィールド | 同上 | ファイルベース名 | jargon |
| `HandlerSet` / `HandlerSetFolder` | 型名 | `loader.ts` | 構築物の分類 | populator 用語 |

---

## 問題点

### 1. `typeof$yatt` という interface 名 ── 最優先で直すべき

`typeof$yatt` は TypeScript の `typeof` 演算子と読めるが、実際は単なる identifier。
文中に `populate($yatt: typeof$yatt)` と現れると、人にも IDE にも混乱を生む。
Linter/IDE がうっかり `typeof $yatt` と直してしまう事故もあり得る。

→ `Yatt`, `YattScope`, `YattContainer` などが穏当。

### 2. `$` プレフィクスのポリシーが揺れている

```
$yatt.runtime       ← $ なし (システム)
$yatt.$public       ← $ あり (folder)
$yatt.foo           ← $ なし (entity)
$yatt.$staticMap    ← $ あり (gas 拡張)
```

「`$` は yatt 管理の名前空間につける」のか「予約語回避」なのか「単なる装飾」なのかが、コードを読んでも判らない。
実際には:

- `$public` の `$` は、entity が `$yatt.foo` で同じ階層を共有しているための **衝突回避** と推測される
- なら `runtime` も `$runtime` でなければ理屈が通らない
  （entity 名 `runtime` を書いた瞬間に runtime が壊れる）
- 逆に entity を `$yatt.<name>` 直下に置く現方式そのものが
  **予約名問題のオンパレード**（`runtime`, `$public`, `$staticMap` などとの暗黙の衝突）

### 3. entity がトップレベルに住む構造

`$yatt.<entityName>` 直下配置は、`$yatt.runtime` や `$yatt.$public` と同じ階層を共有するため、
entity 著者は知らずに予約名を踏める。
GAS 環境で `getUrl` のような短い名前が普通に使われるため、現実的なリスク。

### 4. `$this` の意味の希薄化

populator 内部の `$this` は JavaScript の `this` とは無関係な単なるローカル変数。
`$` を冠する根拠が薄く、将来の populator API 整理で混乱の元になる。

### 5. `$public` という既定 folder 名の意味的な弱さ

Web 界隈で「public」と言えば普通は静的アセット領域。
yatt では「ユーザ向けページ群」という別概念。
さらに gas adapter は同じ `$yatt` 上に **静的ファイル用の `$staticMap`** を別に置いていて、
二つの「public 的な何か」が同居している。`pages`（または `views`）の方が伝わる。

### 6. `internTemplateRuntimeNamespace` の自動命名の脆さ

最初の folder は `public`、以降は `Path.basename(dir)` を nick に採用する単純規則。

- **異なる絶対パスでも basename が一致すると暗黙の衝突**
- 設定可能でない
- テンプレ著者から見えにくい

双方が地雷。

### 7. 用語: `runtimeNamespace` / `modName` / `HandlerSet`

技術用語に寄りすぎていて、ユーザ向けドキュメントで説明しにくい。

- `runtimeNamespace` → `groupName` または `folderName`
- `modName` → `templateName` または `partFile`
- `HandlerSet` → `TemplateInstance`、`HandlerSetFolder` → `TemplateGroup`

### 8. メソッド名 `render_X` (snake_case)

Perl 流儀。これ自体は害はないが、JS の常識的な命名（camelCase or sub-object）からは外れる。
代替:

- `$this.render.foo(CON, ...)` のように **sub-object に分ける** と prefix 不要、TS の補完も効きやすい
- ただし allocation 増、バインディング書き換えが面倒、後方互換が壊れる
- 直近では維持で良さそう。**整理候補メモ** として残す程度

---

## リネーム提案（3 段階）

破壊度の小さい順に。

### Proposal A（最小・推奨着手）

| 現状 | 提案 |
|---|---|
| `typeof$yatt` | `Yatt`（または `YattScope`） |
| `$this`（populate ローカル） | `handlers` |
| 既定 folder nick `public` | `pages` |
| `runtimeNamespace` (TS field) | `groupName` |
| `modName` (TS field) | `templateName` |
| `HandlerSet` / `HandlerSetFolder` | `TemplateInstance` / `TemplateGroup` |

`$yatt` 自体・`$public`/`$<folder>` の `$` プレフィクス・`render_X` 命名は維持。
生成コードと runtime の見た目はほぼ変わらず、internal 用語と型名のみ整理。

### Proposal B（`$` ポリシー統一）

「`$<name>` = yatt が管理する名前空間」というルールを徹底:

- `$yatt.$runtime`, `$yatt.$pages.index`, `$yatt.$entities.foo`, `$yatt.$staticMap`
  のように **すべての yatt 管理プロパティに `$`**
- entity がトップレベルに散らばらず `$yatt.$entities` 直下にまとまる
  → **予約名衝突が原理的に消える**
- 代償: 呼び出し側の表記が長くなる、entity 関数経由で呼ぶのに
  `$yatt.$entities.param(CON, ...)` と書く
  - ただし生成コードの中だけの話なので、**テンプレ著者から見ると不可視**

CON 規約（`gas-clasp3-migration.md` の Q1）と組み合わせて codegen 時に解決される話なので、
**ユーザ可視のコストはほぼゼロ**。内部の整合性は大幅に改善する。

### Proposal C（`$` 完全廃止・破壊的）

`app.runtime`, `app.pages.index`, `app.entities.foo` に揃える。
「ふつうの JS フレームワーク」の見た目。
ただし yatt の歴史的アイデンティティ (`$yatt` の sigil) を捨てることになる。

→ コスパが悪いので **非推奨**。

---

## 推奨方針

- **Proposal A を即実施** — `typeof$yatt` の修正は単独でも価値あり
- **Proposal B を gas-clasp3 移行と同タイミングで導入** — どのみち generate コードを差し替える機会だから
- **Proposal C は不採用**

「`$yatt.$entities.<name>`」への移行は、

- Q1 の CON 規約（`gas-clasp3-migration.md`）
- Q2 の entity ファイル走査（同上）

と同じレイヤーの話なので、**3 つを一括で設計し直すと一貫した API** になる。

---

## 未決事項

- Proposal B の `$entities` 配下化が、entity 間呼び出しのコード生成にどう影響するか（呼び出しは entity 著者が書くので、生成側の話ではない可能性も）
- `$<folder>` の自動命名を **設定可能** にすべきかどうか（YattConfig への追加）
- `render_X` の sub-object 化を中長期で検討するかどうか
- `CON`, `BODY` の ALL_CAPS 規約を維持するか（型推論との相性、命名衝突の頻度を見て判断）
