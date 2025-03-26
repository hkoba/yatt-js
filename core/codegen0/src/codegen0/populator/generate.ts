#!/usr/bin/env -S deno run -RE

import {parse_template} from '../../deps.ts'

import type { YattConfig } from '../../config.ts'

import {
  get_template_declaration,
  type DeclEntry
} from '../../declaration/index.ts'

import type {TranspileOutput} from '../output.ts'

import {resolve} from 'node:path'

import {templatePath} from '../../path.ts'

import {
  type CGenSession, type CGenBaseSession,
  cgenSession,
  CodeGenContextClass,
  finalize_codefragment
} from '../context.ts'

import {generate_widget} from '../widget/generate.ts'
import {generate_entity} from '../entity/generate.ts'
import {generate_action} from '../action/generate.ts'

import {type CodeFragment, typeAnnotation} from '../codefragment.ts'

import {generate_template_interface} from './interface.ts'

export async function ensure_generate_populator(
  realPath: string,
  baseSession: CGenBaseSession & {cgenStyle: 'populator'},
  outputTextDict: {[k: string]: string}
) {

  const entry = await get_template_declaration(baseSession, realPath);
  if (! entry) {
    throw new Error(`No such item: ${realPath}`)
  }

  if (entry.updated) {

    const output = await generate_populator_for_declentry(entry, baseSession)

    outputTextDict[entry.template.path] = output.outputText
  }
}

export async function generate_populator(
  filename: string,
  source: string,
  config: YattConfig
): Promise<TranspileOutput> {

  //origConfig: YattConfig | YattParams

  const session = cgenSession('populator', config)

  const entry = await get_template_declaration(
    session, resolve(filename), source
  )

  if (! entry) {
    throw new Error(`No such item: ${filename}`)
  }

  const output = await generate_populator_for_declentry(entry, session)

  return {
    template: entry.template,
    session,
    ...output
  }
}

export async function generate_populator_for_declentry(
  entry: DeclEntry,
  baseSession: CGenBaseSession
): Promise<{outputText: string, sourceMapText: string}> {

  const {source, template} = entry

  const filename = template.path

  const templateName = templatePath(
    filename,
    baseSession.params.documentRoot
  );

  const session: CGenSession = {
    ...baseSession, templateName, source
  }

  const program: CodeFragment[] = []

  program.push(generate_template_interface(template, session))

  // XXX: element path => typename mapping
  program.push(
    'export function populate($yatt',
    typeAnnotation(': typeof$yatt'),
    ')',
    typeAnnotation(': typeof$yatt$public$index'),
    ' {\n')
  program.push('const $this = {\n')

  let count = 0
  for (const part of template) {
    if (count > 0) {
      program.push(', ')
    }
    switch (part.kind) {
      case "action": {
        const ctx = new CodeGenContextClass(template, part, session, {hasThis: true});
        program.push(generate_action(ctx))
        break
      }
      case "entity": {
        const ctx = new CodeGenContextClass(template, part, session, {hasThis: true});
        program.push(generate_entity(ctx))
        break
      }
      case "widget": {
        if (part.raw_part == null)
          continue;
        const ctx = new CodeGenContextClass(template, part, session, {hasThis: true});
        const ast = parse_template(session, part.raw_part)
        program.push(await generate_widget(ctx, ast))
        break
      }
      default:
        // just ignore...
    }
    ++count;
  }

  program.push('};\n')
  program.push('return $this;\n');
  program.push('}\n')

  return finalize_codefragment(source, filename, program, {
    ts: true
  })
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
      const output = await generate_populator(Path.resolve(filename), source, config)
      process.stdout.write(output.outputText + '\n');
    }
  })()
}
