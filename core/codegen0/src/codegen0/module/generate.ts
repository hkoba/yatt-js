#!/usr/bin/env ts-node

import {parse_template} from 'lrxml'

import {YattConfig, primaryNS} from '../../config'

import {
  build_template_declaration
  , TemplateDeclaration
  , BuilderContextClass
} from '../../declaration'

import {srcDir, templatePath} from '../../path'

import {CodeGenContextClass, finalize_codefragment} from '../context'

import {generate_widget} from '../widget/generate'

import {CodeFragment} from '../codefragment'

import {CGenMacro} from '../macro'
import {builtinMacros} from '../macro/'

import {list_entity_functions} from './list_entity_functions'

export function generate_module(
  source: string, config: YattConfig & {
    filename: string,
    macro?: Partial<CGenMacro>,
  }
): {outputText: string, template: TemplateDeclaration, templateName: string[]}
{
  const [template, builderSession] = build_template_declaration(source, config)
  const templateName = templatePath(
    config.filename,
    builderSession.params.rootDir
  );
  const entFns: {[k: string]: any} = config.entFnsFile ?
    list_entity_functions(config.entFnsFile) : {}

  const session = {
    templateName,
    macro: Object.assign({}, builtinMacros, config.macro ?? {}),
    entFns,
    ...builderSession
  }

  let program: CodeFragment[] = []
  program.push(`import {yatt} from '${srcDir}/yatt'\n`);
  if (config.entFnsFile) {
    const nsName = primaryNS(builderSession.params);
    program.push(`import * as \$${nsName} from '${config.entFnsFile}'\n`)
    program.push(`import type {Connection} from '${config.entFnsFile}'\n`)
  } else {
    program.push(`type Connection = yatt.runtime.Connection\n`)
  }

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
        let ctx = new CodeGenContextClass(template, part, session);
        let ast = parse_template(session, part.raw_part)
        program.push(generate_widget(ctx, ast))
      }
    }
  }

  let fileCtx = new BuilderContextClass(session)

  return {
    templateName, template,
    outputText: finalize_codefragment(fileCtx, program)
  }
}

if (module.id === '.') {
  (async () => {
    const { parse_long_options } = await import('lrxml')
    const { readFileSync } = await import('fs')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {debug: { declaration: debugLevel }}
    parse_long_options(args, {target: config})

    for (const filename of args) {
      let source = readFileSync(filename, {encoding: "utf-8"})
      const output = generate_module(source, {filename, ...config})
      process.stdout.write(output.outputText + '\n');
    }
  })()
}
