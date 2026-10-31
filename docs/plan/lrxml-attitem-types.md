# lrxml AttItem 型の discriminated union 化 + shape view API（計画）

## 背景

lrxml の attribute list は多様な表記を許す:

```html
name="foo" name='bar' name=varName
"foo" 'bar'
name

name=[code title="text"]

[head :::rest]="listexpr"
```

さらに attribute element（`<:yatt:x>...</:yatt:x>` / `<:yatt:y/>`）も attribute として扱われる。
yatt はこの**表記の違いを意味の違い**として codegen に使う（`name=varName` の bare 右辺は変数名、
attelem のデフォルト型は html、など）。その内部複雑性を隠すために導入した型宣言・type assertion・
アクセス抽象が不十分で、LSP から見た型情報が不明瞭になっている、というのが問題意識。

### 根本原因（調査で確定）

**`AttItem = {label?: Label} & Term`（`core/lrxml/src/attlist/parse.ts:31`）に shape の discriminant が無い。**

```ts
type BaseTerm<T> = AnyToken & {value: T, comment: string[]}
type QuotedStringTerm = {kind: "sq"|"dq"} & BaseTerm<string>;
type BareStringTerm = {kind: "bare"} & BaseTerm<string>;
type IdentplusTerm = {kind: "identplus", has_three_colon: boolean} & BaseTerm<string>;
export type StringTerm = (BareStringTerm | QuotedStringTerm) & {children: AttStringItem[]}
export type NestedTerm = {kind: "nest"} & BaseTerm<AttItem[]>;
type EntTermWComment = (EntNode & {comment: string[]})   // "XXX: Evil cast" (parse.ts:189)
export type Term = IdentplusTerm | StringTerm | NestedTerm | EntTermWComment
export type AttItem = {label?: Label} & Term             // ← 問題の核
```

- `kind` は**値側**トークン種（bare/sq/dq/identplus/nest/entity）だけを判別する。
- labeled（`name=...`）か positional かは optional `label` の**有無スニッフィング**でしか分からず、
  現行の型では `if (att.label)` と書いても TS は object を narrow **しない**（実プローブで確認）。
- `value` は多義（string / `AttItem[]`、entity には value が**無い**＝`path`）。

### 消費側（codegen0）に現れている症状

- **手動 re-discrimination ladder**: `declaration/attlist.ts:32-73`（cut_name_and_route、
  7 predicate の二重 ladder + 生 `kind === "entity"`）、`addArgs.ts:68-81`
  （`isBareLabeledAtt` の後に `kind === "bare"|"sq"|"dq"|"identplus"` を手で列挙 —
  「labeled かつ string 値」guard が存在しないための代償コピー）。
- **型消去点**: `macro/foreach.ts:66-93` `collect_arg_spec` が att を `attValue()` で平坦化し
  `as Partial<T>` で cast → 全 macro caller（if.ts / foreach.ts）が `hasQuotedStringValue` /
  `kind === "identplus"` を**再** narrow。
- **嘘つき guard**: `hasStringValue` は unlabeled identplus も通すのに
  `att is {label?} & StringTerm` と主張（identplus は StringTerm ではない）。
  `hasQuotedStringValue` は型上 bare を含む。`hasLabel` は内部で `(att as AttItem)` cast。
- **構造スニッフィング**: `EntTerm = EntText | EntPath` を `instanceof Array` で判別
  （`widget/entity/generate.ts:102`、EntPath が素の配列のため）。
  `putargs.ts:78` は positional att で `undefined` になりうる `argSpec.label` を無防備に参照（潜在バグ）。
- **any**: `attValue()`（`attlist/parse.ts:56-64`）は `any` コピー + `as AttValue`。
- string source の扱いが 3 ファイルで不一致: `template_context/text.ts:31` は bare を許可、
  `list.ts:30` は bare を NIMPL、`cast.ts:44-51` は負の narrowing（`kind !== 'entity' && !== 'nest'`）。

### 方針（user 決定）

- **互換範囲は「型と API のみ」**。parse 後ノードの実行時 JSON 形状は不変
  （`template_parse.test.ts` / `multipart_parse.test.ts` / `entity_parse.test.ts` /
  `spec_xhf`(100件) が unnest/noRange walker で形を固定しているため）。
- runtime 形状の変更候補は Stage 3 に設計メモとして残し **defer**。

## 設計の核: `label?: undefined` による本物の union 化

