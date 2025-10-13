#!/usr/bin/env -S deno run -RE

import * as Path from 'node:path'

import * as Fs from 'node:fs'

import type {YattConfig} from '../config.ts'

import {
  type Widget,
  type Entity,
  type BuilderRequestSession,
  type TemplateDeclaration,
  get_template_declaration
} from '../declaration/index.ts'

import {indent} from '../declaration/context.ts'

import type {CGenRequestSession} from '../codegen0/context.ts'

import {candidatesForLookup} from '../declaration/partFolder.ts'

import {ensure_generated} from '../codegen0/generate.ts'

//
// DEBUG=1 src/part-finder/find.ts --libDirs=test/input/ex1/ytmpl  test/input/ex1/public/subgroup1/foo.ytjs foo:bar
//
// --lookup_subdirectory_first
// --lookup_only
//
export async function find_widget(
  session: CGenRequestSession, template: TemplateDeclaration, partPath: string[]
): Promise<{widget: Widget, template: TemplateDeclaration} | undefined>
{
  const debugLevel = session.params.debug.declaration ?? 0
  if (debugLevel >= 2) {
    console.log(indent(session) + `find_widget from(path=${template.path} realDir=${template.realDir})`, partPath)
  }

  const [head, ...rest] = partPath
  if (rest.length === 0 && template.partMap.widget.has(head)) {
    const widget = template.partMap.widget.get(head)!
    if (debugLevel >= 2) {
      console.log(indent(session) + ` => found internal widget`, widget)
    }
    return {widget, template}
  }

  if (debugLevel >= 2) {
    console.log(indent(session) + ` lookupGenerateWidgetFromDir(realDir=${template.realDir})`, partPath)
  }

  const found = await lookupGenerateWidgetFromDir(session, template.realDir, partPath)
  if (found) {
    if (debugLevel >= 2) {
      console.log(indent(session) + ` => found sibling widget`, found)
    }
    return found
  }

  for (const item of template.base) {
    switch (item.kind) {
      case "folder": {
        const found = await lookupGenerateWidgetFromDir(session, item.path, partPath)
        if (found) {
          return found
        }
        break;
      }
      case "template": {
        if (rest.length > 0) {
          throw new Error(`Not implemented`);
        }
        const {template} = item;
        if (template.partMap.widget.has(head)) {
          const widget = template.partMap.widget.get(head)!
          return {widget, template}
        }
        break;
      }
    }
  }
}

async function lookupGenerateWidgetFromDir(
  session: CGenRequestSession, dir: string, partPath: string[]
): Promise<{widget: Widget, template: TemplateDeclaration} | undefined> {
  const debug = session.params.debug.declaration ?? 0;

  if (debug >= 2) {
    console.log(indent(session) + `looking for: `, partPath, 'from dir:', dir)
  }

  for (const cand of candidatesForLookup(session, dir, partPath)) {
    const {realPath, name} = cand;

    const entry = await get_template_declaration(session, realPath)

    if (! entry) {
      if (debug >= 2) {
        console.log(indent(session) + `template not found at: ${realPath}`)
      }
      continue
    }

    const {template, updated} = entry
    if (updated) {
      if (debug >= 2) {
        console.log(indent(session) + `Calling ensure_generated: ${template.path}`)
      }
      await ensure_generated(entry, session);
      if (debug >= 2) {
        console.log(indent(session) + `=> output.length: ${session.output.size}`)
      }
    } else {
      if (debug >= 2) {
        console.log(indent(session) + `No need to generate: ${template.path}`)
      }
    }

    if (template.partMap.widget.has(name)) {
      return {widget: template.partMap.widget.get(name)!, template}
    } else {
      if (debug >= 2) {
        console.log(indent(session) + `widget ${name} not found in template ${realPath}`)
      }
    }
  }
}

export function find_entity(
  session: BuilderRequestSession, template: TemplateDeclaration, name: string
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
      build_template_declaration
    } = await import("../declaration/index.ts")

    const {
      freshCGenSession, cgenSettings
    } = await import("../codegen0/context.ts")

    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config: YattConfig & {lookup_only?: string, entity?: boolean} = {
      debug: {
        cache: debugLevel,
        declaration: debugLevel
      }
    }
    parse_long_options(args, {target: config})

    const [filename, elemPathStr] = args;

    const source = Fs.readFileSync(filename, {encoding: "utf-8"})

    const session = freshCGenSession(cgenSettings('populator', config))

    const template = await build_template_declaration(filename, source, config)

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
      const widget = await find_widget(
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
