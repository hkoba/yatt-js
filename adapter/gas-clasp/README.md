# Limited support for gas clasp through typescript namespace

- `.clasp.json` に `"rootDir":"root"` が設定されていること
- `root/.claspignore` に `*.yatt` が書かれていること
- `*.yatt` は root の下に置くこと。これが `*.ts` へ変換される


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
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```
