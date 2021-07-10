#!/usr/bin/env ts-node

import { parse_multipart, RawPart } from 'lrxml-js'

import { YattConfig } from '../config'

import { BuilderMap, BuilderContext, BuilderSession, PartName } from './context'
import { Part } from './part'
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
    const item: Item = {...ctx.parse_part_name(rawPart), rawPart}
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
    const arg_dict = ctx.build_arg_dict(item.rest)
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
