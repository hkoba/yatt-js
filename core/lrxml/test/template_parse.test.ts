#!/usr/bin/env -S deno test -RE

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parse_multipart, parse_template} from '../src/index.ts'
import type {Node, Text, AttItem} from '../src/index.ts'

{
  const text = (source: string, nodeList: Node[]) =>
    nodeList.filter((n): n is Text => n.kind === "text").map(
      n => source.substring(n.start, n.end)
    );

  type ResultItem = string | AttItem[] | string[] | undefined | ResultItem[]
  const it = (source: string) => {
    const config = { debug: {} }
    const [partList, session] = parse_multipart(source, config)
    return partList.map(part => {
      const result: ResultItem[] = []
      for (const node of parse_template(session, part)) {
        if (node.kind !== "element")
          continue

        const attlist = node.attlist.map(a => {
          if (a.kind === "attelem") {
            const x = [...a.path, ...text(source, a.children ?? [])]
            return x

          }
          else if (a.kind === "entity") {
            return "??"
          }
          else if (a.label != null) {
            const x = [a.label.value, a.value]
            return x
          } else {
            return a.value
          }
        })

        const footer = node.footer?.map(a => {
          return [...a.path, text(source, a.children ?? [])]
        })

        result.push([node.path, attlist
                     , text(source, node.children ?? [])
                     , footer])
      }
      // console.dir(result, {colors: true, depth: null})
      return result;
    })
  };

  test("widget call", () => {
    const res = it(`<yatt:foo x y=3>
<:yatt:bar>aa</:yatt:bar>
aiueo
<:yatt:baz/>
kk
</yatt:foo>
`)
assertEquals(res, [
  [
    [['yatt', 'foo'],
     ['x', ['y', "3"], ['yatt', 'bar', 'aa']],
     ['aiueo\n'],
     [['yatt', 'baz', ['kk\n']]]
    ]
  ]
])})
}
