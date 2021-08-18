#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {CodeGenContext, CGenSession} from './context'
import {TemplateDeclaration, Widget} from '../declaration'
import {generate_widget} from './widget/generate'

export function generate(template: TemplateDeclaration, session: CGenSession)
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

if (module.id === '.') {
  (async () => {
    const ts = await import('typescript')
    const {compile, makeProgram} = await import('../utils/compileTs')
    const { parse_long_options, extract_line, extract_prefix_spec } = await import('lrxml-js')
    const { readFileSync } = await import('fs')
    const {build_template_declaration} = await import('../declaration')

    const {yatt} = await import('../yatt')

    let args = process.argv.slice(2)
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
}
