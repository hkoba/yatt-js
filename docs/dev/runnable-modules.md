# 実行ビット付き `*.ts` は単体コマンドとして直接試せる

このリポジトリの多くの `*.ts` モジュールは、実行ビット（`u+x`）が立っていて
`#!/usr/bin/env -S deno run ...` の shebang と `if (import.meta.main) { ... }`
ブロックを持つ。**ライブラリであると同時に CLI でもある**ので、動作確認・デバッグの際は
専用のテストを書く前に、まず該当モジュールを直接実行して出力を目視できる。

## 実行方法

```sh
# shebang 経由（実行ビットが立っているので直接）
./core/codegen0/src/codegen0/namespace/generate.ts <template-file>

# もしくは deno run で明示（権限フラグは shebang と同じ -RE 等）
deno run -RE core/codegen0/src/codegen0/namespace/generate.ts <template-file>
```

## 実行可能モジュールの探し方

```sh
find . -name '*.ts' -perm -u+x -not -path '*/node_modules/*'
```

## 動作確認でよく使う入口（例）

| モジュール | 用途 | 引数の例 |
|---|---|---|
| `core/codegen0/src/codegen0/namespace/generate.ts` | namespace スタイル生成 | テンプレファイル |
| `core/codegen0/src/codegen0/module/generate.ts` | module スタイル生成 | テンプレファイル |
| `core/codegen0/src/codegen0/populator/generate.ts` | populator スタイル生成 | テンプレファイル |
| `core/codegen0/src/codegen0/populator/runner.ts` | populator を生成し実行 | テンプレファイル |
| `core/codegen0/src/client/bundle.ts` | client(browser) TS の transpile/bundle（esbuild） | `[--outDir=DIR] [--format=iife\|esm] <entry.ts>...` |
| `core/codegen0/src/xhftest.ts` | `.xhf` spec を流す | `test/spec_xhf/*.xhf` |
| `adapter/gas-clasp/build.ts` | gas-clasp 一括ビルド | （`./pages` を走査） |
| `adapter/gas-clasp/migrate.ts` | gas-clasp 命名規約 migration | `[--dry-run] [root...]` |
| `core/lrxml/src/template/{parse,tokenize}.ts` | テンプレの parse / tokenize 確認 | テンプレファイル |

サンプルのテンプレートは `core/codegen0/test/`（例: `test/input/ex1/public/subgroup1/index.ytjs`、
`test/find_widget.d/`）や `core/codegen0/example/` 配下にある。

## 正式なテストスイート

回帰確認は単体実行に加えて Deno のテストランナーを使う:

```sh
cd core/codegen0 && deno test -RE     # 同様に core/lrxml, util/xhf でも
```

> 補足: ジェネレータを `.xhf` に対して直接 `xhftest.ts` で流すと、未実装機能を含む item
> （例: 一部の `<yatt:body/>`）でエラーになることがある。網羅的な合否は `deno test` を正とする。
