#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {CodeGenContext, CGenSession} from './context'
import {TemplateDeclaration, Widget} from '../declaration'
import {generate_widget} from './widget/generate'

export function generate(template: TemplateDeclaration, session: CGenSession)
: string
{
  // XXX: runtime path
  let program = `import {yatt} from '../yatt'\n`;
  // XXX: tmpl name
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
    console.time('load');
    const { parse_long_options } = await import('lrxml-js')
    const { readFileSync } = await import('fs')
    const {build_template_declaration} = await import('../declaration')
    console.timeEnd('load');

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      body_argument_name: "body",
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    console.time('parse')
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

    const [template, session] = build_template_declaration(
      source,
      {filename, ...config}
    )

    console.timeEnd('parse')

    const script = generate(template, {
      ...session
    })
    process.stdout.write(script + '\n');

  })()
}
