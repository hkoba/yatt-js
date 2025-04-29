#!/usr/bin/env -S deno run -RE

import {parse_template} from '../../deps.ts'

import {type YattConfig, type YattParams, isYattParams, yattParams, primaryNS} from '../../config.ts'

import {
  type DeclState,
  get_template_declaration
} from '../../declaration/index.ts'

import {templatePath} from '../../path.ts'

import {
  type TargetedCGenSession,
  type CGenRequestSession,
  cgenSettings, freshCGenSession,
  CodeGenContextClass,
  finalize_codefragment
} from '../context.ts'

import {generate_widget} from '../widget/generate.ts'
import {generate_entity} from '../entity/generate.ts'
import {generate_action} from '../action/generate.ts'

import {type CodeFragment, typeAnnotation} from '../codefragment.ts'

import type {TranspileOutput} from '../output.ts'

import {builtinMacros} from '../macro/index.ts'

import {list_entity_functions} from './list_entity_functions.ts'

import {resolve} from "node:path"

export async function generate_module(
  filename: string,
  source: string, origConfig: YattConfig | YattParams
): Promise<TranspileOutput>
{

  const session = freshCGenSession(cgenSettings('module', origConfig))

  // const entFnsFile = config.entityDefinitionsFile;
  //
  // let entFns: {[k: string]: any} | undefined;
  // if (entFnsFile) {
  //   entFns = list_entity_functions(entFnsFile)
  // }

  const entry = await get_template_declaration(
    session, resolve(filename), source
  )
  if (! entry) {
    throw new Error(`No such item: ${filename}`)
  }

  const output = await generate_module_for_declentry(entry, session)

  return {
    template: entry.template,
    session,
    ...output
  }
}

export async function generate_module_for_declentry(
  entry: DeclState,
  baseSession: CGenRequestSession
): Promise<{outputText: string, sourceMapText: string}> {

  const {source, template} = entry

  const filename = template.path

  const templateName = templatePath(
    filename,
    baseSession.params.documentRoot
  );

  const session: TargetedCGenSession = {
    ...baseSession,
    filename,
    importDict: {},
    templateName, source
  }

  const program: CodeFragment[] = []

  // const rootPrefix = prefixUnderRootDir(filename, config.yattRoot)
  // // XXX: yatt => yatt-runtime
  // if (existsSync(`${config.yattRoot}/yatt.ts`)) {
  //   program.push(`import * as $yatt from '${rootPrefix}yatt${ext}'\n`);
  // } else {
  //   program.push(`import * as $yatt from '${srcDir}/yatt${ext}'\n`);
  // }

  // if (Object.keys(entFns).length) {
  //   const nsName = primaryNS(builderSession.params);
  //   program.push(`import * as \$${nsName} from './${yattRcFile}'\n`)
  //   program.push(typeAnnotation(`import type {Connection} from './${yattRcFile}'\n`))
  // } else {
  //   program.push(typeAnnotation(`type Connection = yatt.runtime.Connection\n`))
  // }

  const importListPos = program.length

  for (const part of template) {
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
        program.push(`export function `, await generate_widget(ctx, ast))
        break
      }
      default:
        // just ignore...
    }
  }

  const importModules = session.importDict ? Object.values(session.importDict) : []
  if (importModules.length) {
    const ext = '.mts';
    program.splice(importListPos, 0, ...importModules.map(
      (m) => `import * as ${m} from './${m}${ext}'\n`
    ))
  }

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
      const output = await generate_module(Path.resolve(filename), source, config)
      process.stdout.write(output.outputText + '\n');
    }
  })()
}
