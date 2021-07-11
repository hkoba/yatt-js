#!/usr/bin/env ts-node

// * add test/**/*.ts to tsconfig.src
// * enable 'esModuleInterop' flags

import tap from 'tap'

import { parserContext, range_text } from '../src/context'

import { parse_multipart } from '../src/multipart/parse'
import { tokenize } from '../src/template/tokenize'

// import { createInterface } from 'readline'

const it = (source: string) => {
  let [partList, session] = parse_multipart(source, {});
  return Array.from(partList).map((part) => {
    return {
      part: part.kind, attlist: part.attlist.map((att) => range_text(session.source, att)),
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
      "bar", "x", "y"
    ],
    tokens: [
      {kind: "text", text: `content
`}
    ]
  }
])
