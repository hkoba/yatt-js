#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {CodeGenContext, CGenSession} from '../context'
import {TemplateDeclaration, Widget} from '../../declaration'
import {generate_widget} from '../widget/generate'

import path from 'path'

export function generate_namespace(template: TemplateDeclaration, session: CGenSession)
: string
{
  const srcDir = path.dirname(__dirname)
  let program = `import {yatt} from '${srcDir}/yatt'\n`;
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
    const { parse_long_options } = await import('lrxml-js')
    const { readFileSync } = await import('fs')
    const {build_template_declaration} = await import('../../declaration')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      body_argument_name: "body",
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    for (const filename of args) {
      let source = readFileSync(filename, {encoding: "utf-8"})
      const [template, session] = build_template_declaration(
        source,
        {filename, ...config}
      )

      const script = generate_namespace(template, {
        ...session
      })
      process.stdout.write(script + '\n');
    }
  })()
}
