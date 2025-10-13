#!/usr/bin/env -S deno run -RE

import {
  parse_multipart, type Content
} from '../deps.ts'

import { yattParams } from '../config.ts'

import type {
  YattBuildConfig,
  BuilderMap, BuilderContext,
  BuilderRequestSession,
  DeclState
} from './context.ts'

import {
  DeclarationScope, indent,
  BuilderContextClass,
  isBuilderSession
} from './context.ts'

import { TaskGraph } from './taskgraph.ts'

import type {
  PartMapType
  , RouteMapType
} from './types.ts'

import type {
  TemplateDeclaration
} from './types.ts'

import {baseModName} from './partFolder.ts'
import {dirname} from 'node:path'

import type { PartKind, Part, Widget } from './part.ts'

import {builtin_vartypemap} from './vartype.ts'

import {add_args, type ArgAdder} from './addArgs.ts'

import { BaseProcessor } from './base.ts'

import {internTemplateRuntimeNamespace} from './partFolder.ts'

import {add_route} from './attlist.ts'

import {WidgetBuilder} from './part/widget.ts'
import {ActionBuilder} from './part/action.ts'
import {EntityBuilder} from './part/entity.ts'

export function builtin_builders(): BuilderMap {
  const builders = new Map
  builders.set('args', new WidgetBuilder(false, true))
  builders.set('widget', new WidgetBuilder(true, false))
  builders.set('page', new WidgetBuilder(true, true))
  builders.set('action', new ActionBuilder)
  builders.set('entity', new EntityBuilder)
  builders.set('base', new BaseProcessor)
  builders.set('', builders.get('args'))
  return builders
}

export function declarationBuilderSession(
  config: YattBuildConfig
): BuilderRequestSession {

  const {
    builders = builtin_builders(),
    varTypeMap = builtin_vartypemap(),
    declCache = new Map,
    entFns = {},
    ...rest_config
  } = config

  const buildParams = yattParams(rest_config);

  const sourceCache = config.sourceCache ? config.sourceCache : new SourceRegistry(config)

  const builder_session: BuilderRequestSession = {
    builders, varTypeMap,
    declCache,
    sourceCache,
    entFns,
    visited: new Set,
    output: new Map,
    declDepth: 0,
    templateFolderMap: new Map,
    params: buildParams
  }

  return builder_session
}

import { SourceRegistry } from "./registry.ts";

export async function get_template_declaration(
  session: BuilderRequestSession,
  realPath: string,
  source?: string,
  modTimeMs?: number
): Promise<DeclState | undefined> {

  using _top = new DeclarationScope(session)

  const debug = session.params.debug.declaration ?? 0

  if (debug) {
    console.log(indent(session) + `get_template_declaration: ${realPath}`)
  }

  const {sourceEntry, updated} = await session.sourceCache.refresh(
    realPath, session.visited.has(realPath), source, modTimeMs,
    session.params.debug.cache ?? 0
  )

  session.visited.add(realPath)

  const template = session.declCache.get(realPath)

  if (template && sourceEntry && !updated) {
    if (debug >= 2) {
      console.log(indent(session) + `found up-to-date sourceEntry of ${realPath}`)
    }
    const {modTimeMs, source} = sourceEntry
    return {kind: 'template', source, template, modTimeMs, updated: false}
  }

  if (sourceEntry) {
    if (debug >= 2) {
      console.log(`build new template decl for: ${realPath}`)
    }
    const {modTimeMs, source} = sourceEntry
    const template = await build_template_declaration(realPath, source, session)
    session.declCache.set(realPath, template)

    return {kind: 'template', source, template, modTimeMs, updated: true}
  }

  if (debug >= 2) {
    console.log(indent(session) + `XXX: has sourceEntry(updated=${updated}):`, sourceEntry != null, `has template: `, template != null)
  }
}

export async function build_template_declaration(
  filename: string,
  source: string,
  configOrSession: YattBuildConfig | BuilderRequestSession
): Promise<TemplateDeclaration> {

  const builder_session = isBuilderSession(configOrSession)
    ? configOrSession
    : declarationBuilderSession(configOrSession)

  const [contentList] = parse_multipart(
    source, {...builder_session, filename}
  )

  return await populateTemplateDeclaration(
    filename, source,
    builder_session, contentList
  )
}

