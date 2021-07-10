#!/usr/bin/env ts-node

import { parse_multipart, RawPart, AttItem } from 'lrxml-js'

import { YattConfig } from '../config'

import { BuilderMap, BuilderContext, BuilderSession, PartName } from './context'

import { Part, ArgDict, DefaultFlag } from './part'

import { WidgetBuilder } from './widget'
import { ActionBuilder } from './action'

import { TemplateDeclaration } from './template'

export function builtin_builders(): BuilderMap {
  let builders = new Map
  builders.set('args', new WidgetBuilder(false, true))
  builders.set('widget', new WidgetBuilder(true, false))
  builders.set('page', new WidgetBuilder(true, true))
  builders.set('action', new ActionBuilder)
  // XXX: entity
  // XXX: base, import
  builders.set('', builders.get('args'))
  return builders
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
  type Item = (PartName & {rawPart: RawPart})
  let partMap_: Map<[string, string], Item> = new Map;
  for (const rawPart of rawPartList) {
    const pn = parse_part_name(ctx, rawPart)
    if (! pn)
      continue;
    const item: Item = {...pn, rawPart}
    if (partMap_.has([item.kind, item.name])) {
      // XXX: Better diag
      ctx.throw_error(`Duplicate declaration ${item.kind} ${item.name}`);
    }
    partMap_.set([item.kind, item.name], item)
  }

  let partMap: Map<[string, string], Part> = new Map;
  let routes: Map<string, Part> = new Map;
  for (const entry of partMap_) {
    const [key, item] = entry
    const [kind, name] = key
    // XXX: delegate type
    // XXX: ArgMacro
    const arg_dict = build_arg_dict(ctx, item.rest)
    const part = {
      kind, name, is_public: item.is_public, arg_dict, raw_part: item.rawPart
    }
    partMap.set(key, part)
    if (item.route != null) {
      routes.set(item.route, part)
    }
  }

  return [{path: config.filename ?? "", partMap, routes}, builder_session]
}

function parse_part_name(ctx: BuilderContext, rawPart: RawPart): PartName | undefined {
  const builder = ctx.session.builders.get(rawPart.kind)
  if (builder == null) {
    ctx.throw_error(`Unknown part kind: ${rawPart.kind}`)
  }
  let attlist = Object.assign([], rawPart.attlist)
  return builder.parse_part_name(ctx, attlist)
}

function parse_arg_spec(ctx: BuilderContext, str: string): { type: string, default?: [DefaultFlag, string] } {
  let match = /([\/\|\?])/.exec(str)
  if (match == null) {
    return { type: "" }
  } else {
    let type = str.substring(0, match.index)
    let dflag = match[0]
    let defaultValue = str.substring(match.index + 1);
    return { type, default: [dflag as DefaultFlag, defaultValue] }
  }
}

function build_arg_dict(ctx: BuilderContext, attlist: AttItem[]): ArgDict {
  let arg_dict: ArgDict = {}
  for (const att of attlist) {
    if (att.label) {
      if (att.label.kind !== "bare")
        ctx.throw_error(`Invalid att label: ${att.label}`)
      let name = att.label.value
      if (att.kind === "sq" || att.kind === "dq" || att.kind === "bare") {
        arg_dict[name] = {
          name,
          ...parse_arg_spec(ctx, att.value)
        }
      } else {
        ctx.throw_error(`??1 ${att.kind}`)
      }
    }
    else {
      if (att.kind === "bare") {
        let name = att.value
        arg_dict[name] = { name, type: "" }
      }
      else if (att.kind === "entity") {
        // XXX: declaration macro
        console.warn('ArgMacro is ignored: ', att)
      }
      else {
        ctx.throw_error(`??2 ${att.kind} file ${ctx.session.filename}`)
      }
    }
  }
  return arg_dict
}


if (module.id === ".") {
  let [...args] = process.argv.slice(2);

  const { parse_long_options } = require("lrxml-js")
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = { debug: { parser: debugLevel } }
  parse_long_options(args, {target: config})

  const { readFileSync } = require('fs')

  for (const fn of args) {
    const [template, _session] = build_template_declaration(
      readFileSync(fn, { encoding: "utf-8" }),
      {filename: fn, ...config}
    )

    console.dir(template, {colors: true, depth: null})
  }
}
