#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {CodeGenContext, CGenSession} from '../context'
import {build_template_declaration, TemplateDeclaration, Widget} from '../../declaration'
import {generate_widget} from '../widget/generate'
import {YattConfig} from '../../config'

import {srcDir, templatePath} from '../../path'

export const DEFAULT_NAMESPACE = '$tmpl'

export function generate_namespace(
  source: string, config: YattConfig & {filename: string}
): {outputText: string, templateName: string[]}
{
  const [template, session] = build_template_declaration(
    source,
    config
  )

  const templateName = [session.params.templateNamespace ?? DEFAULT_NAMESPACE,
                        ...templatePath(config.filename, config.rootDir)];

  // XXX: should return templateName too.
  return {
    templateName,
    outputText: generate_namespace_from_template(template, {
      templateName,
      ...session
    })
    // sourceMapText
  }
}

export function generate_namespace_from_template(
  template: TemplateDeclaration, session: CGenSession
): string
{
  let program = `import {yatt} from '${srcDir}/yatt'\n`;

  if (session.params.exportNamespace) {
    program += `export `;
  }
  program += `namespace ${session.templateName.join('.')} {\n`

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
        let ctx = new CodeGenContext<Widget>(template, part, session, {hasThis: true});
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

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config: YattConfig = {
      body_argument_name: "body",
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    for (const filename of args) {
      let source = readFileSync(filename, {encoding: "utf-8"})
      const output = generate_namespace(source, {filename, ...config})
      process.stdout.write(output.outputText + '\n');
    }
  })()
}
