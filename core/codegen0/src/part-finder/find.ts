#!/usr/bin/env -S deno run -RE

import * as Path from 'node:path'

import * as Fs from 'node:fs'

import type {YattConfig} from '../config.ts'

import {
  type Widget,
  type Entity,
  type BuilderBaseSession,
  type TemplateDeclaration,
  get_template_declaration
} from '../declaration/index.ts'

import {candidatesForLookup} from '../declaration/partFolder.ts'

//
// DEBUG=1 src/part-finder/find.ts --libDirs=test/input/ex1/ytmpl  test/input/ex1/public/subgroup1/foo.ytjs foo:bar
//
// --lookup_subdirectory_first
// --lookup_only
//
export async function find_widget(
  session: BuilderBaseSession, template: TemplateDeclaration, partPath: string[]
): Promise<{widget: Widget, template: TemplateDeclaration} | undefined>
{
  const [head, ...rest] = partPath
  if (rest.length === 0 && template.partMap.widget.has(head)) {
    const widget = template.partMap.widget.get(head)!
    return {widget, template}
  }

  for (const cand of candidatesForLookup(session, template.folder, partPath)) {
    const {realPath, name} = cand;

    const entry = await get_template_declaration(session, realPath)

    if (! entry)
      continue

    const {template} = entry

    if (template.partMap.widget.has(name)) {
      return {widget: template.partMap.widget.get(name)!, template}
    }
  }
}

export function find_entity(
  session: BuilderBaseSession, template: TemplateDeclaration, name: string
): {entity: Entity, template: TemplateDeclaration} | string | undefined {
  if (template.partMap.entity.has(name)) {
    const entity = template.partMap.entity.get(name)!
    return {entity, template}
  }

  const fn = session.entFns[name]
  if (fn != null) {
    return name
  }
}

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const [...args] = process.argv.slice(2)

    // const Fs = await import("fs")
    // const Path = await import("node:path")

    const {parse_long_options} = await import('../deps.ts')
    const {
      declarationBuilderSession,
      build_template_declaration
    } = await import("../declaration/index.ts")

    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config: YattConfig & {lookup_only?: string, entity?: boolean} = {
      debug: {
        declaration: debugLevel
      }
    }
    parse_long_options(args, {target: config})

    const [filename, elemPathStr] = args;

    const source = Fs.readFileSync(filename, {encoding: "utf-8"})

    const session = declarationBuilderSession(config)

    const template = build_template_declaration(filename, source, config)

    const fromDir = Path.dirname(filename)
    const elemPath = elemPathStr.split(/:/)

    if (config.lookup_only) {
      for (const {realPath, name} of candidatesForLookup(
        session, fromDir, elemPath
      )) {
        console.log(`Try ${name} in ${realPath}`)
      }
    }
    else if (config.entity) {
      const entity = find_entity(
        session,
        template,
        elemPath[0]
      )

      if (entity == null) {
        console.error(`Can\'t find entity ${elemPathStr} from file ${filename}`)
      } else {
        console.log(`Found entity: `, entity)
      }
    }
    else {
      const widget = find_widget(
        session,
        template,
        elemPath
      )

      if (widget == null) {
        console.error(`Can\'t find widget ${elemPathStr} from file ${filename}`)
      } else {
        console.log(`Found widget: `, widget)
      }
    }

  })()
}
