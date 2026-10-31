
- 名前衝突回避は suffix `$` ルールを採用
  - `$yatt.public$`, `$yatt.static$`
- `$yatt.runtime` は、暫定的に維持（ `runtime$` にする可能性はあるが、そうすると yatt の entity 呼び出し構文を拡張しないと呼び出せなくなるのが問題）
- `$yatt.<entity名>`
  - spread による構築に切り替え（二層構造で Object.keys などに変化が出ることは良くない）
  - hot-reload 時、`builtins` にある名前はロードを拒否する
- `$yatt` の型名の案： `$yattType` はどうかしら？
