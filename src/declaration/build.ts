#!/usr/bin/env ts-node

import {
  parse_multipart, RawPart, AttItem,
  isBareLabeledAtt, isIdentOnly,
  hasLabel, hasQuotedStringValue
} from 'lrxml-js'

import { YattConfig } from '../config'

import {
  BuilderMap, BuilderContext, BuilderSession, DeclarationProcessor
} from './context'

import { TaskGraph } from './taskgraph'

import { Part, Widget, makeWidget, Action } from './part'

import {VarTypeSpec, Variable, WidgetVar, DelegateVar, DefaultFlag} from './vartype'

import { BaseProcessor } from './base'

export class WidgetBuilder implements DeclarationProcessor {
  readonly kind: string = 'widget'
  constructor(
    readonly is_named: boolean, readonly is_public: boolean,
  ) {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Widget, AttItem[]] {
    let name, route
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
    }
    let widget = makeWidget(name, this.is_public)
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

export type TemplateDeclaration = {
  path: string
  partMap: PartMapType;
  routeMap: RouteMapType;
}

export interface PartMapType {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  [k: string]: Map<string, Part>;
}

export type RouteMapType = Map<string, {part: Part}>;

export function builtin_builders(): BuilderMap {
  let builders = new Map
  builders.set('args', new WidgetBuilder(false, true))
  builders.set('widget', new WidgetBuilder(true, false))
  builders.set('page', new WidgetBuilder(true, true))
  builders.set('action', new ActionBuilder)
  builders.set('base', new BaseProcessor)
  // XXX: entity
  // XXX: import
  builders.set('', builders.get('args'))
  return builders
}

export function build_simple_variable(
  ctx: BuilderContext, attItem: AttItem, argNo: number, varName: string, spec: VarTypeSpec
): Variable
{
  let {typeName, defaultSpec} = spec;
  const is_body_argument = ctx.is_body_argument(varName);
  switch (typeName) {
    case "text": case "list": case "scalar": case "boolean": return {
      typeName, varName, defaultSpec, attItem, argNo,
      from_route: false, is_body_argument,
      is_escaped: false, is_callable: false
    }

    case "html": return {
      typeName, varName, defaultSpec, attItem, argNo,
      from_route: false, is_body_argument,
      is_escaped: true, is_callable: false
    }
    case "code": return {
      typeName: "expr", varName, defaultSpec, attItem, argNo,
      from_route: false, is_body_argument,
      is_escaped: false, is_callable: true
    }
    default: {
      ctx.token_error(attItem, `Unknown argument`);
    }
  }
}

type ArgAdder = {
  name: string, dep: string, fun: (widget: Widget) => ArgAdder | undefined
}

export function build_template_declaration(
  source: string, config: {filename?: string, builders?: BuilderMap} & YattConfig
): [TemplateDeclaration, BuilderSession] {
  // XXX: default private or public
  let {builders = builtin_builders(), ...rest_config}: {builders?: BuilderMap, filename?: string} & YattConfig = config

  const [rawPartList, parser_session] = parse_multipart(source, rest_config)

  const builder_session: BuilderSession = {builders, ...parser_session} as BuilderSession

  const ctx = new BuilderContext(builder_session)

  // For delegate type and ArgMacro
  let partMap: PartMapType = {widget: new Map, action: new Map};
  let taskGraph = new TaskGraph<Widget>(ctx.debug);
  let routeMap: RouteMapType = new Map

  for (const rawPart of rawPartList) {
    ctx.set_range(rawPart)
    if (! builders.has(rawPart.kind)) {
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
    partMap[part.kind].set(part.name, part)
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

  return [{path: config.filename ?? "", partMap, routeMap}, builder_session]
}

function add_route(
  ctx: BuilderContext, routeMap: RouteMapType, route: string, part: Part
): void {
  // XXX: path-ro-regexp and add args to part
  routeMap.set(route, {part});
}

function add_args(
  ctx: BuilderContext, part: Part, attlist: AttItem[]
): ArgAdder | undefined {

  let gen = (function* () {
    for (const v of attlist) {
      yield v
    }
  })();

  return add_args_cont(ctx, part, gen)
}

function add_args_cont(
  ctx: BuilderContext, part: Part, gen: Generator<AttItem>
): ArgAdder | undefined {

  for (const att of gen) {
    if (ctx.debug >= 2) {
      console.log('add args from: ', att)
    }
    if (isBareLabeledAtt(att)) {
      let name = att.label.value
      if (att.kind === "bare" || att.kind === "sq" || att.kind === "dq" || att.kind === "identplus") {
        // : name="type?default"
        if (ctx.debug) {
          console.log(`kind ${att.kind}: ${name} = ${att.value}`)
        }
        let spec = parse_arg_spec(ctx, att.value, "text")
        // XXX: こっちにも delegate 有る…？廃止？
        let v = build_simple_variable(ctx, att, part.argMap.size, name, spec)
        part.argMap.set(name, v)
      }
      else if (att.kind === "nest") {
        // : name=[code] name=[delegate]
        if (att.value.length === 0) {
          ctx.token_error(att, `Empty arg declaration`)
        }
        let attlist = ctx.copy_array(att.value)
        let fst = attlist.shift()!
        if (isIdentOnly(fst)
            || !hasLabel(fst) && hasQuotedStringValue(fst)) {
          // XXX: ここも型名で拡張可能にしたい
          let [typeName, ...restName] = fst.value.split(/:/)
          if (typeName === "code") {
            let v = build_widget_varialbe(ctx, att, part.argMap.size, name, attlist)
            part.argMap.set(name, v)
          }
          else if (typeName === "delegate") {
            return build_delegate_variable_adder(
              ctx, part, gen, att, part.argMap.size,
              name, restName, attlist
            )
          } else {
            ctx.token_error(att, `Unknown typename: ${typeName}`)
          }
        }
        else {
          ctx.token_error(att, `Unknown arg declaration`)
        }
      }
      else {
        ctx.token_error(att, `Unknown arg declaration`)
      }
    }
    else if (isIdentOnly(att)) {
      // : name
      let name = att.value
      let v = build_simple_variable(ctx, att, part.argMap.size, name, {typeName: "text"})
      part.argMap.set(name, v)
    }
    // XXX: entity (ArgMacro)
    else {
      ctx.token_error(att, `Unknown arg declaration`)
    }
  }
}

function build_widget_varialbe(ctx: BuilderContext, att: AttItem, argNo: number, varName: string, attlist: AttItem[]): WidgetVar {
  let widget: Widget = makeWidget(varName, false)
  add_args(ctx, widget, attlist) // XXX: ここで delegate は禁止よね
  return {
    typeName: "widget", widget,
    varName, attItem: att, argNo,
    is_callable: true, from_route: false,
    is_body_argument: ctx.is_body_argument(varName),
    is_escaped: false
  }
}

function build_delegate_variable_adder(
  ctx: BuilderContext, part: Part, gen: Generator<AttItem>,
  att: AttItem, argNo: number,
  name: string, restName: string[], attlist: AttItem[]
): ArgAdder {
  return {
    name: part.name, dep: restName.length ? restName.join(":") : name,
    fun: (widget: Widget): ArgAdder | undefined => {
      let v: DelegateVar = {
        typeName: "delegate", varName: name,
        widget,
        delegateVars: new Map,
        attItem: att, argNo,
        is_callable: true, from_route: false,
        is_body_argument: false,
        is_escaped: false
      }

      part.varMap.set(name, v)

      if (attlist.length) {
        for (const att of attlist) {
          if (! isIdentOnly(att)) {
            ctx.NIMPL()
          }
          let name = att.value
          if (! widget.argMap.has(name)) {
            ctx.throw_error(`No such argument ${name} in delegated widget ${widget.name}`)
          }
          // XXX: deep copy, with original link?
          part.argMap.set(name, widget.argMap.get(name)!)
        }
      } else {
        for (const [name, value] of widget.argMap.entries()) {
          if (part.argMap.has(name)) {
            if (ctx.debug) {
              // XXX: better diag
              console.log(`skipping ${name} because it already exists`)
            }
            continue
          }
          part.argMap.set(name, value)
        }
      }
      return add_args_cont(ctx, part, gen)
    }
  }
}

function createPart(ctx: BuilderContext, rawPart: RawPart): [Part, AttItem[]] | undefined {
  const builder = ctx.session.builders.get(rawPart.kind)
  if (builder == null) {
    ctx.throw_error(`Unknown part kind: ${rawPart.kind}`)
  }
  let attlist = ctx.copy_array(rawPart.attlist)
  return builder.createPart(ctx, attlist)
}

function parse_arg_spec(ctx: BuilderContext, str: string, defaultType: string): VarTypeSpec {
  let match = /([\/\|\?])/.exec(str)
  if (match == null) {
    return { typeName: defaultType }
  } else {
    let typeName = match.index ? str.substring(0, match.index) : defaultType;
    let dflag = match[0]
    let defaultValue = str.substring(match.index + 1);
    return { typeName, defaultSpec: [dflag as DefaultFlag, defaultValue] }
  }
}

if (module.id === ".") {
  let [...args] = process.argv.slice(2);
  console.time('load lrxml-js');
  const { parse_long_options } = require("lrxml-js")
  console.timeLog('load lrxml-js');
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    body_argument_name: "body",
    debug: { declaration: debugLevel }
  }
  parse_long_options(args, {target: config})

  const { readFileSync } = require('fs')

  console.time('run');
  for (const fn of args) {
    const [template, _session] = build_template_declaration(
      readFileSync(fn, { encoding: "utf-8" }),
      {filename: fn, ...config}
    )

    const {partMap} = template;
    for (const [name, widget] of partMap.widget) {
      const args = [...widget.argMap.keys()].join(", ");
      const proto = `function render_${name}(${args})`
      console.log(proto);
    }
  }
  console.timeLog('run');
}
