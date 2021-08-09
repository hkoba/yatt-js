#!/usr/bin/env ts-node

import {
  parse_template, Node, ScanningContext
  , AttItem
  , isIdentOnly, isBareLabeledAtt
  , hasStringValue
  , extract_line, extract_prefix_spec
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
  program += `export namespace tmpl {\n`

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

  program += '}\n'
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
    args.push(name); // XXX: default value
    const opt = (() => {
      if (varSpec.defaultSpec && varSpec.defaultSpec[0] === "!") {
        return ""
      }
      return "?";
    })()
    types.push(`${name}${opt}: string`); //XXX: ${varSpec.typeName} typeMap
  }

  //XXX: this, CON
  const scope = new VarScope(new Map, new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap)))

  program += `(this: typeof tmpl, CON: yatt.runtime.Connection, {${args.join(', ')}}: {${types.join(', ')}}) {\n`;

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
        program += from_element(ctx, scope, node);
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

function from_element(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'element'}
) // : string
{
  // XXX: macro_if, foreach, ...
  // XXX: find_callable_var

  const [_ns, wname, ...rest] = node.path;

  let calleeWidget: Widget | undefined

  if (rest.length === 0 && ctx.template.partMap.widget.has(wname)) {
    calleeWidget = ctx.template.partMap.widget.get(wname)!
  } else {
    console.dir(node.path, {color: true, depth: null})
    ctx.NIMPL()
  }

  if (calleeWidget == null) {
    ctx.token_error(node, `No such widget ${node.path.join(':')}`)
  }

  // XXX: ensure_generated
  // XXX: add_dependecy

  const argsExpr = gen_putargs(ctx, scope, node, calleeWidget);

  return ` this.render_${wname}(CON, {${argsExpr}});`
}

function gen_putargs(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'element'}
  , calleeWidget: Widget
  // , delegateVars
) :string
{
  const formalArgs = calleeWidget.argMap;
  const actualArgs = new Map
  for (const argSpec of node.attlist) {
    if (argSpec.kind === "attelem") {
      // <:yatt:name>...</:yatt:name>
      ctx.NIMPL()
    }
    else if (isBareLabeledAtt(argSpec) && argSpec.kind === "identplus") {
      // name=name
      passThrough(argSpec, argSpec.label.value, argSpec.value)
    }
    else if (isIdentOnly(argSpec)) {
      // name
      passThrough(argSpec, argSpec.value, argSpec.value)
    }
    else if (isBareLabeledAtt(argSpec) && hasStringValue(argSpec)) {
      // name='foo' name="bar"
      const formalName = argSpec.label.value
      if (! formalArgs.has(formalName)) {
        ctx.token_error(argSpec, `No such argument: ${formalName}`)
      }
      const formal = formalArgs.get(formalName)!
      if (actualArgs.has(formalName)) {
        ctx.token_error(argSpec, `Duplicate argument: ${formalName}`)
      }
      const s = escapeAsStringLiteral(argSpec.value)
      actualArgs.set(formalName, `${formalName}: ${s}`)
    }
    else {
      // 'foo' "bar"
      // entity, nest
      console.dir(argSpec, {color: true, depth: null});
      ctx.NIMPL()
    }
  }

  return [...actualArgs.values()].join(', ');

  function passThrough(argSpec: AttItem, formalName: string, actualName: string) {
    if (! formalArgs.has(formalName)) {
      ctx.token_error(argSpec, `No such argument: ${formalName}`)
    }
    const formal = formalArgs.get(formalName)!
    const actual = scope.lookup(actualName)
    if (actual == null) {
      ctx.token_error(argSpec, `No such variable: ${actualName}`)
    }
    if (formal.typeName !== actual.typeName) {
      ctx.token_error(argSpec, `Variable type mismatch: ${formalName}\nExpected: ${formal.typeName} Got: ${actual.typeName}`)
    }
    if (actualArgs.has(formalName)) {
      ctx.token_error(argSpec, `Duplicate argument: ${formalName}`)
    }
    actualArgs.set(formalName, `${formalName}: ${actualName}`)
  }
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

  let filename, source;
  if (args.length) {
    filename = args[0]
    source = readFileSync(filename, {encoding: "utf-8"})
  } else {
    filename = `dummy.ytjs`;
    source = `<yatt:foo x=3 y=8/>
aaa
<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
&yatt:y;
`
  }

  console.time(`parse template declaration`)
  const [template, session] = build_template_declaration(
    source,
    {filename, ...config}
  )
  console.timeEnd(`parse template declaration`)

  console.time(`generate`)
  const script = generate(template, session)
  console.timeEnd(`generate`)
  process.stdout.write('\n' + script + '\n');

  console.time(`makeProgram (ts to js)`)
  let {program, outputMap, diagnostics} = makeProgram(script, {
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

  if (diagnostics && diagnostics.length > 0) {
    // console.dir(outputMap, {color: true, depth: 4});
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
        console.dir(diagnostics, {color: true, depth: 3})
      }
    }
    process.exit(1);
  } else {
    console.log(outputMap)
  }

  console.timeEnd(`makeProgram (ts to js)`)
  console.time(`comple nodejs module`)
  const mod = compile([...outputMap.values()].join('\n'), filename)
  console.timeEnd(`comple nodejs module`)
  const ns = mod.exports['tmpl']
  const fn = ns ? ns['render_'] : undefined;
  if (fn != null) {
    let CON = {
      buffer: "",
      append(str: string) {
        this.buffer += str;
      },
      appendUntrusted(str?: string) {
        if (str == null) return;
        this.buffer += yatt.runtime.escape(str)
      }
    }
    fn.apply(ns, [CON, {}]);

    process.stdout.write(`\n=== output ====\n`);
    process.stdout.write(CON.buffer);
  }
})()
