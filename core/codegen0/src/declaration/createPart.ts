#!/usr/bin/env ts-node

import {
  parse_multipart, RawPart, AttItem,
  isIdentOnly,
  hasLabel, hasQuotedStringValue
} from 'lrxml'

import { yattParams } from '../config'

import {
  YattBuildConfig,
  BuilderMap, BuilderContext, BuilderContextClass, BuilderSession,
  DeclarationProcessor
} from './context'

import { TaskGraph } from './taskgraph'

import {
  TemplateDeclaration
  , PartMapType
  , RouteMapType
} from './types'

import { PartKind, Part, Widget, makeWidget, Action, Entity } from './part'

import {builtin_vartypemap} from './vartype'

import {add_args, ArgAdder} from './addArgs'

import { BaseProcessor } from './base'

export class WidgetBuilder implements DeclarationProcessor {
  readonly kind: string = 'widget'
  constructor(
    readonly is_named: boolean, readonly is_public: boolean,
  ) {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Widget, AttItem[]] {
    let name, nameNode, route
    if (! this.is_named) {
      // yatt:args
      // "/route"
      name = ""
      if (attlist.length && !hasLabel(attlist[0])
          && hasQuotedStringValue(attlist[0])) {
        route = ctx.range_text(attlist.shift()!);
      }

    } else {
      if (! attlist.length) {
        // XXX: token position
        ctx.throw_error(`Widget name is not given (1)`)
      }
      const att = ctx.cut_name_and_route(attlist)
      if (! att) {
        ctx.throw_error(`Widget name is not given (2)`)
      }
      name = att[0]
      route = att[1]
      nameNode = att[2]
    }
    let widget = makeWidget(name, this.is_public, nameNode)
    widget.route = route;
    return [widget, attlist];
  }
}

export class ActionBuilder implements DeclarationProcessor {
  readonly kind = 'action';
  constructor() {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Action, AttItem[]] {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const [name, route] = ctx.cut_name_and_route(attlist)!
    return [{kind: this.kind, name, route, is_public: true,
             argMap: new Map, varMap: new Map}, attlist]
  }
}

export class EntityBuilder implements DeclarationProcessor {
  readonly kind = 'entity';
  constructor() {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Entity, AttItem[]] {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Entity name is not given`)
    }
    const att = attlist.shift()!
    if (! isIdentOnly(att))
      ctx.NIMPL();
    const name = att.value
    return [{kind: this.kind, name, is_public: false,
             argMap: new Map, varMap: new Map}, attlist]
  }
}

export function builtin_builders(): BuilderMap {
  let builders = new Map
  builders.set('args', new WidgetBuilder(false, true))
  builders.set('widget', new WidgetBuilder(true, false))
  builders.set('page', new WidgetBuilder(true, true))
  builders.set('action', new ActionBuilder)
  builders.set('entity', new EntityBuilder)
  builders.set('base', new BaseProcessor)
  // XXX: import
  builders.set('', builders.get('args'))
  return builders
}

export function declarationBuilderSession(
  filename: string,
  source: string,
  config: YattBuildConfig
): [BuilderSession, RawPart[]] {

  const rootDir = config.rootDir ?? ".";
  let {
    builders = builtin_builders(),
    varTypeMap = builtin_vartypemap(),
    declCacheSet = {[rootDir]: new Map},
    entFns = {},
    ...rest_config
  } = config

  const buildParams = yattParams(rest_config);
  for (const dir of buildParams.libDirs) {
    declCacheSet[dir] = new Map
  }

  const [rawPartList, parser_session] = parse_multipart(
    source, {...rest_config, filename}
  )

  const {patterns} = parser_session;

  const builder_session: BuilderSession = {
    builders, varTypeMap, source, filename, patterns,
    declCacheSet,
    entFns,
    visited: new Map,
    params: buildParams
  }

  return [builder_session, rawPartList]
}

export function build_template_declaration(
  filename: string,
  source: string,
  config: YattBuildConfig
): [TemplateDeclaration, BuilderSession] {

  const [builder_session, rawPartList] = declarationBuilderSession(filename, source, config)

  // console.log(`template config:`, config)

  const decl = populateTemplateDeclaration(
    filename,
    builder_session, rawPartList
  )

  return [decl, builder_session]
}

export function populateTemplateDeclaration(path: string, builder_session: BuilderSession, rawPartList: RawPart[]): TemplateDeclaration {
  const ctx = new BuilderContextClass(builder_session)

  // For delegate type and ArgMacro
  let partOrder: [PartKind, string][] = []
  let partMap: PartMapType = {widget: new Map, action: new Map, entity: new Map};
  let taskGraph = new TaskGraph<Widget>(ctx.debug);
  let routeMap: RouteMapType = new Map

  for (const rawPart of rawPartList) {
    ctx.set_range(rawPart)
    if (! builder_session.builders.has(rawPart.kind)) {
      ctx.token_error(rawPart, `Unsupported part kind: ${rawPart.kind}`);
    }
    const pn = createPart(ctx, rawPart)
    if (! pn)
      continue;
    const [part, attlist] = pn
    if (partMap[part.kind].has(part.name)) {
      // XXX: Better diag
      ctx.throw_error(`Duplicate declaration ${part.kind} ${part.name}`);
    }
    switch (part.kind) {
      case "widget": partMap.widget.set(part.name, part); break;
      case "action": partMap.action.set(part.name, part); break;
      case "entity": partMap.entity.set(part.name, part); break;
      default:
        // typeof part.kind is never.
        // let pm = partMap[part.kind];
        // if (pm != null) {
        //   pm.set(part.name, part as PartBase)
        // }
    }

    partOrder.push([part.kind, part.name]);
    part.raw_part = rawPart
    if (part.route != null) {
      add_route(ctx, routeMap, part.route, part);
    }

    let task: ArgAdder | undefined = add_args(ctx, part, attlist)
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

  // Resolve
  taskGraph.do_all((dep: string) => {
    let inSameTemplate = partMap.widget.has(dep)
    if (inSameTemplate) {
      return [inSameTemplate, partMap.widget.get(dep)!]
    }
    // XXX: find from vfs
  })

  const folder = ctx.dirname(path)
  return {path, folder, partMap, routeMap, partOrder}
}

function add_route(
  _ctx: BuilderContext, routeMap: RouteMapType, route: string, part: Part
): void {
  // XXX: path-ro-regexp and add args to part
  routeMap.set(route, {part});
}

export function createPart(ctx: BuilderContext, rawPart: RawPart): [Part, AttItem[]] | undefined {
  const builder = ctx.session.builders.get(rawPart.kind)
  if (builder == null) {
    ctx.throw_error(`Unknown part kind: ${rawPart.kind}`)
  }
  let attlist = ctx.copy_array(rawPart.attlist)
  return builder.createPart(ctx, attlist)
}

if (module.id === ".") {
  (async () => {
    let [...args] = process.argv.slice(2);
    console.time('load lrxml');
    const { parse_long_options } = await import("lrxml")
    console.timeLog('load lrxml');
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      debug: { declaration: debugLevel },
      entFns: {}
    }
    parse_long_options(args, {target: config})

    const { readFileSync } = await import('fs')

    console.time('run');
    for (const fn of args) {
      const [template, _session] = build_template_declaration(
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