`undefined` は unit type なので、片腕で `label: Label`（必須）、他腕で `label?: undefined` と
**宣言**すれば `label` は正当な discriminant になり、`if (att.label)` がネイティブに narrow する。
これは Deno 同梱 TS への `deno run --check` プローブで実証済み:

- `AttPositional = {label?: undefined} & Term` の union で `att.label != null` が両分岐とも narrow ✓
- `kind` narrowing は union 分割後も機能 ✓
- parser の構築箇所（`{...pendingTerm}` / `{label: pendingTerm, ...term}`）はそのまま代入可能 ✓
- rest-destructuring `const {label, ...rest} = att` が Term に代入可能（attValue の any 排除）✓
- 現行の `{label?: Label} & Term` では `if (att.label)` は narrow しない（負の対照実験）✓
- 制限: `att.label.kind === "identplus"` で att **自体**は narrow しない → shape API 内部では
  `isBareLabeledAtt` を使う。

runtime には一切影響しない（型宣言だけの変更）。

## Stage 1 — 型レベルのみ（runtime 完全不変）

### 1a. `core/lrxml/src/attlist/parse.ts`（13-64 行の型ブロック）

```ts
type BaseTerm<T> = AnyToken & {value: T, comment: string[]}

export type QuotedStringTerm = {kind: AttSq | AttDq} & BaseTerm<string> &
  {children: AttStringItem[]}
export type BareStringTerm = {kind: AttBare} & BaseTerm<string> &
  {children: AttStringItem[]}
export type IdentplusTerm = {kind: AttIdentPlus, has_three_colon: boolean} & BaseTerm<string>
export type StringTerm = BareStringTerm | QuotedStringTerm  // 旧 ((B|Q) & {children}) と型同値

export type NestedTerm = {kind: AttNest} & BaseTerm<AttItem[]>
export type EntTermWComment = EntNode & {comment: string[]}  // export 化

export type Term = IdentplusTerm | StringTerm | NestedTerm | EntTermWComment
export type Label = IdentplusTerm | NestedTerm
export type AttValue = Term

export type AttLabeledByIdent = {label: IdentplusTerm} & AttValue
export type AttLabeledNested  = {label: NestedTerm} & AttValue
export type AttLabeled = AttLabeledByIdent | AttLabeledNested
export type AttPositional = {label?: undefined} & AttValue   // 新: shape discriminant
export type AttItem = AttLabeled | AttPositional             // ← 根本修正

export type AttIdentOnly = {label?: undefined} & IdentplusTerm  // 旧: 素の IdentplusTerm

export type StringishTerm = StringTerm | IdentplusTerm       // 新

export function termIsStringish(term: Term): term is StringishTerm {
  return term.kind === "bare" || term.kind === "sq" || term.kind === "dq"
    || term.kind === "identplus"
}
```

- dead type `AttLabelPair`（36 行、定義のみで未使用）を削除。
- `attValue()` の `any` コピーを rest-destructuring に:
  ```ts
  export function attValue(att: AttItem): AttValue {
    const {label: _label, ...value} = att
    return value
  }
  ```
- `AttIdentOnly` に `label?: undefined` を持たせる意味: 現行の素の `IdentplusTerm` だと
  labeled-identplus att も構造的に代入可能なため、`isIdentOnly` の**否定**分岐が
  labeled att を誤って型から消す。新定義では false 分岐に `AttLabeledByIdent` が残る（プローブ確認済）。

### 1b. `core/lrxml/src/template/parse.ts`

- `AttElement`（41 行）に discriminant を宣言:
  `export type AttElement = {kind: "attelem", label?: undefined} & ElementBody`
  → `AttItem | AttElement` 上での `att.label` アクセスが合法化され、`if (att.label)` が
  attelem も除外する。
- guard（48-99 行）の署名を正直化:
  ```ts
  export function hasLabel(att: AttItem | AttElement): att is AttLabeled {
    return att.label !== undefined            // 内部 cast 削除
  }
  export function hasStringValue(att: AttItem | AttElement)
  : att is ({label?: Label} & StringTerm) | AttIdentOnly { ... }   // 嘘を union で正直に
  export function hasQuotedStringValue(att: AttItem | AttElement)
  : att is {label?: Label} & QuotedStringTerm { ... }              // bare を型から除去
  export function isIdentOnly(att: AttItem | AttElement): att is AttIdentOnly { ... }
  export function hasNestedTerm(att: AttItem | AttElement)
  : att is {label?: Label} & NestedTerm { ... }                    // label 消失を修正
  export function isBareLabeledAtt(att: AttItem | AttElement): att is AttLabeledByIdent { ... }
  ```
  `hasNestedLabel` / `maybeArgName` / `maybePassThruVarName` は変更なし。
