#!/usr/bin/env ts-node

import {
  parse_template, Node, ScanningContext
  , AttItem
  , isIdentOnly, isBareLabeledAtt
  , hasStringValue
  , extract_line, extract_prefix_spec
} from 'lrxml'

import {
  build_template_declaration, TemplateDeclaration,
  BuilderSession, Part, Widget,
  Variable
} from '../src/declaration/'

import {yatt} from '../src/yatt'
import {VarScope} from '../src/codegen0/varscope'

type CGenSession  = BuilderSession & {
}

function generate(template: TemplateDeclaration, session: CGenSession)
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

class CodeGenContext<T extends Part> extends ScanningContext<CGenSession> {
  constructor(
    public template: TemplateDeclaration, public part: T,
    session: CGenSession
  ) {
    super(session, 0, 0, session.source.length)
  }
}

function varTypeExpr(ctx: CodeGenContext<Widget>, vr: Variable): string {
  switch (vr.typeName) {
    case "text":
      return 'string';
    case "widget": {
      // [...vr.widget.argMap.values()].map((a) => {
      // })
      return `(CON: yatt.runtime.Connection, {}: {}) => void`;
    }
    default:
      ctx.NIMPL();
  }
}

function generate_widget(ctx: CodeGenContext<Widget>, nodeList: Node[])
// : string
{
  let program = `export function render_${ctx.part.name} `;

  //XXX: this, CON
  const scope = new VarScope(new Map, new VarScope(ctx.part.varMap, new VarScope(ctx.part.argMap)))

  const argDecls = generate_argdecls(ctx, scope, ctx.part);

  program += `(this: typeof tmpl, CON: yatt.runtime.Connection, ${argDecls}) {const $this = this\n`;

  program += as_print(ctx, scope, nodeList);

  program += `}`;

  return program;
}

function generate_argdecls(ctx: CodeGenContext<Widget>, _scope: VarScope, widget: Widget): string {
  const args = []
  const types = []
  for (const [name, varSpec] of widget.argMap.entries()) {
    args.push(name); // XXX: default value
    const opt = (() => {
      if (varSpec.defaultSpec && varSpec.defaultSpec[0] === "!") {
        return ""
      }
      return "?";
    })()
    // XXX: readonly?
    const typeExpr = varTypeExpr(ctx, varSpec)
    types.push(`${name}${opt}: ${typeExpr}`);
  }
  return `{${args.join(', ')}}: {${types.join('; ')}}`
}

function as_print(ctx: CodeGenContext<Widget>, scope: VarScope, nodeList: Node[]): string {
  let program = ""
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

  return program;
}

function find_callable_var(scope: VarScope, varName: string): Variable | undefined {
  const vr = scope.lookup(varName)
  if (vr != null && vr.is_callable)
    return vr;
}

function from_element(
  ctx: CodeGenContext<Widget>, scope: VarScope, node: Node & {kind: 'element'}
) // : string
{
  // XXX: macro_if, foreach, ...
  // XXX: find_callable_var

  const [_ns, wname, ...rest] = node.path;

  let callExpr: string | undefined
  let calleeWidget: Widget | undefined

  const callable_var = find_callable_var(scope, wname);

  if (callable_var) {
    switch (callable_var.typeName) {
      case "widget":
        calleeWidget = callable_var.widget;
        callExpr = `${callable_var.varName} && ${callable_var.varName}`;
        break;
      default:
        ctx.NIMPL();
    }
  }
  else if (rest.length === 0 && ctx.template.partMap.widget.has(wname)) {
    calleeWidget = ctx.template.partMap.widget.get(wname)!
    callExpr = `$this.render_${wname}`;
  }
  else {
    console.dir(node.path, {color: true, depth: null})
    ctx.NIMPL()
  }

  if (calleeWidget == null) {
    ctx.token_error(node, `No such widget ${node.path.join(':')}`)
  }

  // XXX: ensure_generated
  // XXX: add_dependecy

  const argsExpr = gen_putargs(ctx, scope, node, calleeWidget);

  return ` ${callExpr}(CON, {${argsExpr}});`
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
      // XXX: typecheck!
      // name=name
      passThrough(argSpec, argSpec.label.value, argSpec.value)
    }
    else if (isIdentOnly(argSpec)) {
      // XXX: typecheck!
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
      if (formal.typeName !== 'text')
        ctx.NIMPL(formal);

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

  // XXX: node.children as BODY
  if (node.children?.length) {
    if (actualArgs.has('BODY'))
      ctx.token_error(node, `BODY argument is already specified`);
    const BODY = formalArgs.get('BODY')!;
    switch (BODY.typeName) {
      case "widget": {
        const argDecls = generate_argdecls(ctx, scope, BODY.widget);
        const bodyProgram = as_print(ctx, scope, node.children);
        actualArgs.set('BODY', `BODY: (CON: yatt.runtime.Connection, ${argDecls}): void => {${bodyProgram}}`)
        break;
      }
      case "html":
      default:
        ctx.NIMPL();
    }
  }
  // XXX: node.footer
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

import ts = require('typescript')
import {compile, makeProgram} from '../src/utils/compileTs'

(async () => {
  let args = process.argv.slice(2)
  const { parse_long_options } = await import('lrxml')
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
  const script = generate(template, {
    ...session
  })
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
