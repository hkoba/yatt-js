#!/usr/bin/env ts-node

import {parse_template} from '@yatt/lrxml'

import {YattConfig, YattParams, isYattParams, yattParams, primaryNS, yattRcFile} from '../../config'

import {
  build_template_declaration
} from '../../declaration'

import {srcDir, templatePath, prefixUnderRootDir} from '../../path'

import {CodeGenContextClass, finalize_codefragment} from '../context'

import {generate_widget} from '../widget/generate'

import {generate_entity} from '../entity/generate'

import {generate_action} from '../action/generate'

import {CodeFragment, typeAnnotation} from '../codefragment'

import {TranspileOutput} from '../output'

import {builtinMacros} from '../macro/'

import {list_entity_functions} from './list_entity_functions'

import {existsSync} from "node:fs"
import * as Path from "node:path"

export function generate_module(
  filename: string,
  source: string, origConfig: YattConfig | YattParams
): TranspileOutput
{

  const config = isYattParams(origConfig) ? origConfig : yattParams(origConfig)

  const entFns: {[k: string]: any} = list_entity_functions(
    Path.join(Path.dirname(filename), yattRcFile)
  )

  const [template, builderSession] = build_template_declaration(
    filename, source, {
      entFns,
      ...config
    }
  )
  const templateName = templatePath(
    filename,
    builderSession.params.documentRoot
  );

  const session = {
    templateName,
    macro: Object.assign({}, builtinMacros, config.macro ?? {}),
    importDict: {},
    ...builderSession
  }

  let program: CodeFragment[] = []

  const rootPrefix = prefixUnderRootDir(filename, config.yattRoot)
  // XXX: yatt => yatt-runtime
  if (existsSync(`${config.yattRoot}/yatt.ts`)) {
    program.push(`import {yatt} from '${rootPrefix}yatt'\n`);
  } else {
    program.push(`import {yatt} from '${srcDir}/yatt'\n`);
  }

  if (Object.keys(entFns).length) {
    const nsName = primaryNS(builderSession.params);
    program.push(`import * as \$${nsName} from './${yattRcFile}'\n`)
    program.push(typeAnnotation(`import type {Connection} from './${yattRcFile}'\n`))
  } else {
    program.push(typeAnnotation(`type Connection = yatt.runtime.Connection\n`))
  }

  const importListPos = program.length

  for (const part of template) {
    switch (part.kind) {
      case "action": {
        let ctx = new CodeGenContextClass(template, part, session);
        program.push(generate_action(ctx))
        break
      }
      case "entity": {
        let ctx = new CodeGenContextClass(template, part, session);
        program.push(generate_entity(ctx))
        break
      }
      case "widget": {
        if (part.raw_part == null)
          continue;
        let ctx = new CodeGenContextClass(template, part, session);
        let ast = parse_template(session, part.raw_part)
        program.push(generate_widget(ctx, ast))
        break
      }
      default:
        // just ignore...
    }
  }

  const importModules = Object.values(session.importDict)
  if (importModules.length) {
    program.splice(importListPos, 0, ...importModules.map(
      (m) => `import * as ${m} from './${m}'\n`
    ))
  }

  const output = finalize_codefragment(source, filename, program, {
    ts: !(config.es ?? false)
  })

  return {
    templateName, template,
    session,
    ...output
  }
}

if (module.id === '.') {
  (async () => {
    const { parse_long_options } = await import('@yatt/lrxml')
    const { readFileSync } = await import('node:fs')
    const Path = await import('node:path')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {debug: { declaration: debugLevel }}
    parse_long_options(args, {target: config})

    for (const filename of args) {
      let source = readFileSync(filename, {encoding: "utf-8"})
      const output = generate_module(Path.resolve(filename), source, config)
      process.stdout.write(output.outputText + '\n');
    }
  })()
}