- 正直化の互換性: 既存消費者は narrow 後 `.value: string` しか読まないので、
  union 両腕で valid → コンパイル継続（`attlist.ts:39,97,100,108`、`text.ts:31` を個別確認済）。

### 1c. `core/lrxml/src/index.ts` — export 追加

```ts
export type {
  AttItem, AttValue, Label,
  AttLabeled, AttLabeledByIdent, AttLabeledNested, AttPositional, AttIdentOnly,
  StringTerm, QuotedStringTerm, BareStringTerm, IdentplusTerm, NestedTerm,
  EntTermWComment, StringishTerm,
} from './attlist/parse.ts'
export {
  attValue, attInnerRange, attKindIsQuotedString, isLabelTerm, termIsStringish,
} from './attlist/parse.ts'
```

`Term` は `./template/index.ts` 経由で既に export されているため重複させない（衝突回避）。
codegen0 へは `core/codegen0/src/deps.ts:3` の `export *` で自動伝播（名前衝突なし、grep 確認済）。

### 1d. 小さな消費側修正（同時に実施推奨）

- `codegen0/declaration/addArgs.ts:71` の 4-way kind ladder → `termIsStringish(att)`
  （`isBareLabeledAtt` との合成はプローブ確認済）。
- 以後、消費側は `hasLabel(att)` の代わりに素の `att.label != null` でも同じ narrowing を得られる
  （LSP がネイティブに判別を表示）。

## Stage 2 — 正規化 shape view API + collect_arg_spec 型付け + 消費側移行

### 2a. 新規 `core/lrxml/src/attlist/shape.ts` — 二段 discriminated view

依存: `./parse.ts`, `../attstring/parse.ts`, `../template/parse.ts`（循環なし）。

```ts
export type TermShape =
  | {shape: "string", text: string, quoted: boolean,
     children: AttStringItem[], node: StringTerm}
  | {shape: "ident", text: string, has_three_colon: boolean, node: IdentplusTerm}
  | {shape: "nest", items: AttItem[], node: NestedTerm}
  | {shape: "entity", node: EntTermWComment}

type TermShapeOf<T extends Term> =
  T extends StringTerm ? Extract<TermShape, {shape: "string"}> :
  T extends IdentplusTerm ? Extract<TermShape, {shape: "ident"}> :
  T extends NestedTerm ? Extract<TermShape, {shape: "nest"}> :
  T extends EntTermWComment ? Extract<TermShape, {shape: "entity"}> :
  TermShape

export function termShape<T extends Term>(term: T): TermShapeOf<T>
export function termShape(term: Term): TermShape { /* switch (term.kind) 全4腕 */ }

export type AttShape =
  | {shape: "identOnly", name: string, has_three_colon: boolean, node: AttIdentOnly}
  | {shape: "labeled", name: string, nameNode: IdentplusTerm,
     value: TermShape, node: AttLabeledByIdent}
  | {shape: "nestLabeled", label: NestedTerm, value: TermShape, node: AttLabeledNested}
  | {shape: "positional", value: Exclude<TermShape, {shape: "ident"}>, node: AttPositional}
  | {shape: "attelem", path: string[], node: AttElement}

export function attShape(att: AttItem | AttElement): AttShape { ... }
```

- 各 arm が**元 node を保持** → `ctx.token_error` / range / sourcemap `source:` がそのまま機能。
- 実装注意: labeled 判定は `isBareLabeledAtt` を内部使用（`att.label.kind` では att 自体は
  narrow しないため — プローブで確認した TS の制限）。
- フラット 9 腕案（labeledString/labeledNest/...全列挙）は棄却: 腕爆発+ cut_name_and_route が
  必要とする labeled-ident vs labeled-string の区別が失われる。二段（AttShape × TermShape）なら
  各 switch が小さく忠実。
- 新テスト `core/lrxml/test/attshape.test.ts`: 小テンプレを parse し 7 shape 全部を pin。

### 2b. `collect_arg_spec` の型消去修正（`codegen0/macro/foreach.ts:66-93`）

