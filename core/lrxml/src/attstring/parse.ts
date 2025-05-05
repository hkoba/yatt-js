#!/usr/bin/env -S deno run -R

declare global {
  interface ImportMeta {main: boolean}
}

import {parserContext} from '../context.ts'
import type {ParserContext, Range, RangeLine} from '../context.ts'

import {
  type EntNode,
  parse_entpath,
  re_entity_open
} from '../entity/parse.ts'

// XXX: LCMsg

// XXX: switch to RangeLine
export type AttStringItem = Range &
  ({kind: "text", value: string}
   | EntNode)

export function parse_attstring(outerCtx: ParserContext, range: RangeLine): AttStringItem[] {
  let re = outerCtx.re('attstring', () => new RegExp(re_entity_open(outerCtx.session.params.namespace, '&'), 'g'))

  const ctx = outerCtx.narrowed(range)

  const items: AttStringItem[] = []
  let globalMatch
  while ((globalMatch = ctx.global_match(re))) {
    const prefix = ctx.prefix_of(globalMatch)
    if (prefix != null) {
      items.push({kind: "text", value: ctx.range_text(prefix), ...prefix})
    }
    ctx.tab(globalMatch)
    const entNode = parse_entpath(ctx);
    items.push(entNode)
  }

  const rest = ctx.rest_range()
  if (rest != null) {
    items.push({kind: "text", value: ctx.range_text(rest), ...rest});
  }

  return items;
}

if (import.meta.main) {
  const process = await import("node:process")
  for (const str of process.argv.slice(2)) {
    const ctx = parserContext({
      filename: "dummy.ytjs",
      source: str, config: {}
    })

    const node = parse_attstring(ctx, {line: 1, start: 0, end: str.length})
    console.dir(node, {depth: null, colors: true})
  }
}
