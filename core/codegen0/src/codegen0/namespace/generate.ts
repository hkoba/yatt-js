#!/usr/bin/env -S deno run -RE

import {parse_template} from '../../deps.ts'

import {
  type TargetedCGenSession, type CGenRequestSession,
  cgenSettings, freshCGenSession,
  CodeGenContextClass,
  finalize_codefragment
} from '../context.ts'

import {
  type DeclState,
  get_template_declaration,
  BuilderContextClass
  // , Widget, Entity
} from '../../declaration/index.ts'
import {generate_widget} from '../widget/generate.ts'

import {generate_entity} from '../entity/generate.ts'

import {generate_action} from '../action/generate.ts'

import type {
  YattConfig, YattParams,
} from '../../config.ts'

import {templatePath} from '../../path.ts'

import type {CodeFragment} from '../codefragment.ts'

import type {TranspileOutput} from '../output.ts'

import {list_entity_functions} from './list_entity_functions.ts'

import * as Path from 'node:path'
import {statSync} from 'node:fs'

export const DEFAULT_NAMESPACE = '$yatt.$public'

export async function generate_namespace(
  filename: string,
  source: string, origConfig: YattConfig | YattParams
): Promise<TranspileOutput>
{

  const session = freshCGenSession(cgenSettings('namespace', origConfig))

  const absFile = Path.resolve(filename)

  const rootDir = Path.dirname(Path.dirname(absFile))
  // XXX: _build
  const entFnsFile = session.params.entityDefinitionsFile ?? `${rootDir}/root/_yatt.entity.ts`

  const entFns = statSync(entFnsFile, {throwIfNoEntry: false}) ?
    list_entity_functions(
      entFnsFile, '$yatt' // XXX: entFnPrefix(session.params)
    ) : {}

  session.entFns = entFns

  const entry = await get_template_declaration(
    session, absFile, source
  )
  if (! entry) {
    throw new Error(`No such item: ${filename}`)
  }

  const output = await generate_namespace_for_declentry(entry, session);

  // XXX: should return templateName too.
  return {
    template: entry.template,
    session,
    ...output
  }
}

export async function generate_namespace_for_declentry(
  entry: DeclState,
  baseSession: CGenRequestSession
): Promise<{outputText: string, sourceMapText: string}> {
  const {source, template} = entry

  const filename = template.path

  baseSession.params.templateNamespace ??= DEFAULT_NAMESPACE

  const templateName: string[] = [baseSession.params.templateNamespace,
    ...templatePath(filename, baseSession.params.rootDir)];

  const session: TargetedCGenSession = {
    ...baseSession,
    templateName, source
  }

  // const _fileCtx = new BuilderContextClass(session)

  const program: CodeFragment[] = []

  program.push("namespace ", session.templateName.join('.'), " {\n")

  // XXX: todo: build file-scope entity functions first

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
        const ctx = new CodeGenContextClass(template, part, session, {hasThis: true});
        const ast = parse_template(session, part.raw_part)
        program.push(`export function `, await generate_widget(ctx, ast))
      }
    }
  }

  program.push('}\n')

  return finalize_codefragment(
    session.source, filename, program, {}
  );
}

if (import.meta.main) {
  (async () => {
    const { parse_long_options } = await import('../../deps.ts')
    const { readFileSync } = await import('node:fs')
    const process = await import("node:process")

    const args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config: (YattConfig | YattParams) & {
      sourcemap?: boolean, eachMapping?: boolean
    } = {
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    const cm = config.sourcemap ? (await import('source-map')).SourceMapConsumer : null

    for (const filename of args) {
      const source = readFileSync(filename, {encoding: "utf-8"})
      const output = await generate_namespace(filename, source, config)
      if (cm && output.sourceMapText) {

        if (config.eachMapping) {
          cm.with(
            JSON.parse(output.sourceMapText), null,
            consumer => {
              consumer.eachMapping(m => {
                console.log(m)
              }, null, cm.GENERATED_ORDER)
            }
          )
        } else {
          process.stdout.write(output.sourceMapText + '\n');
        }

      } else {
        process.stdout.write(output.outputText + '\n');
      }
    }
  })()
}
