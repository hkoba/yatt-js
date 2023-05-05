#!/usr/bin/env ts-node

import {parse_template} from '@yatt/lrxml'

import {CodeGenContextClass, CGenSession, finalize_codefragment} from '../context'
import {
  build_template_declaration, TemplateDeclaration
  , BuilderContextClass
  , YattBuildConfig
  // , Widget, Entity
} from '../../declaration'
import {generate_widget} from '../widget/generate'

import {generate_entity} from '../entity/generate'

import {generate_action} from '../action/generate'

import {yattRcFile} from '../../config'

import {srcDir, templatePath} from '../../path'

import {CGenMacro} from '../macro'
import {builtinMacros} from '../macro/'

import {CodeFragment} from '../codefragment'

import {TranspileOutput} from '../output'

import {list_entity_functions} from './list_entity_functions'

import * as Path from 'node:path'
import {statSync} from 'node:fs'

export const DEFAULT_NAMESPACE = '$tmpl'

export function generate_namespace(
  filename: string,
  source: string, config: YattBuildConfig & {
    macro?: Partial<CGenMacro>,
  }
): TranspileOutput
{

  const rootDir = Path.dirname(Path.dirname(Path.resolve(filename)))
  const entFnFile = `${rootDir}/root/${yattRcFile}.ts`

  const entFns = statSync(entFnFile, {throwIfNoEntry: false}) ?
    list_entity_functions(
      entFnFile, '$yatt' // XXX: entFnPrefix(session.params)
    ) : {}

  const [template, session] = build_template_declaration(
    filename,
    source,
    {...config, entFns}
  )

  session.params.templateNamespace ??= DEFAULT_NAMESPACE

  const templateName = [session.params.templateNamespace,
                        ...templatePath(filename, config.rootDir)];

  // XXX: should return templateName too.
  return {
    template,
    templateName,
    ...generate_namespace_from_template(template, {
      templateName,
      macro: Object.assign({}, builtinMacros, config.macro ?? {}),
      ...session
    })
    // sourceMapText
  }
}

export function generate_namespace_from_template(
  template: TemplateDeclaration, session: CGenSession
): {outputText: string, session: CGenSession}
{
  let program: CodeFragment[] = []

  if (session.params.exportNamespace) {
    program.push(`import {yatt} from '${srcDir}/yatt'\n`);
    program.push(`export `);
  }

  program.push("namespace ", session.templateName.join('.'), " {\n")

  // XXX: todo: build file-scope entity functions first

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
        let ctx = new CodeGenContextClass(template, part, session, {hasThis: true});
        let ast = parse_template(session, part.raw_part)
        program.push(generate_widget(ctx, ast))
      }
    }
  }

  program.push('}\n')

  let fileCtx = new BuilderContextClass(session)

  return {...finalize_codefragment(
    session.source, session.filename ?? '', program, {}
  ), session};
}

if (module.id === '.') {
  (async () => {
    const { parse_long_options } = await import('@yatt/lrxml')
    const { readFileSync } = await import('node:fs')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config: YattBuildConfig & {
      sourcemap?: boolean, eachMapping?: boolean
    } = {
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    const cm = config.sourcemap ? (await import('source-map')).SourceMapConsumer : null

    for (const filename of args) {
      let source = readFileSync(filename, {encoding: "utf-8"})
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
