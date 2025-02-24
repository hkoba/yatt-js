# Limited support for gas clasp through typescript namespace

- `.clasp.json` に `"rootDir":"root"` が設定されていること

```sh
clasp login

mkdir $projectDir && cd $_

clasp clone https://script.google.com/home/projects/XXXXX/edit --rootDir root

mv root/.clasp.json .

echo '{}' > package.json

npm i --save-dev @types/google-apps-script
```


### tsconfig.json

```json
{
  "compilerOptions": {
    "module": "none", // This is important to use namespace-based templates.
    "target": "es2015",
    "lib": ["esnext"]
  }
}
```

## typescript 名前空間

```typescript
// `$yatt.$tmpl` は自動生成されるコードのための名前空間
namespace $yatt.$tmpl {
  namespace $yatt.$tmpl.index {
    // index.yatt の変換結果。
    // ファイルの生成先は root/_yatt/index.ts
  }
}

// `$yatt.runtime` は yatt が実行時に用いる関数の格納場所。手書き
namespace $yatt.runtime {
}

// `$yatt` 直下に置いた関数は entity として yatt から参照可能
namespace $yatt {
  // ファイルの保存先は root/_yatt.entity.ts
}
```

## ディレクトリ構造

- `*.yatt` は `pages/` の下に置くこと。これが `root/_yatt/*.ts` へ変換される
- `runtime/_yatt.*.ts` はそのまま `root/_yatt.*.ts` へコピーされる（同名のファイルが既にあれば無視する）

```tree
.
├── .clasp.json
├── .gitignore
├── package.json
├── root
│   ├── .claspignore
│   ├── Code.ts
│   ├── _yatt                ← yatt のテンプレートから生成されたコードの格納場所
│   │   ├── _static.ts
│   │   ├── error.ts
│   │   ├── index.ts
│   │   └── page2.ts
│   ├── _yatt.connection.ts
│   ├── _yatt.entity.ts      ← entity の置き場
│   ├── _yatt.gas.sidebar.ts
│   ├── _yatt.gas.htmlservice.ts
│   ├── _yatt.runtime.ts
│   └── appsscript.json
├── pages　    　　　　　　　　← yatt のテンプレートの置き場所
│   ├── error.ytjs
│   ├── index.yatt
│   └── page2.yatt
└── tsconfig.json
```