```ts
export function collect_arg_spec<K extends string>(
  attlist: (AttItem | AttElement)[], specList: K[]
): {ok: Partial<Record<K, TermShape>>} | {err: string, value: AttItem | AttElement}
```

本体は現行のまま、格納だけ `actual[argName] = termShape(attValue(att))` に（`as` cast 全廃。
`termShape(att)` 直渡しでも型は通るが、label は argName として消費済みなので
現行どおり `attValue()` で label を落とした値を view 化する）。
caller は `.shape` チェックだけで narrowed 値を得る:
- `macro_foreach`: `const varName = my?.shape === "ident" ? my.text : "_"`。
  `generateListExpr` は `list: TermShape` を取り、passThru 判定は
  `list.shape === "ident" && !list.has_three_colon`。
- `macro_if`: `if (primary.ok.if.shape !== "string" || !primary.ok.if.quoted) ctx.NIMPL(...)`
  → 以後 `.children` が直接見える（`collect_arg_spec` が壊していた情報が保持される）。

### 2c. `declaration/attlist.ts` cut_name_and_route — 1 switch 化

7 predicate の二重 ladder を `attShape` の単一 switch に。**挙動テーブルを厳密維持**:
- 無名: `positional` + `value.shape === "string" && value.quoted` のみ route として受理
  （bare positional は従来どおり NEVER）。
- 有名: `identOnly` → name。`labeled` → name = `s.name`、値 `"string"` → routeStr
  （labeled-ident は `value.shape === "ident"` に落ちるので従来どおり NIMPL のまま）、
  `"nest"` → `parse_method_and_route`。`nestLabeled` → NIMPL。
- `parse_method_and_route` は Stage 1 で正直化された guard のまま最小 diff。

### 2d. `declaration/addArgs.ts` add_args_cont — 1 switch 化（挙動対応表）

| 旧経路 | 新 arm |
|---|---|
| isBareLabeledAtt + bare/sq/dq/identplus → simple var (68-81) | `labeled` + 値 `"string"`/`"ident"` |
| isBareLabeledAtt + nest → code/delegate (82-118) | `labeled` + `"nest"`（内側 `fst` も attShape 化） |
| isBareLabeledAtt + entity 値 → token_error (120) | `labeled` + `"entity"` |
| isIdentOnly → simple var (123-130) | `identOnly` |
| kind === "entity" → warn Ignoring argmacro (131-134) | `positional` + `"entity"` |
| else → token_error (136) | `nestLabeled` / 残り `positional` / `attelem` |

### 2e. `codegen0/widget/element/putargs.ts` — 最後に移行

`maybeArgName` + `maybePassThruVarName` + kind ladder を attShape 1 回に。維持すべき微妙点:
- `maybePassThruVarName` は label 非依存（`x=y` の labeled 形でも passthru が効く）→
  `identOnly && !has_three_colon` **or** `labeled && value.shape === "ident" && !value.has_three_colon`。
- `nestLabeled` / `attelem` は現行どおり positional スロット経由で NIMPL に到達する順序を維持
  （エラーメッセージ互換）。
- **潜在バグ修正**: 78 行 `source: argSpec.label`（positional で undefined）→
  `s.shape === "labeled" ? s.nameNode : s.node`。

### 2f. EntPath の `instanceof Array` 排除（runtime 不変）

`core/lrxml/src/entity/parse.ts` に追加・export:
```ts
export function isEntPath(term: EntTerm): term is EntPath { return Array.isArray(term) }
```
`codegen0/widget/entity/generate.ts:102` で使用。（EntPath の kind タグ化そのものは Stage 3。）

### 2g. （任意）string source 三者不一致の明示化

`template_context/{cast,text,list}.ts` を各々 `termShape(term)` switch に置き換え、
「text は bare を許す / list は bare を NIMPL / cast は正の腕で受ける」という**意図された差**を
コード上で明示する。挙動は変えない。

### Stage 2 使用例（疑似コード）

view の読み方: **判別は `shape` 一本に正規化し、元 node は各 arm の `node` に保持**。
`ctx.token_error` / `range_text` / sourcemap の `source:` など既存 API へは `.node` を渡すので、
view を使う箇所と使わない箇所が共存でき、段階移行できる。

#### cut_name_and_route（2c の具体形）

