#!/usr/bin/env ts-node

// * add test/**/*.ts to tsconfig.src
// * enable 'esModuleInterop' flags
// * prepare tsconfig.build.json and add rootDir: src, exclude: ["test"]

import tap from 'tap'

import { range_text, hasLabel, parse_multipart, tokenize } from '../src/'

const it = (source: string) => {
  let [partList, session] = parse_multipart(source, {});
  return Array.from(partList).map((part) => {
    return {
      part: part.kind,
      attlist: part.attlist.map(att => {
        if (hasLabel(att)) {
          return [att.label.kind, att.label.value,
                  att.kind, (att as any).value]
        } else {
          return [att.kind, (att as any).value]
        }
      }),
      tokens: Array.from(tokenize(session, part.payload)).map((tok) => {
        if (tok.kind === "comment" && tok.innerRange != null) {
          return {
            kind: tok.kind, "text": range_text(session.source, tok),
            innerRange: range_text(session.source, tok.innerRange)
          }
        } else {
          return { kind: tok.kind, "text": range_text(session.source, tok) }
        }
      })
    }
  })
}

tap.same(it(``), [])

tap.same(it(`<!yatt:foo bar x y>
content
`), [
  {
    part: "foo",
    attlist: [
      ["identplus", "bar"], ["identplus", "x"], ["identplus", "y"]
    ],
    tokens: [
      {kind: "text", text: `content
`}
    ]
  }
])

tap.same(it(`<!yatt:foo bar x=3 y="aaa" z='bbb'>
content
`), [
  {
    part: "foo",
    attlist: [
      ["identplus", "bar"],
      ["identplus", "x", "bare", 3],
      ["identplus", "y", "dq",   "aaa"],
      ["identplus", "z", "sq",   "bbb"],
    ],
    tokens: [
      {kind: "text", text: `content
`}
    ]
  }
])

