#!/usr/bin/env ts-node

import tap from 'tap'

import {parserContext} from '../src/context'

import {
  parse_entpath
  , EntPathItem
} from '../src/entity/parse'

{
  const it = (source: string) => {
    let ctx = parserContext({
      source, config: {}
    })
    const node = parse_entpath(ctx);
    return node.path.map((i) => unnest(i))
  }

  tap.same(it(`:foo;`), [{kind: 'var', name: 'foo'}])

  tap.same(it(`:foo(bar);`), [{kind: 'call', name: 'foo', elements: [
    {kind: 'text', text: 'bar', is_paren: false}
  ]}])

  
}

function unnest(item: Object) {
  let result: {[k: string]: any} = {}
  for (const [k, v] of Object.entries(item)) {
    if (k === 'start' || k === 'end' || k === 'innerRange')
      continue
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      result[k] = v
    }
    else {
      result[k] = unnest(v);
    }
  }
  return result
}
