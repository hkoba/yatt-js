#!/usr/bin/env ts-node

import { parse_multipart, ParserContext, parserSession, ParserSession } from 'lrxml-js'

import { BuilderMap, BuilderContext, BuilderSession, YattConfig } from './context'
import { Part } from './part'
import { WidgetBuilder } from './widget'
import { ActionBuilder } from './action'

export function builtin_builders(): BuilderMap {
  let builders = new Map
  builders.set('args', new WidgetBuilder(false, true))
  builders.set('widget', new WidgetBuilder(true, false))
  builders.set('page', new WidgetBuilder(true, true))
  builders.set('action', new ActionBuilder)
  // entity
  builders.set('', builders.get('args'))
  return builders
}

export function build_declarations(
  source: string, config: {filename?: string, builders?: BuilderMap} & YattConfig
) : [Part[], BuilderSession] {

  // XXX: default private or public
  const {builders = builtin_builders(), ...rest_config} = config

  const [rawPartList, parser_session] = parse_multipart(source, rest_config)

  const builder_session = {builders, ...parser_session}

  const ctx = new BuilderContext(builder_session)

  // XXX: declaration macro handling
  const partList = rawPartList.map(rawPart => ctx.build_declaration(rawPart))

  return [partList, builder_session]
}

if (module.id === ".") {
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  const { readFileSync } = require('fs')

  for (const fn of process.argv.slice(2)) {
    const [partList, _session] = build_declarations(
      readFileSync(fn, { encoding: "utf-8" }),
      {filename: fn, debug: { parser: debugLevel }}
    )

    for (const part of partList) {
      console.dir(part, {colors: true, depth: null})
    }
  }
}
