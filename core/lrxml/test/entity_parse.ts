#!/usr/bin/env ts-node

import tap from 'tap'

import {parserContext} from '../src/context'

import {
  parse_entpath
} from '../src/entity/parse'

{
  const it = (source: string) => {
    let ctx = parserContext({
      source, config: {}
    })
    const node = parse_entpath(ctx);
    return node.path.map((i) => noRange(i))
  }

  tap.same(it(`:foo;`), [{kind: 'var', name: 'foo'}])

  tap.same(it(`:foo:bar;`), [{kind: 'var', name: 'foo'}, {kind: 'prop', name: 'bar'}])

  tap.same(it(`:foo:bar();`), [{kind: 'var', name: 'foo'}, {
    kind: 'invoke', name: 'bar', elements: []
  }])

  tap.same(it(`:foo:bar():baz;`), [{kind: 'var', name: 'foo'}, {
    kind: 'invoke', name: 'bar', elements: []
  }, {kind: 'prop', name: 'baz'}])

  tap.same(it(`:foo(bar);`), [{kind: 'call', name: 'foo', elements: [
    {kind: 'text', text: 'bar', is_paren: false}
  ]}])

  tap.same(it(`:foo():bar();`), [
    {kind: 'call', name: 'foo', elements: []},
    {kind: 'invoke', name: 'bar', elements: []}
  ])

  tap.same(it(`:param(foo,:param(bar){hoe});`), [
    {kind: "call", name: 'param', elements: [
      {kind: "text", text: "foo", is_paren: false},
      [
        {kind: "call", name: "param", elements: [
          {kind: "text", text: "bar", is_paren: false}
        ]},
        {kind: "href", elements: [
          {kind: "text", text: "hoe", is_paren: false}
        ]}
      ]
    ]}
  ])
}

function noRange(item: any): Array<any> | Object {
  if (item instanceof Array) {
    return item.map(i => noRange(i))
  }

  let result: {[k: string]: any} = {}
  for (const [k, v] of Object.entries(item)) {
    if (k === 'start' || k === 'end' || k === 'innerRange' || k === 'line')
      continue
    if (k === "elements") {
      result[k] = (v as Array<any>).map(i => noRange(i))
    }
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      result[k] = v
    }
    else {
      result[k] = noRange(v);
    }
  }
  return result
}