外側 switch = label の形（AttShape）、内側 switch = 値の形（TermShape）で、構文の 2 レベル構造と
コードが 1:1 対応する。挙動対応表（すべて現行と同一）:

| 入力 | arm | 挙動 |
|---|---|---|
| `name` | `identOnly` | name 採用 |
| `name="/r"` / `name=bare` | `labeled` + `string` | routeStr |
| `name=[get "/r"]` | `labeled` + `nest` | parse_method_and_route |
| `name=ident` / `name=%e;` | `labeled` + `ident`/`entity` | NIMPL |
| `[..]=..` | `nestLabeled` | NIMPL |
| `"/r"` | `positional` + `string`(quoted) | routeStr + location2name |
| `[get "/r"]` | `positional` + `nest` | parse_method_and_route |
| `%e;` | `positional` + `entity` | NIMPL |
| （positional bare） | `positional` + `string`(!quoted) | NEVER（lexer 上あり得ない） |

```ts
if (! is_named) {
  name = ""
  // 無名 part: 先頭が positional な quoted string なら route
  if (attlist.length) {
    const s = attShape(attlist[0])
    if (s.shape === "positional"
        && s.value.shape === "string" && s.value.quoted) {
      routeStr = ctx.range_text(attlist.shift()!)
    }
  }
} else {
  if (! attlist.length) return
  const head = attlist.shift()!
  nameNode = head

  const s = attShape(head)
  switch (s.shape) {
    case "identOnly":                  // `name`
      name = s.name
      break

    case "labeled": {                  // name=".." / name=[..] / name=bare
      name = s.name                    // 旧: head.label.value（hasNestedLabel 除外後）
      const v = s.value                // v: TermShape
      switch (v.shape) {
        case "string":  routeStr = v.text; break
        case "nest":    [method, routeStr] = parse_method_and_route(ctx, head, v.items); break
        default:        ctx.NIMPL(head)   // ident / entity → 現行どおり未実装
      }
      break
    }

    case "nestLabeled":                // [..]=.. → 現行どおり NIMPL
      ctx.NIMPL(head)
      break

    case "positional": {               // "/route" / [get "/route"] / %ent;
      const v = s.value  // 型: Exclude<TermShape, {shape:"ident"}>
                         // （positional な identplus は identOnly arm に行くので 3 択で網羅）
      switch (v.shape) {
        case "string":
          if (! v.quoted) ctx.NEVER(head)   // 旧 NEVER 枝
          routeStr = v.text; break
        case "nest":
          [method, routeStr] = parse_method_and_route(ctx, head, v.items); break
        case "entity":
          ctx.NIMPL(head)
      }
      name = location2name(routeStr)
      break
    }

    case "attelem":                    // 宣言 attlist には来ない
      ctx.NEVER(s.node)
  }
}
// 後半（"/" チェック、[method, routeStr] のパック）は現行どおり
```

各 case 内では LSP が正確な arm 型を出す（`s.name: string`、`v.items: AttItem[]` 等）。
case の網羅性は tsc が検査する（`positional` の値が 3 択で尽きるのは型が保証）。

#### parse_method_and_route と stringish 共通フィールド

`TermShape` の `string` / `ident` 両 arm が**同名フィールド `text`** を持つ設計が効く
（union の共通フィールドは narrowing なしでアクセス可能）:

```ts
function parse_method_and_route(ctx, head, attlist: AttItem[]): [HTTP_METHOD, string] {
  let method, routeStr
  if (attlist.length === 2) {            // [get "/path"] — positional 2 個
    const [m, r] = attlist.map(a => attShape(a))
    method   = stringishTextOf(m) ?? ctx.token_error(head, `Unsupported route spec: ...`)
    routeStr = stringishTextOf(r) ?? ctx.token_error(head, `Unsupported route spec: ...`)
    method = method.toLowerCase()
  } else if (attlist.length === 1) {     // [get="/path"] — labeled 1 個
    const s = attShape(attlist[0])
    if (s.shape !== "labeled"
        || (s.value.shape !== "string" && s.value.shape !== "ident"))
      ctx.token_error(head, `Unsupported route spec: ...`)
    method = s.name.toLowerCase()
    routeStr = s.value.text
  } else ctx.token_error(head, `Unsupported route spec: ...`)
  // method の 'get'|'post' 検査は現行どおり
}

// 小 helper（shape.ts 置きも可）:
function stringishTextOf(s: AttShape): string | undefined {
  switch (s.shape) {
    case "identOnly": return s.name
    case "labeled": case "positional":
      return (s.value.shape === "string" || s.value.shape === "ident")
        ? s.value.text : undefined
    default: return undefined
  }
}
```

