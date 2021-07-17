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
  argMap: Map<string, Variable>
  raw_part?: RawPart //
}

export type DefaultFlag = "?" | "|" | "/"

// import { WidgetBuilder, Widget } from './widget'
export type Widget = Part & {
  kind: "widget"
  route?: string
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


import { ActionBuilder } from './action'
import { BaseProcessor } from './base'

// import { TemplateDeclaration } from './template'
export type TemplateDeclaration = {
  path: string
  partMap: Map<[string, string], Part>;
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

export function build_template_declaration(
  source: string, config: {filename?: string, builders?: BuilderMap} & YattConfig
): [TemplateDeclaration, BuilderSession] {
  // XXX: default private or public
  const {builders = builtin_builders(), ...rest_config} = config

  const [rawPartList, parser_session] = parse_multipart(source, rest_config)

  const builder_session = {builders, ...parser_session}

  const ctx = new BuilderContext(builder_session)

  // For delegate type and ArgMacro
  type Item = (PartName & {argMap: Map<string, Variable>, rawPart: RawPart})
  let partMap_: Map<[string, string], Item> = new Map;
  for (const rawPart of rawPartList) {
    ctx.set_range(rawPart)
    const pn = parse_part_name(ctx, rawPart)
    if (! pn)
      continue;
    const item: Item = {...pn, rawPart, argMap: new Map}
    if (partMap_.has([item.kind, item.name])) {
      // XXX: Better diag
      ctx.throw_error(`Duplicate declaration ${item.kind} ${item.name}`);
    }
    partMap_.set([item.kind, item.name], item)
    // XXX: add_route, route_arg
    add_args(ctx, item.argMap, item.rest)
  }

  let partMap: Map<[string, string], Part> = new Map;
  let routes: Map<string, Part> = new Map;
  for (const entry of partMap_) {
    const [key, item] = entry
    const [kind, name] = key
    // XXX: delegate type
    // XXX: ArgMacro
    const part = {
      kind, name, is_public: item.is_public, argMap: item.argMap, raw_part: item.rawPart
    }
    partMap.set(key, part)
    if (item.route != null) {
      routes.set(item.route, part)
    }
  }

  return [{path: config.filename ?? "", partMap, routes}, builder_session]
}

type Finder = (ctx: BuilderContext, name: string) => Widget;

function add_args(ctx: BuilderContext, argMap: Map<string, Variable>, attlist: AttItem[]): ((finder: Finder) => Variable)[] {
  let delayed = []
  for (const att of attlist) {
    if (isBareLabeledAtt(att)) {
      let name = att.label.value
      if (att.kind === "bare" || att.kind === "sq" || att.kind === "dq" || att.kind === "identplus") {
        // : name="type?default"
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
              delayed.push((finder: Finder) => {
                let widget = finder(ctx, name);
                let v: DelegateVar = {
                  typeName: "delegate", varName: name,
                  widget,
                  delegateVars: new Map,
                  attItem: att, argNo: argMap.size,
                  is_callable: true, from_route: false,
                  is_body_argument: false,
                  is_escaped: false
                }
                return v
              })
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

  return delayed;
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
  let config = { debug: { parser: debugLevel } }
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
