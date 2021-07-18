#!/usr/bin/env ts-node

import {
  parse_multipart, RawPart, AttItem,
  isBareLabeledAtt, hasStringValue, isIdentOnly, Token,
  hasLabel, hasQuotedStringValue
} from 'lrxml-js'

import { YattConfig } from '../config'

import { BuilderMap, BuilderContext, BuilderSession, PartName } from './context'

// import { Part, ArgDict, DefaultFlag } from './part'
export type PartSet = {[k: string]: Part}

export type PartKind = string

export type Part = {
  kind: PartKind
  name: string
  is_public: boolean
  argMap: Map<string, Variable>;
  raw_part?: RawPart //
  route?: string
}

export type DefaultFlag = "?" | "|" | "/"

// import { WidgetBuilder, Widget } from './widget'
export type Widget = Part & {
  kind: "widget"
}

import {DeclarationProcessor} from './context'

export class WidgetBuilder implements DeclarationProcessor {
  readonly kind: string = 'widget'
  constructor(
    readonly is_named: boolean, readonly is_public: boolean,
    readonly prefix: string = 'render_'
  ) {}

  parse_part_name(ctx: BuilderContext, attlist: AttItem[]): PartName {
    if (! this.is_named) {
      // yatt:args
      // "/route"
      if (attlist.length && !hasLabel(attlist[0])
          && hasQuotedStringValue(attlist[0])) {
        const att = attlist.shift()!
        return {kind: this.kind, prefix: this.prefix, name: "", is_public: this.is_public, route: ctx.range_text(att), rest: attlist}
      } else {
        return {kind: this.kind, prefix: this.prefix, name: "", is_public: this.is_public, rest: attlist}
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
      const [name, route] = att
      return {kind: this.kind, prefix: this.prefix, name, route, is_public: this.is_public, rest: attlist}
    }
  }
}


// import { ActionBuilder, Action } from './action'
export type Action = Part & {
  kind: "action"
}

export class ActionBuilder implements DeclarationProcessor {
  readonly kind = 'action';
  constructor(readonly prefix: string = 'do_') {}