export async function populateTemplateDeclaration(
  filename: string, source: string,
  builder_session: BuilderRequestSession, contentList: Content[]
): Promise<TemplateDeclaration> {
  const ctx = new BuilderContextClass({filename, source, ...builder_session})

  // For delegate type and ArgMacro
  const partOrder: [PartKind, string][] = []
  const partMap: PartMapType = {widget: new Map, action: new Map, entity: new Map};
  const taskGraph = new TaskGraph<Widget>(ctx.debug);
  const routeMap: RouteMapType = new Map

  const runtimeNamespace = internTemplateRuntimeNamespace(filename, builder_session)
  const dir = dirname(filename)
  const template: TemplateDeclaration = {
    path: filename,
    runtimeNamespace,
    realDir: dir === '.' ? '' : dir,
    modName: baseModName(filename),
    partMap, routeMap, partOrder,
    base: []
  }

  let currentPart: Part | undefined

  for (const content of contentList) {
    switch (content.kind) {
      case "comment":
      case "text": {
        if (! currentPart) {
          const builder: WidgetBuilder = ctx.session.builders.get('args') as WidgetBuilder
          [currentPart] = await builder.process(ctx, template, [], true)
          add_args(ctx, currentPart, [])
        }
        currentPart.payloads.push(content)
        break;
      }

      case "boundary": {
        if (currentPart) {
          finalize_part(ctx, currentPart)
        }

        const [kind, ...subkind] = content.decltype
        // XXX: subkind を使ってない
        if (ctx.session.builders.has(kind)) {
          const builder = ctx.session.builders.get(kind)!
          const built = await builder.process(ctx, template, ctx.copy_array(content.attlist))
          if (! built) {
            continue
          }
          const [part, attlist] = built
          currentPart = part;
          if (part.route != null) {
            add_route(ctx, routeMap, part.route, part);
          }

          const task: ArgAdder | undefined = add_args(ctx, part, attlist)
          if (task) {
            if (part.kind !== "widget") {
              ctx.NIMPL()
            }
            taskGraph.delay_product(part.name, part as Widget, task, task.dep);
            if (ctx.debug >= 2) {
              console.log(`delayed delegate arg ${task.name} in widget :${part.name}, depends on widget :${task.dep}`)
            }
          }
        }
        else {
          const ns = ctx.session.params.namespace[0]
          ctx.token_error(content, `Unknown declarator (<!${ns}:${content.decltype.join(":")} >)`);
        }
        break;
      }
    }
  }

  if (currentPart) {
    finalize_part(ctx, currentPart)
  }

  // Resolve
  taskGraph.do_all((dep: string) => {
    const inSameTemplate = partMap.widget.has(dep)
    if (inSameTemplate) {
      return [inSameTemplate, partMap.widget.get(dep)!]
    }
    // XXX: find from vfs
  })

  return template
}

function finalize_part(
  _ctx: BuilderContext, part: Part
) {
  if (part.payloads.length) {
    const lastTok = part.payloads[part.payloads.length-1]
    if (lastTok.kind === "text") {
      lastTok.data = lastTok.data.replace(/(?:\r?\n)+$/, "\n")
    }
  }
  // TODO: argmacro
}

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const [...args] = process.argv.slice(2);
    console.time('load lrxml');
    const { parse_long_options } = await import('../deps.ts')
    console.timeLog('load lrxml');
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config = {
      debug: { declaration: debugLevel },
      entFns: {}
    }
    parse_long_options(args, {target: config})

    const { readFileSync } = await import('node:fs')

    console.time('run');
    for (const fn of args) {
      const template = await build_template_declaration(
        fn,
        readFileSync(fn, { encoding: "utf-8" }),
        config
      )

      const {partMap} = template;
      for (const [name, map] of Object.entries(partMap)) {
        console.log(`=== ${name} ===`)
        console.dir(map, {colors: true, depth: null})
        console.log('\n')
      }
    }
    console.timeLog('run');
  })()
}
