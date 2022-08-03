#!/usr/bin/env ts-node

import {parserContext, ParserContext, Range} from '../context'

import {
  EntNode,
  parse_entpath,
  re_entity_open
} from '../entity/parse'

// XXX: LCMsg

export type AttStringItem = Range &
  ({kind: "text", value: string}
   | EntNode)

export function parse_attstring(outerCtx: ParserContext, range: Range): AttStringItem[] {
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

if (module.id === ".") {
  for (const str of process.argv.slice(2)) {
    let ctx = parserContext({
      source: str, config: {}
    })

    const node = parse_attstring(ctx, {start: 0, end: str.length})
    console.dir(node, {depth: null, colors: true})
  }
}
