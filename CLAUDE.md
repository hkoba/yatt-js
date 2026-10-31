# CLAUDE.md

yatt-js — Perl 製テンプレートエンジン YATT の TypeScript 移植。

## 開発メモ

- **実行ビット付き `*.ts` は単体 CLI として直接実行できる**（ジェネレータや parser を
  動作確認するときは、まず直接実行して出力を見るのが速い）。一覧・実行方法・主な入口は
  [docs/dev/runnable-modules.md](docs/dev/runnable-modules.md) を参照。
- 回帰テストは各パッケージで `deno test -RE`（`core/codegen0`, `core/lrxml`, `util/xhf`）。

## 設計・議論ドキュメント

- `docs/plan/` … 移行計画・命名規約レビュー（gas-clasp3 移行、suffix-`$` 規約 等）
- `docs/discuss/` … 命名ポリシーの方針メモ
