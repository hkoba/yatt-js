#!/usr/bin/env -S deno test -RE

import {test as cross_test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parserContext} from '../src/context.ts'

import {
  parse_entpath
} from '../src/entity/parse.ts'

{
  const test = (source: string, expect: any) => {
    cross_test(source, () => {
      const ctx = parserContext({
        filename: "dummy.ytjs",
        source, config: {}
      })
      const node = parse_entpath(ctx);
      const got = node.path.map((i) => noRange(i));
      assertEquals(got, expect)
    })
  }

  test(`:foo;`, [{kind: 'var', name: 'foo'}])

  test(`:foo:bar;`, [{kind: 'var', name: 'foo'}, {kind: 'prop', name: 'bar'}])

  test(`:foo:bar();`, [{kind: 'var', name: 'foo'}, {
    kind: 'invoke', name: 'bar', elements: []
  }])

  test(`:foo:bar():baz;`, [{kind: 'var', name: 'foo'}, {
    kind: 'invoke', name: 'bar', elements: []
  }, {kind: 'prop', name: 'baz'}])

  test(`:foo(bar);`, [{kind: 'call', name: 'foo', elements: [
    {kind: 'text', text: 'bar', is_paren: false}
  ]}])

  test(`:foo():bar();`, [
    {kind: 'call', name: 'foo', elements: []},
    {kind: 'invoke', name: 'bar', elements: []}
  ])

  test(`:param(foo,:param(bar){hoe});`, [
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
