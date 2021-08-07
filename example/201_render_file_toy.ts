#!/usr/bin/env ts-node

import {
  parse_template, Node, ScanningContext
} from 'lrxml-js'

import {
  build_template_declaration, TemplateDeclaration,
  BuilderSession, Part, Widget,
  Variable
} from '../src/declaration/'

import {yatt} from '../src/yatt'

function generate(template: TemplateDeclaration, session: BuilderSession)
: string
{
  let program = `import {yatt} from '../src/yatt'\n`;

  for (const [kind, name] of template.partOrder) {
    const partMap = template.partMap[kind]
    const part = partMap.get(name)
    if (part == null)
      throw new Error(`BUG: Unknown part ${kind} ${name}`)

    switch (part.kind) {
      case "entity": case "action": break;
      case "widget": {
        if (part.raw_part == null)
          continue;
        let ctx = new CodeGenContext<Widget>(template, part, session);
        let ast = parse_template(session, part.raw_part)
        program += generate_widget(ctx, ast)
      }
    }
  }
  return program;
}

class VarScope extends Map<string, Variable> {
  constructor(vars?: Map<string, Variable>, public parent?: VarScope) {
    super();
    if (vars != null) {
      for (const [k, v] of vars) {
        this.set(k, v)
      }
    }
  }

  lookup(varName: string): Variable | undefined {
    if (this.has(varName)) {
      return this.get(varName)
    }
    else if (this.parent) {
      return this.parent.lookup(varName)
    }
  }
}


class CodeGenContext<T extends Part> extends ScanningContext<BuilderSession> {
  constructor(
    public template: TemplateDeclaration, public part: T,
    session: BuilderSession
  ) {
    super(session, 0, 0, session.source.length)
  }
}

function generate_widget(ctx: CodeGenContext<Widget>, nodeList: Node[])
// : string
{
  let program = `export function render_${ctx.part.name} `;
  const args = []
  const types = []
  for (const [name, varSpec] of ctx.part.argMap.entries()) {
    args.push(name)
    types.push(`${name}: string`); //XXX: ${varSpec.typeName} typeMap
  }

  //XXX: this, CON
  const scope = new VarScope(new Map, new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap)))

  program += `(CON: yatt.runtime.Connection, {${args.join(',')}}: {${types.join(',')}}) {\n`;

  for (const node of nodeList) {
    switch (node.kind) {
      case "comment":
      case "attelem":
      case "pi":
      case "lcmsg": break;
      case "text": {
        let s = escapeAsStringLiteral(ctx.range_text(node))
        program += ` CON.append(${s});`;
        if (node.lineEndLength)
          program += "\n";
        break;
      }
      case "element":
        break;
      case "entity":
        program += from_entity(ctx, scope, node);
        break;
      default:
        ctx.NEVER();
    }
  }

  program += `}`;

  return program;
}

function from_entity(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'entity'}
) {
  if (node.path.length !== 1) {
    ctx.NIMPL()
  }
  const head = node.path[0]
  switch (head.kind) {
    case 'var': {
      const variable = scope.lookup(head.name)
      if (variable == null)
        ctx.token_error(node, `No such variable: ${head.name}`);
      // XXX: type specific generation
      return ` CON.appendUntrusted(${head.name});`
    }
    case 'call':
    default:
      ctx.NIMPL()
  }
}

function escapeAsStringLiteral(text: string): string {
  return "'" + text.replace(
    /['\\\r\n]/g, (chr) => {
      const map = {"\\": "\\\\", "\r": "\\r", "\n": "\\n", "'": "\\'"};
      return map[chr as "'"|"\\"|"\r"|"\n"]
    }
  ) + "'"
}

import Module = require('module');
// Use this style because class Module is exporeted via 'export ='

function compile(script: string, filename: string): Module {
  type compiler = (this: Module, src: string, id: string) => any;
  let m = new Module(filename);
  const compile: compiler = (m as unknown as Module & {_compile: compiler})._compile;
  compile.apply(m as unknown as Module, [script, filename])
  return m as unknown as Module;
}

import ts from 'typescript'

// Stolen and modified from:
// transpileModule in TypeScript/src/services/transpile.ts
// createTypescriptContext in angular-cli/packages/ngtools/webpack/src/transformers/spec_helpers.ts
//
function makeProgram(input: string, transpileOptions: ts.TranspileOptions)
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

  let outputText: string[] = []
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
      outputText.push(text);
    }
  }

  const program = ts.createProgram([inputFileName], options, compilerHost);

  program.emit();

  if (outputText.length === 0) {
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

  return {program, outputText: outputText.join('\n'), sourceMapText, diagnostics};
}

(async () => {
  let args = process.argv.slice(2)
  const { parse_long_options } = await import('lrxml-js')
  const { readFileSync } = await import('fs')
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    body_argument_name: "body",
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config})

  let [filename, ...rest] = args;
  const [template, session] = build_template_declaration(
    readFileSync(filename, {encoding: "utf-8"}),
    {filename, ...config}
  )

  const script = generate(template, session)
  process.stdout.write('\n' + script + '\n');

  let {program, outputText, diagnostics} = makeProgram(script, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      /* Strict Type-Checking Options */
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "strictFunctionTypes": true,
      "strictBindCallApply": true,
      "strictPropertyInitialization": true,
      "noImplicitThis": true,
      "alwaysStrict": true,
    }
  })

  console.log(program)

  if (diagnostics && diagnostics.length > 0) {
    console.error(diagnostics)
    process.exit(1);
  }

  const mod = compile(outputText, filename)
  const fn = mod.exports['render_']
  if (fn != null) {
    let CON = {
      buffer: "",
      append(str: string) {
        this.buffer += str;
      },
      appendUntrusted(str: string) {
        this.buffer += yatt.runtime.escape(str)
      }
    }
    fn(CON, {});

    process.stdout.write(`\n=== output ====\n`);
    process.stdout.write(CON.buffer);
  }
})()
