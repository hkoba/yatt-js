#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {CodeGenContext, CGenSession} from '../context'
import {TemplateDeclaration, Widget} from '../../declaration'
import {generate_widget} from '../widget/generate'

import path from 'path'

export function templateName(filename: string): string {
  // XXX: Directory tree under rootDir
  const tmplName = path.basename(filename, path.extname(filename))
  if (!/^[_a-z][0-9_a-z]*$/i.exec(tmplName)) {
    throw new Error(`Filename does not fit for identifier: ${tmplName}`)
  }
  return tmplName
}

export function generate_namespace(template: TemplateDeclaration, session: CGenSession)
: string
{
  const srcDir = path.dirname(path.dirname(__dirname))
  let program = `import {yatt} from '${srcDir}/yatt'\n`;

  program += `export namespace $tmpl.${session.templateName} {\n`

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
        templateName: templateName(filename),
        ...session
      })
      process.stdout.write(script + '\n');
    }
  })()
}