  parse_part_name(ctx: BuilderContext, attlist: AttItem[]): PartName {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const [name, route] = ctx.cut_name_and_route(attlist)!
    return {kind: this.kind, prefix: this.prefix, name, route, is_public: false, rest: attlist}
  }
}


import { BaseProcessor } from './base'

// import { TemplateDeclaration } from './template'
export type TemplateDeclaration = {
  path: string
  partMap: PartMapType;
  routes: Map<string, Part>;
}

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

export type VariableBase = {
  typeName: string
  varName:  string
  argNo?:   number
  defaultSpec?: [DefaultFlag, string]
  attItem?: AttItem
  from_route: boolean
  is_body_argument: boolean
  is_escaped: boolean
  is_callable: boolean
}

type TextVar = {typeName: "text"} & VariableBase;
type ListVar = {typeName: "list"} & VariableBase;
type ScalarVar = {typeName: "scalar"} & VariableBase;
type BooleanVar = {typeName: "boolean"} & VariableBase;
type HtmlVar = {typeName: "html", is_escaped: true} & VariableBase;
type ExprVar = { typeName: "expr", is_callable: true} & VariableBase;
type SimpleVar = TextVar | ListVar | ScalarVar | BooleanVar | HtmlVar | ExprVar

type WidgetVar = {
  typeName: "widget", is_callable: true, widget: Widget
} & VariableBase;

type DelegateVar = {
  typeName: "delegate", is_callable: true, widget: Widget,
  delegateVars: Map<string, SimpleVar>
} & VariableBase;

type Variable = SimpleVar | WidgetVar | DelegateVar

type VarTypeSpec = { typeName: string, defaultSpec?: [DefaultFlag, string] }

export function build_simple_variable(
  ctx: BuilderContext, attItem: AttItem, argNo: number, varName: string, spec: VarTypeSpec
): Variable
{
  let {typeName, defaultSpec} = spec;
  const is_body_argument = varName === "body"; // XXX
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

function map_append<K,V>(map: Map<K,V[]>, k: K, v: V): void {
  if (map.has(k)) {
    map.get(k)!.push(v)
  } else {
    map.set(k, [v]);
  }
}

export interface PartMapType {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  [k: string]: Map<string, Part>;
}

type ArgAdder = {
  name: string, dep: string, fun: (widget: Widget) => ArgAdder | undefined
}

export function build_template_declaration(
  source: string, config: {filename?: string, builders?: BuilderMap} & YattConfig
): [TemplateDeclaration, BuilderSession] {
  // XXX: default private or public
  const {builders = builtin_builders(), ...rest_config} = config

  const [rawPartList, parser_session] = parse_multipart(source, rest_config)

  const builder_session = {builders, ...parser_session}

  const ctx = new BuilderContext(builder_session)

  // For delegate type and ArgMacro
  let partMap: PartMapType = {widget: new Map, action: new Map};
  let delayedWidget: Map<string, Widget> = new Map;
  let delayedBy: Map<string, ArgAdder[]> = new Map;

  for (const rawPart of rawPartList) {
    ctx.set_range(rawPart)
    if (partMap[rawPart.kind] == null) {
      ctx.token_error(rawPart, `Unsupported part kind: ${rawPart.kind}`);
    }
    const pn = parse_part_name(ctx, rawPart)
    if (! pn)
      continue;
    const part: Part = {kind: pn.kind, name: pn.name, is_public: pn.is_public, argMap: new Map, raw_part: rawPart}
    if (partMap[part.kind].has(part.name)) {
      // XXX: Better diag
      ctx.throw_error(`Duplicate declaration ${part.kind} ${part.name}`);
    }
    partMap[part.kind].set(part.name, part)
    // XXX: add_route, route_arg
    let task: ArgAdder | undefined = add_args(ctx, part.argMap, pn.rest)
    if (task) {
      if (part.kind !== "widget") {
        ctx.NIMPL()
      }
      delayedWidget.set(part.name, part as Widget)
      map_append(delayedBy, task.dep, task)
      console.log(`delayed delegate arg ${task.name} in widget :${pn.name}, depends on widget :${task.dep}`)
    }
  }

  if (ctx.debug >= 2) {
    // let partNames = Array.from(partMap.keys()).map(v => v.join(" "));
    // console.log(`partMap has: ${partNames}`)
    // console.log(`Raw widget main ${partMap.has(['widget', 'main'])}`)
  }

  // Resolve
  while (delayedWidget.size) {
    if (ctx.debug >= 2) {
      let widgetNames = Array.from(delayedWidget.keys()).join(", ");
      console.log(`delayed widgets: ${widgetNames}`)
    }
    let sz = delayedWidget.size
    // 一つの widget が複数の delegate 引数宣言を持つことは普通に有る
    // 全ての delegate 引数宣言が解決しないと、その widget を delegate として使う他の widget の引数確定が始められない
    //
    for (const [dep, taskList] of delayedBy) {
      let path = dep.split(":");
      if (path.length === 1) {
        if (ctx.debug >= 2) {
          console.log(`Checking dependency for ${dep}`)
        }
        let inSameTemplate = partMap.widget.has(dep)
        let notDelayed = !delayedWidget.has(dep)
        if (ctx.debug >= 2) {
          console.log(`-> name only. In same template? ${inSameTemplate}, Not delayed? ${notDelayed}`)
        }
        if (inSameTemplate && notDelayed) {
          if (ctx.debug >= 2) {
            console.log(`No more deps, let's resolve: ${dep}`)
          }
          const widget = partMap.widget.get(dep)
          if (widget) {
            if (ctx.debug >= 2) {
              console.log(`Found widget: ${dep}`)
            }
            let len = taskList.length
            while (len-- > 0) {
              const task = taskList.shift();
              if (! task)
                continue
              if (ctx.debug >= 2) {
                console.log(`Running task: ${task}`)
              }
              let cont = task.fun(widget as Widget)
              if (! cont) {
                if (ctx.debug >= 2) {
                  console.log(`Task completed, deleting: ${task.name}`)
                }
                delayedWidget.delete(task.name)
              } else {
                if (ctx.debug >= 2) {
                  console.log(`Task pushed again: ${task.name}`)
                }
                taskList.push(task)
              }
            }
          } else {
            if (ctx.debug >= 2) {
              console.log(`Skipped ${dep}`)
            }
          }
          if (! taskList.length) {
            delayedBy.delete(dep)
          }
        }
        else {
          ctx.NIMPL()
        }
      }
      else {
        // XXX: dep が ':' を含む場合…
        ctx.NIMPL()
      }
    }
    if (delayedWidget.size === sz) {
      let widgetNames = Array.from(delayedWidget.keys()).join(", ");
      console.log(`Remaining delayed widgets: ${widgetNames}`)
      ctx.throw_error(`Can't resolve delegates`)
    }
  }

  let routes = new Map; // XXX

  return [{path: config.filename ?? "", partMap, routes}, builder_session]
}

// 配列返しは駄目だ、delegate を見つけた箇所で引数解析を停止させないと。
// そうしないと、明示した引数が delegate の前なのか後だったのかが
// わからなくなる
function add_args(
  ctx: BuilderContext, argMap: Map<string, Variable>, attlist: AttItem[]
): ArgAdder | undefined {

  let gen = (function* () {
    for (const v of attlist) {
      yield v
    }
  })();

  return add_args_cont(ctx, argMap, gen)
}

function add_args_cont(
  ctx: BuilderContext, argMap: Map<string, Variable>, gen: Generator<AttItem>
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
        let v = build_simple_variable(ctx, att, argMap.size, name, spec)
        argMap.set(name, v)
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
          if (fst.value === "code") {
            let widget: Widget = {
              kind: "widget", name, is_public: false,
              argMap: new Map
            }
            add_args(ctx, widget.argMap, attlist)
            let v: WidgetVar = {
              typeName: "widget", widget,
              varName: name, attItem: att, argNo: argMap.size,
              is_callable: true, from_route: false,
              is_body_argument: name === "body", // XXX
              is_escaped: false
            }
            argMap.set(name, v)
          }
          else {
            let [typeName, ...restName] = fst.value.split(/:/)
            if (typeName === "delegate") {
              return {
                name, dep: restName.length ? restName : [name],
                fun: (widget: Widget): ArgAdder | undefined => {
                  let v: DelegateVar = {
                    typeName: "delegate", varName: name,
                    widget,
                    delegateVars: new Map,
                    attItem: att, argNo: argMap.size,
                    is_callable: true, from_route: false,
                    is_body_argument: false,
                    is_escaped: false
                  }

                  argMap.set(name, v)

                  return add_args_cont(ctx, argMap, gen)
                }
              }
            }
            else {
              ctx.token_error(att, `Unknown arg decl`)
            }
          }
        }
      }
      else {
        ctx.token_error(att, `Unknown arg declaration`)
      }
    }
    else if (isIdentOnly(att)) {
      // : name
      let name = att.value
      let v = build_simple_variable(ctx, att, argMap.size, name, {typeName: "text"})
      argMap.set(name, v)
    }
    // XXX: entity (ArgMacro)
    else {
      ctx.token_error(att, `Unknown arg declaration`)
    }
  }
}

function parse_part_name(ctx: BuilderContext, rawPart: RawPart): PartName | undefined {
  const builder = ctx.session.builders.get(rawPart.kind)
  if (builder == null) {
    ctx.throw_error(`Unknown part kind: ${rawPart.kind}`)
  }
  let attlist = ctx.copy_array(rawPart.attlist)
  return builder.parse_part_name(ctx, attlist)
}

function parse_arg_spec(ctx: BuilderContext, str: string, defaultType: string): VarTypeSpec {
  let match = /([\/\|\?])/.exec(str)
  if (match == null) {
    return { typeName: defaultType }
  } else {
    let typeName = str.substring(0, match.index)
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
  let config = { debug: { declaration: debugLevel } }
  parse_long_options(args, {target: config})

  const { readFileSync } = require('fs')

  console.time('run');
  for (const fn of args) {
    const [template, _session] = build_template_declaration(
      readFileSync(fn, { encoding: "utf-8" }),
      {filename: fn, ...config}
    )

    console.dir(template, {colors: true, depth: null})
  }
  console.timeLog('run');
}
