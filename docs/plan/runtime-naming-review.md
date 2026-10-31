# Runtime 命名ポリシーへの応答 ── レビューと方針提案

このドキュメントは、[../discuss/runtime-naming-policy.md](../discuss/runtime-naming-policy.md)
（命名ポリシーについての著者の考え）に対する応答・レビューである。

関連:
- [runtime-naming.md](./runtime-naming.md) ── 当初の問題点指摘（この応答の「前史」）
- [gas-clasp3-migration.md](./gas-clasp3-migration.md) ── Q1 (CON 規約) / Q2 (entity loading)

実装確認の事実: action の body は **raw text passthrough**
（`core/codegen0/src/codegen0/action/generate.ts:46-50`、`&yatt:` マクロは展開されない）。
ただし action は `populate($yatt){...}` の closure 内に生成されるため、
**body から `$yatt` は lexical scope で参照できる**。これが後述の case 分析の前提となる。

---

## 総評

「`$` = **yatt が制御し、プロジェクトごとに変動する**メンバーの印」という第一義の定義は、
当初 `runtime-naming.md` で衝突回避と推測したものより遥かに良い基準である。
これは*意味論*(variability) の宣言であり、コード生成系の名前空間としては正しい軸。

この原則を物差しにすると、揺れているのはポリシーではなく、ポリシーに対する **2つの逸脱** であると分かる。
当初の「ポリシーが揺れている」という指摘は半分は誤射だった。

---

## 不整合①: entity が `$yatt.<name>`（`$` なし）に居る

entity こそ「プロジェクトごとに変動する」ものなので、
**著者自身の原則に従えば `$` 付き名前空間に入るべき**。
`$` なしのトップレベル配置は原則からの意図的な例外であり、
`runtime` / `$public` / `$staticMap` との衝突リスク（旧 #3）の発生源そのもの。
→「ポリシーの矛盾」ではなく「原則＋ergonomics例外、そして例外の方が高コスト」という構図。

### この例外は本当に必要か ── 3つの呼び出し箇所を実装で再検証

| 箇所 | 性質 | `$yatt` への到達手段 | prefix コスト | hot-reload 安全性 |
|---|---|---|---|---|
| 1. widget 内 | yatt が生成 | 生成側が自由に書ける | **ゼロ**（深さ無関係） | 常に live |
| 2. action 内 | 手書きだが `populate($yatt)` closure 内 | **`$yatt` が lexical scope に在る** | `$yatt.` の一段だけ | `$yatt` 読みなので live |
| 3. entity 定義内 | 手書きの素の ESM | **`$yatt` が scope に無い** | — | 直接 import すると **stale 化** |

トップレベル配置がコストを節約しているのは「case 2/3 で `$entity.` の一段が消える」だけ。これは小さい。
一方で失うのは衝突安全性と原則一貫性。
→ **差し引きで namespace 化（`$yatt.$entity.<name>`）が勝つ** と考える。

加えて case 3 の「直接 import すると hot-reload で stale 化」問題は無視できない。
entity A が `import {b} from './b'` した後に B を差し替えても、A は古い B を掴み続ける。
これは著者が `$this` の節で JS の `this` を「分かりにくいバグのもと」として避けたのと
**同じ種類の罠**。哲学的一貫性からも entity 間呼び出しは live container 経由が筋。

### 具体案: case 3 の `$yatt` 到達を CON 経由にする

case 3 だけ `$yatt` が scope に無いのが唯一の難点。
**CON が live `$yatt` への参照を持つ**ことにすれば解ける:

```ts
// entity 定義 (素の ESM)
export function urlOf(CON: Connection, name: string) {
  return CON.$yatt.getUrl() + '?' + name + '=' + CON.$yatt.$entity.param(CON, name)
}
```

これで case 3 も hot-reload 安全・import 不要になる。
Q1 の「第一引数 CON 規約」とも噛み合う（CON は元々 yatt が注入する想定なので、
そこに `$yatt` 参照を載せるのは自然）。

> ただしこれは著者の「prefix は少なく」目標と真っ向からトレードオフする。
> 推薦は **hot-reload 安全性を優先して namespace 化** だが、
> ここは「entity 間 hot-reload をどこまで重視するか」という価値判断次第。
> **最重要の分岐点として doc に明記すべき。**（後述「決めるべき分岐 A」）

おまけ: namespace 化すれば「entity が runtime を上書きする」危険
（policy doc が「後で論じます」と保留した件）も **構造的に消滅** する。

---

## 不整合②: `$` を「全レベル」か「境界だけ」か

現状は `$yatt.$public.index` のように **mixed**:

- `$yatt` に `$`、`$public` に `$`、しかし `index`（template 名）には `$` なし
- template 名もプロジェクトごとに変動するので、原則を厳密適用するなら `$index` のはず

2つの一貫した下位ポリシーがあり、**どちらかに決める** べき:

