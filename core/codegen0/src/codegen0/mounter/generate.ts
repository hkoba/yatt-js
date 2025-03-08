#!/usr/bin/env -S deno run -RE

import {parse_template} from '../../deps.ts'

import {type YattConfig, type YattParams, isYattParams, yattParams, primaryNS} from '../../config.ts'

import {
  build_template_declaration
} from '../../declaration/index.ts'

import type {TranspileOutput} from '../output.ts'

import {templatePath} from '../../path.ts'

import {type CGenSession, CodeGenContextClass, finalize_codefragment} from '../context.ts'

import {generate_widget} from '../widget/generate.ts'
import {generate_entity} from '../entity/generate.ts'
import {generate_action} from '../action/generate.ts'

import {type CodeFragment, typeAnnotation} from '../codefragment.ts'

import {builtinMacros} from '../macro/index.ts'

export function generate_mounter(
  filename: string,
  source: string, origConfig: YattConfig | YattParams
): TranspileOutput {

  const config = isYattParams(origConfig) ? origConfig : yattParams(origConfig)

  const entFns: {[k: string]: any} = {}; // XXX

  const [template, declSession] = build_template_declaration(
    filename,
    source,
    {...config, entFns}
  )
  
  const templateName = templatePath(
    filename,
    declSession.params.documentRoot
  );

  const session: CGenSession = {
    cgenStyle: 'mounter',
    templateName,
    macro: Object.assign({}, builtinMacros, config.macro ?? {}),
    importDict: {},
    ...declSession
  }

  const program: CodeFragment[] = []

  program.push('export function mount($yatt: type$yatt): type$this {\n')

  let count = 0
  for (const part of template) {
    if (count > 0) {
      program.push(', ')
    }
    switch (part.kind) {
      case "action": {
        const ctx = new CodeGenContextClass(template, part, session);
        program.push(generate_action(ctx))
        break
      }
      case "entity": {
        const ctx = new CodeGenContextClass(template, part, session);
        program.push(generate_entity(ctx))
        break
      }
      case "widget": {
        if (part.raw_part == null)
          continue;
        const ctx = new CodeGenContextClass(template, part, session);
        const ast = parse_template(session, part.raw_part)
        program.push(generate_widget(ctx, ast))
        break
      }
      default:
        // just ignore...
    }
    ++count;
  }

  program.push('}')

  const output = finalize_codefragment(source, filename, program, {
    ts: !(config.es ?? false)
  })

  return {
    templateName, template,
    session,
    ...output
  }
}

if (import.meta.main) {
  (async () => {
    const { parse_long_options } = await import('../../deps.ts')
    const { readFileSync } = await import('node:fs')
    const Path = await import('node:path')
    const process = await import('node:process')

    const args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config = {debug: { declaration: debugLevel }}
    parse_long_options(args, {target: config})

    for (const filename of args) {
      const source = readFileSync(filename, {encoding: "utf-8"})
      const output = generate_mounter(Path.resolve(filename), source, config)
      process.stdout.write(output.outputText + '\n');
    }
  })()
}
