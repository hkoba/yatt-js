#!/usr/bin/env -S deno run -RE

import ts from 'npm:typescript'

import {extract_line, extract_prefix_spec} from '../deps.ts'

// XXX: diagnostics が空になる。何故？
export function transpileModule(source: string)
{

  const diagnostics: ts.Diagnostic[] = []

  const outputText = ts.transpile(source, {
    target: ts.ScriptTarget.ES2015,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "allowImportingTsExtensions": true,
    noCheck: false,
    reportDiagnostics: true,
  }, 'dummy.ts', diagnostics, 'dummy.ts');

  return {outputText, diagnostics}
}

// Stolen and modified from:
// transpileModule in TypeScript/src/services/transpile.ts
// createTypescriptContext in angular-cli/packages/ngtools/webpack/src/transformers/spec_helpers.ts
//
export function makeProgram(
  input: string,
  types?: string[],
  transpileOptions: ts.TranspileOptions = {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        /* Strict Type-Checking Options */
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "strictBindCallApply": true,
        "strictPropertyInitialization": true,
        "noImplicitThis": true,
        "alwaysStrict": true,
        "allowImportingTsExtensions": true,
      }
    })
// : ts.CompilerHost
{
  const options: ts.CompilerOptions = transpileOptions.compilerOptions ?? {};
  options.target ??= ts.ScriptTarget.ES2015;
  options.suppressOutputPathCheck = true;
  options.moduleResolution = ts.ModuleResolutionKind.Bundler
  options.types = types; // XXX
  // options.lib = []; // ←流石にこれがないと Number とかも駄目になるぽい。 node_modules/.deno/typescript@xx から来る

  const inputFileName = transpileOptions.fileName ?? "module.ts";
  const sourceFile = ts.createSourceFile(inputFileName, input, options.target)
  if (transpileOptions.moduleName) {
    sourceFile.moduleName = transpileOptions.moduleName
  }

  const outputMap = new Map;
  let sourceMapText: string | undefined;
  const diagnostics: [string, ts.Diagnostic][] = []

  const compilerHost = ts.createCompilerHost(options, true)
  const origGetSourceFile = compilerHost.getSourceFile
  compilerHost.getSourceFile = (fileName, version) => {
    // console.log(`tsc:getSourceFile: ${fileName}`)
    if (fileName === inputFileName) {
      return sourceFile
    } else {
      return origGetSourceFile(fileName, version)
    }
  };
  compilerHost.writeFile = (name: string, text: string) => {
    // console.log(`output(${name}=${text})`)
    if (/\.map$/.exec(name)) {
      if (sourceMapText != null)
        throw new Error(`Multiple sourcemap output`)
      sourceMapText = text;
    } else {
      outputMap.set(name, text)
    }
  }

  const program = ts.createProgram([inputFileName], options, compilerHost);

  program.emit();

  if (outputMap.size === 0) {
    console.error(`Compilation failed(outputMap.size === 0)`);
  }

  for (const diag of program.getSyntacticDiagnostics()) {
    diagnostics.push(['Syntactic', diag])
  }
  for (const diag of program.getGlobalDiagnostics()) {
    diagnostics.push(['Global', diag])
  }
  for (const diag of program.getSemanticDiagnostics()) {
    diagnostics.push(['Semantic', diag])
  }
  for (const diag of program.getDeclarationDiagnostics()) {
    diagnostics.push(['Declaration', diag])
  }

  const outputText = [...outputMap.values()].join('\n')

  return {outputText, outputMap, sourceMapText, diagnostics};
}

export function reportDiagnostics(script: string, diagnostics: [string, ts.Diagnostic][]): void {
  // console.dir(outputMap, {colors: true, depth: 4});
  const dummyModName = 'module'
  for (const [kind, diag] of diagnostics) {
    if (diag.file && diag.file.fileName === `${dummyModName}.ts`
        &&
        diag.start != null && diag.messageText != null) {
      const messageText = typeof diag.messageText === 'string' ?
        diag.messageText : diag.messageText.messageText;
      console.log(`${kind} error: ${messageText}`)
      const [lastNl, _lineNo, colNo] = extract_prefix_spec(script, diag.start)
      const tokenLine = extract_line(script, lastNl, colNo)
      console.log(tokenLine)
    }
    else {
      console.dir(diagnostics, {colors: true, depth: 3})
    }
  }
}

if (import.meta.main) {
  const process = await import('node:process')
  // const {readFileSync} = await import('node:fs')
  
  const args = process.argv.slice(2)

  const [source, typesJson, tsconfigJson] = args

  //  const source = readFileSync(filename, {encoding: 'utf-8'})

  const result = makeProgram(
    source,
    typesJson ? JSON.parse(typesJson) : [],
    tsconfigJson ? JSON.parse(tsconfigJson) : {}
  )

  console.log(result)
}
