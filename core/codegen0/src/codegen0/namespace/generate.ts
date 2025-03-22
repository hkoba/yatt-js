#!/usr/bin/env -S deno run -RE

import {parse_template} from '../../deps.ts'

import {CodeGenContextClass, type CGenSession, finalize_codefragment} from '../context.ts'
import {
  build_template_declaration, type TemplateDeclaration
  , BuilderContextClass
  // , Widget, Entity
} from '../../declaration/index.ts'
import {generate_widget} from '../widget/generate.ts'

import {generate_entity} from '../entity/generate.ts'

import {generate_action} from '../action/generate.ts'

import {
  type YattConfig, type YattParams,
  isYattParams, yattParams
} from '../../config.ts'

import {templatePath} from '../../path.ts'

import {builtinMacros} from '../macro/index.ts'

import type {CodeFragment} from '../codefragment.ts'

import type {TranspileOutput} from '../output.ts'

import {list_entity_functions} from './list_entity_functions.ts'

import * as Path from 'node:path'
import {statSync} from 'node:fs'

export const DEFAULT_NAMESPACE = '$yatt.$public'

export function generate_namespace(
  filename: string,
  source: string, origConfig: YattConfig | YattParams
): TranspileOutput
{

  const config = isYattParams(origConfig) ? origConfig : yattParams(origConfig)

  const rootDir = Path.dirname(Path.dirname(Path.resolve(filename)))
  // XXX: _build
  const entFnsFile = config.entityDefinitionsFile ?? `${rootDir}/root/_yatt.entity.ts`

  const entFns = statSync(entFnsFile, {throwIfNoEntry: false}) ?
    list_entity_functions(
      entFnsFile, '$yatt' // XXX: entFnPrefix(session.params)
    ) : {}

  const [template, decl_session] = build_template_declaration(
    filename,
    source,
    {...config, entFns}
  )

  decl_session.params.templateNamespace ??= DEFAULT_NAMESPACE

  const templateName: string[] = [decl_session.params.templateNamespace,
    ...templatePath(filename, config.rootDir)];

  const session: CGenSession = {
    cgenStyle: 'namespace',
    templateName,
    macro: Object.assign({}, builtinMacros, config.macro ?? {}),
    ...decl_session
  }

  const program: CodeFragment[] = generate_namespace_from_template(template, session);

  // XXX: 
  const _fileCtx = new BuilderContextClass(session)

  const {outputText, sourceMapText} = finalize_codefragment(
    session.source, session.filename ?? '', program, {}
  );

  // XXX: should return templateName too.
  return {
    template,
    templateName,
    outputText,
    session,
    sourceMapText
  }
}

export function generate_namespace_from_template(
  template: TemplateDeclaration, session: CGenSession
): CodeFragment[]
{
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
        program.push(`export function `, generate_widget(ctx, ast))
      }
    }
  }

  program.push('}\n')

  return program
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

    const cm = config.sourcemap ? (await import('npm:source-map')).SourceMapConsumer : null

    for (const filename of args) {
      const source = readFileSync(filename, {encoding: "utf-8"})
      const output = generate_namespace(filename, source, config)
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
