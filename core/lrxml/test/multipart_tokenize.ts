#!/usr/bin/env -S deno run -A

import tap from 'tap'

import { range_text, tokenize_multipart } from '../src/'

const it = (source: string) => {
  let lex = tokenize_multipart(source, {})
  const ary = Array.from(lex); // For inspector.
  return ary.map((tok) => {
    if (tok.kind === "comment" && tok.innerRange != null) {
      return {kind: tok.kind, "text": range_text(source, tok),
              line: tok.line,
              innerRange: range_text(source, tok.innerRange)}
    } else {
      return {
        kind: tok.kind,
        line: tok.line,
        "text": range_text(source, tok)
      }
    }
  });
}

tap.same(it('')
         , []
         , "Empty results empty")

tap.same(it(`<!yatt:foo>
AEIOU
`), [
  {kind: "decl_begin", text: "<!yatt:foo", line: 1},
  {kind: "decl_end", text: ">\n", line: 1},
  {kind: "text", text: "AEIOU\n", line: 2}
])

tap.same(it(`<!yatt:foo bar x=3 y="8" z='9'>
`), [
  {kind: "decl_begin", text: "<!yatt:foo", line: 1},
  {kind: "identplus", text: "bar", line: 1},
  {kind: "identplus", text: "x", line: 1},
  {kind: "equal", text: "=", line: 1},
  {kind: "bare", text: "3", line: 1},
  {kind: "identplus", text: "y", line: 1},
  {kind: "equal", text: "=", line: 1},
  {kind: "dq", text: '"8"', line: 1},
  {kind: "identplus", text: "z", line: 1},
  {kind: "equal", text: "=", line: 1},
  {kind: "sq", text: "'9'", line: 1},
  {kind: "decl_end", text: ">\n", line: 1},
])

tap.same(it(`<!--#yatt

<!yatt:foo>

<!yatt:bar>

#-->`), [
  {kind: "comment", line: 1, text: `<!--#yatt

<!yatt:foo>

<!yatt:bar>

#-->`, innerRange: `

<!yatt:foo>

<!yatt:bar>

`}
])

tap.same(it(`<!yatt:widget foo>
foooooooooooo
ooooooooooooo
ooooooooooooo
<!--#yatt comment text #-->
<!yatt:widget bar>
bar
<!--#yatt
Another comment text
....................
#-->
`), [
  {kind: "decl_begin", text: "<!yatt:widget", line: 1},
  {kind: "identplus", text: "foo", line: 1},
  {kind: "decl_end", text: ">\n", line: 1},
  {kind: "text", text: "foooooooooooo\nooooooooooooo\nooooooooooooo\n", line: 2},
  {kind: "comment", text: "<!--#yatt comment text #-->"
   , innerRange: ` comment text `, line: 5},
  {kind: "text", text: "\n", line: 5},
  {kind: "decl_begin", text: "<!yatt:widget", line: 6},
  {kind: "identplus", text: "bar", line: 6},
  {kind: "decl_end", text: ">\n", line: 6},
  {kind: "text", text: "bar\n", line: 7},
  {kind: "comment", text: `<!--#yatt
Another comment text
....................
#-->`, innerRange: `
Another comment text
....................
`, line: 8},
  {kind: "text", text: "\n", line: 11},
])
