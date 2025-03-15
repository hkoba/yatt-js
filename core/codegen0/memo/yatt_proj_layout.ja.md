# ディレクトリ構成に関する論点整理

yatt-js ベースのプロジェクトのディレクトリ構成をどうするのが良いか…
後で迷子にならないよう、現時点の構想と論点をここに記す。

## 前提・目標

- yatt-js は、第一にはサーバー側の MPA 用のテンプレートエンジン（将来はともかく…）
- Web Request に対して(Perl版と同様に) noEmitで serve できるようにしたい。PHPのようにファイル本置きで動いて欲しい。
  - ただし、emit も出来るようにしたい（特に clasp では build/deploy が不可避）

## clasp の場合と、それ以外とが極端に違いすぎる

|論点|clasp|deno, bun, node|browser|
|-|-|-|-|
|importが使えるか？|N|Y|Y|
|ディレクトリに意味が有る？|N|Y|Y|
|emit(build)が必要か？|Y|N|Y|

## 構成要素と、考えうる置き場所の候補

|論点|clasp|deno, bun, node|
|-|-|-|
|App のエントリーポイント|-|?`app.ts`|
|公開ページの置き場|`pages/*.yatt`|`public/*.yatt`|
|static公開ファイルの置き場|?|`static/`|
|Dir ハンドラー置き場|`root/_yatt.runtime.ts`|?`public/+runtime.ts`|
|Dir Entity置き場|`root/_yatt.entity.ts`|?`public/+entity.ts`|
|template(set) emit 先|`root/_yatt/`|?`_gen/public.mts`<br>?`_gen/public/*.mts`|
|template(set) type emit先|-|?`_gen/public.types.ts`<br>?`types/public.types.ts`<br>?`public.types.ts`<br>?`public/+types.ts`|
|プライベートな部品置き場|`widgets/*.yatt`<br>`ytmpl/*.yatt`|`widgets/*.yatt`<br>`ytmpl/*.yatt`|

* emit(build) をしないなら、`*.yatt` テンプレートも `public/` に置けたほうが、覚えることを減らせるメリットが有る。
* `public` に置く場合、yatt 固有の要素で、クライアントに publish したくないファイルはどうするか？
  - 共通の prefix をつけてアクセス禁止を設定しやすくする（svelte の `+` のように）
* emit(build) の出力は `_gen/` などの一つのディレクトリにまとめたい（一括で削除したい、誤削除・誤commitを抑止したい）
  - `_gen/` に ts として出力。それを esm に変換したものを `_dist/` に出力？
    - node が `--experimental-strip-types` をサポートしたのだから、 `_dist/` は browser のためだけと考えて良いかも？

## ブラウザー用のコードはどうするのか？

|論点|clasp|deno, bun, node|
|-|-|-|
|browser src置き場|?|?|
|browser esm/bundle build出力先|-|?`static/_dist/`|
|browser script build出力先|?`root/_dist/*.html`|-|