- **P-every（全レベル付与）**: `$yatt.$public.$index`, `$yatt.$entity.$param`
  ── 各ノードで「変動する」を最大限シグナル
- **P-boundary（境界のみ付与）**: `$yatt.public.index`, `$yatt.entity.param`
  ── 「`$yatt` を一度くぐったら以降は制御領域」と理解する。**より ergonomic で原則とも矛盾しない**

→ **P-boundary を推す。** `$` は「ここから先は yatt 管理下」という*入口の標識*として機能させ、
内部では繰り返さない。policy doc の「ESMプログラマに静的確定だと誤解させない」目的は
入口で達成済みなので、深いパスを軽くできる。
現状の `$yatt.$public.index` は P-every と P-boundary の中間で宙ぶらりん
── これを正したのが旧 #2 の正体。

`internTemplateRuntimeNamespace` の `$yatt.$ytmpl.$foo` 案も、
P-boundary なら `$yatt.ytmpl.foo` に落ち着く。`$foo か foo か` の迷いは全体方針で自動的に決まる。

---

## 個別論点への回答

### `public` vs `pages` ── 当初の批判を撤回

「Apache/PHP 的なオンデマンド web resource 解釈の再現」「build を意識させない設計目標」
という根拠は強い。この哲学の下では `public`（＝公開され拡張子に応じ透過処理されて served される
ツリー）は `pages` より **正確**。`runtime-naming.md` の「意味が弱い」は的外れだった。
`public/`（処理して served）と `static/`（バイパス）の対は綺麗に筋が通る。

doc では **この2フォルダを必ずペアで説明**し、
「GAS では build 不可避なので `pages/`→`root/` でも可、ただし entity 差し替えで
deno ローカル確認の道を残す」という注意書きを併記する。

### `typeof$yatt` ── 改名すべき。ただし「グローバル型」ではない点に注意

実装上これは「**その populator が `$yatt` に要求する shape**」を各テンプレごとに生成したもの
（`generate_reference_interface`）。名前は「`$yatt` の型」より「**要求される依存の形**」を表すべき。

候補:

- `$Yatt` ── 値 `$yatt` と視覚的に対になり `$`=yatt管理 の標識も効く。型と値は別 namespace なので
  衝突しない。`t$yatt`/`type$yatt` の「視覚リンクを残したい」要望を非イディオムにならず満たす。**第一推薦**
- `YattRef` / `YattDeps` ── 「要求する依存」という意味を最も正確に表す。**意味重視ならこちら**
- `YattScope` ── 無難だが「要求 slice」感は薄い

`typeof$yatt`（演算子誤読）と `t$yatt`（呪文的）は避けたい。
推薦は `$Yatt`（視覚リンク優先）か `YattRef`（意味優先）の二択。

### `$this` ── 残してよい。ただし JS `this` との距離を名前で稼ぐ手も

動的 dispatch のハンドル、Perl のクラスメソッド継承、JS `this` 回避、という理由付けは妥当。
むしろ `$this` という綴りが「JS の `this` の親戚」と誤読され、
**著者が避けたいはずの混同**を招くのが惜しい。
`$self` / `$tmpl` / `$widget` なら「現在のテンプレート実体」を素直に指し、
JS `this` と意図的に切り離した意思表示になる。
改名は任意だが doc には「**JS の `this` とは無関係**」と一行入れるべき。

### `internTemplateRuntimeNamespace` ── 目的は妥当、basename 由来命名はバグ扱いで

「複数の private テンプレ置き場」「`$yatt.ytmpl.foo.render_bar` で呼ぶ」という目的は明快。
basename 衝突は仕様ではなくバグとして、
**folder→nick を明示マッピング（YattConfig で設定可能）** に変えるのが正解。
自動命名は衝突したら error、が安全。

### `CON` / `BODY` の ALL_CAPS ── 維持に賛成

Perl 版資産の移植性、`body`→`BODY` の衝突回避経緯、設定で互換化可能、いずれも合理的。変更不要。
doc に「**Perl 版互換のための意図的 ALL_CAPS、設定で変更可**」と由来を残せば、
将来「なぜ大文字？」の疑問に一次回答できる。

---

## 文書化をどうするか

この policy doc は `docs/discuss/` の議論メモのままにせず、**規範文書（spec）に昇格** させるべき。

1. **一次原則を冒頭に**: 「`$` = yatt 制御下・プロジェクト変動」と下位方針（P-boundary 採用）を
   最初に1段落で宣言。以降の各決定は「この原則からの導出」または「明示された例外」として書く。
   → 維持しやすい（将来の判断も原則に照らせる）。

2. **2層構造に分離**:
   - **User-facing contract**（entity をどこに置くか、予約名は何か、`$yatt.<path>` の読み方、
     CON/BODY 規約）── そのまま user docs に転載できる粒度で。
   - **Internal rationale**（`$Yatt` 型生成、`$this` の dispatch、folder nick 機構）── 貢献者向け。

