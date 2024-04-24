#!/usr/bin/env -S deno run -A

// * add test/**/*.ts to tsconfig.src
// * enable 'esModuleInterop' flags
// * prepare tsconfig.build.json and add rootDir: src, exclude: ["test"]

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import { range_text, hasLabel, parse_multipart, tokenize } from '../src/index.ts'

const it = (source: string) => {
  let [partList, session] = parse_multipart(source, {});
  return Array.from(partList).map((part) => {
    const tokens = tokenize(session, part.payload)
    return {
      part: part.kind,
      attlist: part.attlist.map(att => {
        if (hasLabel(att)) {
          return [att.label.kind, att.label.value,
                  att.kind, (att as any).value, [att.label.line, att.line]]
        } else {
          return [att.kind, (att as any).value, [att.line]]
        }
      }),
      tokens: Array.from(tokens).map((tok) => {
        if (tok.kind === "comment" && tok.innerRange != null) {
          return {
            kind: tok.kind,
            line: tok.line,
            "text": range_text(session.source, tok),
            innerRange: range_text(session.source, tok.innerRange)
          }
        } else {
          return {
            kind: tok.kind,
            line: tok.line,
            "text": range_text(session.source, tok)
          }
        }
      })
    }
  })
}

test("Empty string results empty tokens", () => {
  assertEquals(it(``), [])
})

test("A declaration with simple names and its body with entity references", () => {
  assertEquals(it(`<!yatt:foo bar x y>
<h2>&yatt:x;</h2>

&yatt:y;

`), [
  {
    part: "foo",
    attlist: [
      ["identplus", "bar", [1]],
      ["identplus", "x", [1]],
      ["identplus", "y", [1]]
    ],
    tokens: [
      {kind: "text", line: 2, text: `<h2>`},
      {kind: "entpath_open", line: 2, text: `&yatt`},
      {kind: "entity", line: 2, text: `:x;`},
      {kind: "text", line: 2, text: `</h2>\n`},
      {kind: "text", line: 3, text: `\n`},
      {kind: "entpath_open", line: 4, text: `&yatt`},
      {kind: "entity", line: 4, text: `:y;`},
      {kind: "text", line: 4, text: `\n`},
      {kind: "text", line: 5, text: `\n`}
    ]
  }
])})

test("A declaration with name=value pair list", () => {
  assertEquals(it(`<!yatt:foo bar x=3 y="aaa" z='bbb'>
content
`), [
  {
    part: "foo",
    attlist: [
      ["identplus", "bar", [1]],
      ["identplus", "x", "bare", "3", [1,1]],
      ["identplus", "y", "dq",   "aaa", [1,1]],
      ["identplus", "z", "sq",   "bbb", [1,1]],
    ],
    tokens: [
      {kind: "text", line: 2, text: `content
`}
    ]
  }
])})

