#!/usr/bin/env ts-node

// * add test/**/*.ts to tsconfig.src
// * enable 'esModuleInterop' flags
// * prepare tsconfig.build.json and add rootDir: src, exclude: ["test"]

import tap from 'tap'

import { ParserSession, range_text } from '../src/context'
import {AttItem} from '../src/attlist/parse'
import { parse_multipart } from '../src/multipart/parse'
import { tokenize } from '../src/template/tokenize'

// import { createInterface } from 'readline'
const srcText = (session: ParserSession, att: AttItem) => 
  range_text(session.source, att);

const it = (source: string) => {
  let [partList, session] = parse_multipart(source, {});
  return Array.from(partList).map((part) => {
    return {
      part: part.kind,
      attlist: part.attlist.map((att) => [
        att.kind,
        (att.label
         ? [srcText(session, att.label), srcText(session, att)]
         : srcText(session, att))
      ]),
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