3. **争点は ADR 形式で**: entity 配置（top-level vs `$entity`）、P-every vs P-boundary、typeof改名
   ── 「迷っている」項目を `context / options / decision / consequences` で記録。
   future-you が「なぜこう決めたか」を辿れる。

4. **単一の真実源にする**: Q1 / Q2 / gas-clasp3 migration と相互リンクし、命名はこの doc に集約。
   `runtime-naming.md`（指摘集）はこの spec の「前史」として残すか統合する。

5. **GAS との差分注記**: build 不可避な GAS と build-less が理想の一般 web app とで
   `public/static`・hot-reload の扱いが分岐する点を専用小節で明示。

---

## 決定事項（確定）

著者との議論を経て、以下のとおり確定した。
上記の「不整合①/②」やレビュー側推薦は議論の経緯として残すが、
**最終方針は本節を正とする**（一部はレビュー側推薦を採らない形で決着している）。

### D-1. `$` ポリシーは P-boundary

`$` は「ここから先は yatt 管理下」という*入口の標識*。
`$yatt` を一度くぐれば、以降のメンバーに `$` は重ねない。
→ template / entity / runtime いずれも `$yatt.<name>` の一段で表す。

### D-2. entity は top-level フラット配置 `$yatt.<entity名>`

レビュー側は当初 `$yatt.$entity` 化を推したが、**D-1（P-boundary）を採ると
`$yatt.entity` の意味論的貢献は消え、残るメリットは衝突回避のみ**になる。
衝突回避は下記 D-3/D-4 の仕組みで解けるため、
ergonomics（少ない prefix・case 2/3 の手書き負担減）を優先して **フラット配置**を採用。

- 構築は **spread**（`{ ...entities, runtime, public$: {}, static$: {} }`）。
  - 二層（prototype）構造は `Object.keys` 等の挙動が own/proto で食い違うため**不採用**。
  - **builtins を後置**して二重の安全網とする（後勝ちで builtin が必ず勝つ）。
- entity 間呼び出し（case 3）は素の ESM 関数呼び出し。
  - hot-reload 安全性が要る場面は別途検討（live container 経由 or 受容）。当面は素直な呼び出しで進める。

### D-3. 衝突回避は suffix `$` ルール

yatt 管理の予約メンバーのうち、人間が entity 名に選びうるものは **suffix `$`** で退避：

- template folder: `$yatt.public$`, `$yatt.<folder>$`
- 静的ファイル: `$yatt.static$`（旧 `$staticMap` 相当）

`$` を末尾に付ける習慣は人間にほぼ無いため、衝突面が実質消える。

### D-4. `$yatt.runtime` は `$` なしで暫定維持

`runtime$` にすると entity 呼び出し構文の拡張が必要になるため、当面は素の `runtime` を維持。
代償として **`runtime` は予約語**（entity 名に使えない）。将来 `runtime$` へ倒す余地は残す。

### D-5. hot-reload / build 時の予約名チェック

- **予約集合 = `{runtime}` ∪ {全 builtin own キー（`public$`, `static$`, …）} ∪ {全 template-folder nick}**。
  entity loader はこの集合を参照できること。
- **dev hot-reload**: 予約名・衝突を検出したら **warn してスキップ**（サーバは生かす）。
- **build (GAS)**: **hard error** で停止（壊れた成果物を push させない）。
- **ファイル間の同名 entity 衝突**（予約語とは別）: build では **error**、dev では後勝ち＋warn。

### D-6. `$yatt` の型名は `$yattType`

`typeof$yatt`（演算子誤読）を改め `$yattType` を採用。
`$Yatt`（イディオム的）も候補だったが、**値 `$yatt` との視認的な区別の強さ**を優先して `$yattType` で確定。
（lint の naming-convention を厳格運用する場合のみ要注意。）
実体は「その populator が `$yatt` に要求する shape」を各テンプレごとに生成したもの
（`generate_reference_interface`）。

### D-7. その他（確定 / 据え置き）

- `public` / `static` の語は **維持**（Apache/PHP 的オンデマンド web resource 解釈、build-less 設計目標に整合）。
  `public$`（処理して served）と `static$`（バイパス）はペアで説明する。
- `CON` / `BODY` の ALL_CAPS は **維持**（Perl 版互換・設定で変更可）。doc に由来を明記。
- `$this`（動的 dispatch ハンドル）: 改名は据え置き。doc に「**JS の `this` とは無関係**」と明記。
- `internTemplateRuntimeNamespace` の basename 由来命名はバグ扱い。
  folder→nick を **明示マッピング（YattConfig で設定可能）**へ。衝突は error。

---

## 次のステップ

- 上記 D-1〜D-7 を反映して、policy doc を spec 形式
  （一次原則 → user-facing contract / internal rationale の2層 → 争点 ADR → GAS 差分注記）へ書き起こす。
- spec 化に合わせて `runtime-naming.md`（指摘集）と本レビューを「前史」として位置づけ、相互リンクを整理。