#### collect_arg_spec（2b の具体形）

型消去点を「格納する瞬間に `termShape()` で view 化し、戻り値型を
`Partial<Record<K, TermShape>>` と正直に書く」ことで消す:

```ts
export function collect_arg_spec<K extends string>(
  attlist: (AttItem | AttElement)[], specList: K[]
): {ok: Partial<Record<K, TermShape>>} | {err: string, value: AttItem | AttElement} {
  const spec = new Set<string>(specList)
  const seen = new Set<string>()
  const actual: Partial<Record<K, TermShape>> = {}
  for (const att of attlist) {
    if (att.kind === "attelem") break
    let argName: K
    if (! isBareLabeledAtt(att)) {
      if (seen.size >= specList.length) return {err: `Too many args`, value: att}
      argName = specList[seen.size]
    } else {
      const name = att.label.value
      if (! spec.has(name)) return {err: `Unknown arg ${name}`, value: att.label}
      if (seen.has(name))   return {err: `Duplicate arg ${name}`, value: att.label}
      argName = name as K            // ← spec.has で検査済み。残る cast はここ 1 箇所だけ
    }
    seen.add(argName)
    actual[argName] = termShape(attValue(att))   // ← view 化はここ 1 箇所
  }
  return {ok: actual}                // ← `as Partial<T>` が消える
}
```

- `collect_arg_spec(node.attlist, ['my', 'list'])` で `K` は `"my" | "list"` に推論されるので、
  if.ts の手書き `IfUnless` 型注釈も不要になる。
- **AttShape でなく TermShape を返す理由**: label は arg 名として消費済み（`argName` に化けている）
  ので、caller に必要な情報は値側の形だけ。

#### caller 側: macro_foreach / macro_if

```ts
// macro_foreach
const primary = collect_arg_spec(node.attlist, ['my', 'list'])
if (isError(primary)) ctx.token_error(primary.value, primary.err)
const {my, list} = primary.ok        // 型: TermShape | undefined（cast なしでこうなる）

const varName = my?.shape === "ident" ? my.text : "_"
//              ^^^^ 旧: my && my.kind === "identplus" ? my.value : "_"

if (list == null) ctx.token_error(node, `no list= is given`)
const listExpr = generateListExpr(ctx, scope, list, node)
...
output.push("for (const ",
  {kind: 'name', code: varName, source: my?.node},   // source は .node で橋渡し
  ...)

// generateListExpr は TermShape を取る形に変更（2b 参照）
function generateListExpr(ctx, scope, list: TermShape, node) {
  const passThru = list.shape === "ident" && !list.has_three_colon
    ? list.text : undefined
  let actualVar
  if (!passThru || !(actualVar = scope.lookup(passThru))) {
    return generate_as_cast_to_list(ctx, scope, list.node)   // 既存 API へは .node
  }
  if (actualVar.typeName !== "list") {
    ctx.token_error(list.node, `...should be list type.`)
  }
  return {kind: 'name', code: passThru, source: list.node}
}
```

```ts
// macro_if
const primary = collect_arg_spec(node.attlist, ['if', 'unless'])
if (isError(primary)) ctx.token_error(primary.value, primary.err)

const cond = primary.ok.if           // TermShape | undefined
if (cond) {
  if (cond.shape !== "string" || !cond.quoted) ctx.NIMPL(cond.node)
  // ↑ ctx.NIMPL: never なので、この行以降 cond は {shape:"string"} arm に narrow 済み
  //   （旧: hasQuotedStringValue(primary.ok.if) — 嘘つき guard + 消去済み型への再 narrow）
  if (! node.children) ctx.token_error(node, `yatt:if must have body`)
  armList.push(["if (", cond.children, ")", node.children])
}
```

### 移行順序

2a(+test) → 2c → 2d → 2b（foreach+if は `IfUnless` で結合しているため同時）→ 2e → 2f →（2g）。
旧 guard は Stage 2 中 export 維持（doc comment で deprecate）。削除は全消費者移行後の cleanup で。

## Stage 3 — runtime 形状変更は全て defer（設計メモ）

