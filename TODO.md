# TODOs

## populator スタイルのコード生成の確立
- ディレクトリーハンドラーの扱い
  - リンケージとメタ情報の生成までは面倒を見る
  - リクエストハンドラーは自分で作れるようにする？
- 他のファイル・ディレクトリ内の widget を load 時に bind するか、実行時に任せるか
  - モジュール再ロード時のトラブルが少ないのはどちらか？
- 芋づる式コード生成

- delegate の merge を許す
- `&yatt:render();` とインターフェース

## 全体？

- async で揃える

## AST とコード生成の整理

- attlist の型の整理と、局所変数生成コードのライブラリ化（`yatt:foreach`, `yatt:my`）

- [ ] xhf tests


## Overall

- [ ] Rethink about config options  
(Currently, many options originated from yatt\_lite have the same names as their originals to reduce errors of code porting)

## Core Codegen Layer


- sourcemap support
   - [x] underlying logic
   - [ ] tests
   - [ ] adaptor support?(where to save the sourcemap?)
- more builtin macros
   - [x] `yatt:foreach`
     - [ ] extensibility
   - [ ] `yatt:if`
   - [x] `yatt:my`
     - [ ] `yatt:let`
- [ ] default values
- [ ] ts-native types
- [ ] generate without types?

- [ ] `&yatt:render(widget);` with interface/type

## For Generic Web App Support

- [ ] Platform neutral yatt runtime?

   - [ ] `app.render()`, `app.do()`??

      - [ ] Throw/Catch special response

      - [ ] Sigil mappings for pages and actions

      - [ ] Inline route for yatt:page decls

- [ ] Platform neutral directory organization for entities, pages, widgets and components?

## For Node

- [ ] router generator

