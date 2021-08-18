import Module = require('module');
// Use this style because class Module is exporeted via 'export ='

import ts = require('typescript')

export function compile(script: string, filename: string): Module {
  type compiler = (this: Module, src: string, id: string) => any;
  let m = new Module(filename);
  const compile: compiler = (m as unknown as Module & {_compile: compiler})._compile;
  compile.apply(m as unknown as Module, [script, filename])
  return m as unknown as Module;
}


// Stolen and modified from:
// transpileModule in TypeScript/src/services/transpile.ts
// createTypescriptContext in angular-cli/packages/ngtools/webpack/src/transformers/spec_helpers.ts
//
export function makeProgram(input: string, transpileOptions: ts.TranspileOptions)
// : ts.CompilerHost
{
  const options: ts.CompilerOptions = transpileOptions.compilerOptions ?? {};
  options.target ??= ts.ScriptTarget.ES2015;
  options.suppressOutputPathCheck = true;
  const inputFileName = transpileOptions.fileName ?? "module.ts";
  const sourceFile = ts.createSourceFile(inputFileName, input, options.target)
  if (transpileOptions.moduleName) {
    sourceFile.moduleName = transpileOptions.moduleName
  }

  let outputMap = new Map;
  let sourceMapText: string | undefined;
  let diagnostics: [string, ts.Diagnostic][] = []

  const compilerHost = ts.createCompilerHost(options, true)
  const origGetSourceFile = compilerHost.getSourceFile
  compilerHost.getSourceFile =
    (fileName, version) => fileName === inputFileName ? sourceFile
    : origGetSourceFile(fileName, version);
  compilerHost.writeFile = (name: string, text: string) => {
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
    console.error(`Compilation failed`);
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

  return {program, outputMap, sourceMapText, diagnostics};
}