| 候補 | defer 理由 |
|---|---|
| `EntPath` の kind タグ化（`{kind:"path", items}`） | `entity_parse.test.ts` の JSON pin を壊す。型面の痛みは 2f で解消済み |
| value フィールド名統一（entity=path / nest=AttItem[] / string） | `TermShape` が view 層で正規化済み。rename は純粋な churn |
| attelem の attlist 分離 | empty-attelem の「後続 sibling 捕獲」挙動（`template/parse.ts:213-215`）と絡む。`AttShape` の attelem 腕で消費側は既に清潔 |

いずれも実需要（新機能）が出た時に再検討。

## 進捗（2026-08-11 時点）

- **Stage 1 は実装・commit 済み**: `d816fc7`（step1: `{label?: undefined} & ...` union 化）、
  `c6a9a00`（step2: guard 正直化）、`1f423d5`（addArgs の `termIsStringish(att)` 化）。
- **Stage 2a は着手済み**: `core/lrxml/src/attlist/shape.ts` に TermShape / TermShapeOf / AttShape の
  型定義が存在（未 commit）。`termShape()` / `attShape()` の実装と `attshape.test.ts` はこれから。
- 当初の前提条件だった未 commit 作業（`putargs.ts` +1 行、`spec_xhf/1-basic.xhf` −1 行）は
  着地済み。新 fixture `test/input/entvar-html.ytjs` は未 commit のまま残っている。
  putargs の移行（2e）を最後に置く順序は維持する。

## 検証

- 各ステップで `deno test -RE`（core/lrxml → core/codegen0 → util/xhf）+ root `bun test`。
  **bun は型検査をしないので、deno test が型ゲート**。
- **CLI byte-diff（runtime 不変の証明）**: 変更前後で出力が完全一致すること。
  - `./core/lrxml/src/template/parse.ts <sample.ytjs>`（parse 木ダンプ）
  - `./core/codegen0/src/codegen0/namespace/generate.ts` / `module/generate.ts` /
    `populator/runner.ts` を `core/codegen0/test/input/ex1/public/subgroup1/index.ytjs` に対して
  - `./core/codegen0/src/xhftest.ts core/codegen0/test/spec_xhf/1-basic.xhf`（100 件の挙動 pin）
- 新規 `attshape.test.ts` が 7 shape を pin。

## リスク

- **never 駆動の負 narrowing**: 消費側の正しさが `ctx.NIMPL/NEVER/token_error: never`
  （lrxml `context.ts:172,197,207`）に依存。guard 正直化は**負の分岐**の型を変えるため、
  型システム上だけ到達可能だった分岐が `never` 化して新規エラーが出うる（望ましい方向だが
  小修正の予算を取る）。これら関数の戻り値型を変えるリファクタは数十箇所の narrowing を
  静かに壊すので**厳禁**。
- **テストの JSON pin**: Stage 1-2 は runtime 形状を変えないので期待値更新は不要のはず。
  CLI byte-diff が安全網。
- **deps.ts の `export *` 面**: lrxml の新 export は codegen0 の再 export 面へ自動伝播する。
  新名（`TermShape`/`AttShape`/`termShape`/`attShape`/`termIsStringish`/`isEntPath`）は
  衝突チェック済み。

## 棄却した代替案（要点のみ）

- **boolean shape フラグ / wrapper node `{label?, value: Term}`**: どちらも runtime 形状変更 →
  JSON pin 全滅 + parser の spread 構築箇所全書き換え。`label?: undefined` で同じ narrowing が
  無料で手に入る。
- **`'label' in att` 慣用**: in-narrowing は optional プロパティ腕を両分岐に残すため判別が弱い。
  AttElement 対応にも結局 `label` 宣言が要る。
- **フラット 9 腕 AttShapeView**: 腕爆発 + labeled-ident/labeled-string の区別喪失（2a 参照）。
- **generic `AttOf<V extends Term>` 型ファクトリ**: 再利用の利得が小さく LSP hover が読みにくい。

## スコープ外 / 継続

- 本計画の実装は別サイクルで進行中（Stage 1 完了、Stage 2a 着手済み — 上記「進捗」参照）。
- entity 定義の positional CON 統一・AST ローダー（`entity-definition-placement.md`）とは独立
  （あちらは entity **関数**の宣言解析、こちらは attribute **ノード**の型設計）。
- `AttStringItem` の RangeLine 化（`attstring/parse.ts:18` の既存 XXX）は本件と直交、別途。
