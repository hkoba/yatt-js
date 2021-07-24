#!/usr/bin/env ts-node

import tap from 'tap'

import {parse_multipart} from '../src/multipart/parse'

import {parse_template, Node, Text} from '../src/template/parse'

{
  const text = (source: string, nodeList: Node[]) =>
    nodeList.filter((n): n is Text => n.kind === "text").map(
      n => source.substring(n.start, n.end)
    );

  const it = (source: string) => {
    let config = { debug: {} }
    let [partList, session] = parse_multipart(source, config)
    return partList.map(part => {
      let result = []
      for (const node of parse_template(session, part)) {
        if (node.kind !== "element")
          continue

        const attlist = node.attlist.map(a => {
          if (a.kind === "attelem") {
            return [...a.path, ...text(source, a.children ?? [])]
          }
          else if (a.kind === "entity") {
            return "??"
          }
          else if (a.label != null) {
            return [a.label.value, a.value]
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
      // console.dir(result, {color: true, depth: null})
      return result;
    })
  };

  tap.same(it(`<yatt:foo x y=3>
<:yatt:bar>aa</:yatt:bar>
aiueo
<:yatt:baz/>
kk
</yatt:foo>
`), [
  [
    [['yatt', 'foo'],
     ['x', ['y', 3], ['yatt', 'bar', 'aa']],
     ['aiueo\n'],
     [['yatt', 'baz', ['kk\n']]]
    ]
  ]
])
}
