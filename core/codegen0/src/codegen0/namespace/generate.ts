#!/usr/bin/env ts-node

import {parse_template} from 'lrxml'

import {CodeGenContextClass, CGenSession, finalize_codefragment} from '../context'
import {
  build_template_declaration, TemplateDeclaration
  , BuilderContextClass
} from '../../declaration'
import {generate_widget} from '../widget/generate'
import {YattConfig, entFnPrefix} from '../../config'

import {srcDir, templatePath} from '../../path'

import {CGenMacro} from '../macro'
import {builtinMacros} from '../macro/'

import {CodeFragment} from '../codefragment'

import {list_entity_functions} from './list_entity_functions'

// XXX: Remove node path dependencies
import * as Path from 'path'
import {statSync} from 'fs'

export const DEFAULT_NAMESPACE = '$tmpl'

export function generate_namespace(
  source: string, config: YattConfig & {
    filename: string,
    macro?: Partial<CGenMacro>,
  }
): {outputText: string, templateName: string[], session: CGenSession}
{

  const [template, session] = build_template_declaration(
    source,
    config
  )

  const templateName = [session.params.templateNamespace ?? DEFAULT_NAMESPACE,
                        ...templatePath(config.filename, config.rootDir)];

  const rootDir = Path.dirname(Path.dirname(Path.resolve(config.filename)))
  const entFnFile = `${rootDir}/root/entity-fn.ts`

  const entFns = statSync(entFnFile, {throwIfNoEntry: false}) ?
    list_entity_functions(
      entFnFile, entFnPrefix(session.params)
    ) : {}

  // XXX: should return templateName too.
  return {
    templateName,
    ...generate_namespace_from_template(template, {
      templateName,
      macro: Object.assign({}, builtinMacros, config.macro ?? {}),
      entFns,
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
        let ctx = new CodeGenContextClass(template, part, session, {hasThis: true});
        let ast = parse_template(session, part.raw_part)
        program.push(generate_widget(ctx, ast))
      }
    }
  }

  program.push('}\n')

  let fileCtx = new BuilderContextClass(session)

  return {outputText: finalize_codefragment(fileCtx, program), session};
}

if (module.id === '.') {
  (async () => {
    const { parse_long_options } = await import('lrxml')
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
