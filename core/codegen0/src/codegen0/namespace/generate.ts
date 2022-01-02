#!/usr/bin/env ts-node

import {parse_template} from 'lrxml-js'

import {CodeGenContextClass, CGenSession} from '../context'
import {build_template_declaration, TemplateDeclaration, Widget} from '../../declaration'
import {generate_widget} from '../widget/generate'
import {YattConfig, entFnPrefix} from '../../config'

import {srcDir, templatePath} from '../../path'

import {CGenMacro} from '../macro'
import {builtinMacros} from '../macro/'

import {list_entity_functions} from './list_entity_functions'

import * as Path from 'path'

export const DEFAULT_NAMESPACE = '$tmpl'

export async function generate_namespace(
  source: string, config: YattConfig & {
    filename: string,
    macro?: Partial<CGenMacro>,
  }
): Promise<{outputText: string, templateName: string[], session: CGenSession}>
{
  if (! config.connectionTypeName)
    config.connectionTypeName = 'yatt.Connection';

  const [template, session] = build_template_declaration(
    source,
    config
  )

  const templateName = [session.params.templateNamespace ?? DEFAULT_NAMESPACE,
                        ...templatePath(config.filename, config.rootDir)];

  const rootDir = Path.dirname(Path.dirname(Path.resolve(config.filename)))
  console.log('rootDir: ', rootDir);

  const entFns = list_entity_functions(
    `${rootDir}/root/entity-fn.ts`, entFnPrefix(session.params)
  )

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
  let program = ''

  if (session.params.exportNamespace) {
    program += `import {yatt} from '${srcDir}/yatt'\n`;
    program += `export `;
  }

  program += `namespace ${session.templateName.join('.')} {\n`

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
        program += generate_widget(ctx, ast)
      }
    }
  }

  program += '}\n'
  return {outputText: program, session};
}

if (module.id === '.') {
  (async () => {
    const { parse_long_options } = await import('lrxml-js')
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
      generate_namespace(source, {filename, ...config}).then(output => {
        process.stdout.write(output.outputText + '\n');
      }).catch(err => {
        throw err
      })
    }
  })()
}
