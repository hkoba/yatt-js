#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {YattConfig} from '../../config'

import {build_template_declaration, Widget} from '../../declaration'

import {srcDir, templatePath} from '../../path'

import {CodeGenContext} from '../context'

import {generate_widget} from '../widget/generate'

export function generate_module(
  source: string, config: YattConfig & {filename: string}
): string
{
  const [template, builderSession] = build_template_declaration(source, config)
  const templateName = templatePath(config.filename, builderSession.params.rootDir);
  const session = {
    templateName,
    ...builderSession
  }

  let program = `import {yatt} from '${srcDir}/yatt'\n`;

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

  return program
}

if (module.id === '.') {
  const { parse_long_options } = require('lrxml-js')
  const { readFileSync } = require('fs')

  let args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {debug: { declaration: debugLevel }}
  parse_long_options(args, {target: config})

  for (const filename of args) {
    let source = readFileSync(filename, {encoding: "utf-8"})
    const script = generate_module(source, {filename, ...config})
    process.stdout.write(script + '\n');
  }
}
