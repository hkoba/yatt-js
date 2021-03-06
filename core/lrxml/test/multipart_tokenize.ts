#!/usr/bin/env ts-node

import tap from 'tap'

import { range_text, tokenize_multipart } from '../src/'

const it = (source: string) => {
  let lex = tokenize_multipart(source, {})
  const ary = Array.from(lex); // For inspector.
  return ary.map((tok) => {
    if (tok.kind === "comment" && tok.innerRange != null) {
      return {kind: tok.kind, "text": range_text(source, tok),
              innerRange: range_text(source, tok.innerRange)}
    } else {
      return {kind: tok.kind, "text": range_text(source, tok)}
    }
  });
}

tap.same(it('')
         , []
         , "Empty results empty")

tap.same(it(`<!yatt:foo>
AEIOU
`), [
  {kind: "decl_begin", text: "<!yatt:foo"},
  {kind: "decl_end", text: ">\n"},
  {kind: "text", text: "AEIOU\n"}
])

tap.same(it(`<!yatt:foo bar x=3 y="8" z='9'>
`), [
  {kind: "decl_begin", text: "<!yatt:foo"},
  {kind: "identplus", text: "bar"},
  {kind: "identplus", text: "x"},
  {kind: "equal", text: "="},
  {kind: "bare", text: "3"},
  {kind: "identplus", text: "y"},
  {kind: "equal", text: "="},
  {kind: "dq", text: '"8"'},
  {kind: "identplus", text: "z"},
  {kind: "equal", text: "="},
  {kind: "sq", text: "'9'"},
  {kind: "decl_end", text: ">\n"},
])

tap.same(it(`<!--#yatt

<!yatt:foo>

<!yatt:bar>

#-->`), [
  {kind: "comment", text: `<!--#yatt

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
  {kind: "decl_begin", text: "<!yatt:widget"},
  {kind: "identplus", text: "foo"},
  {kind: "decl_end", text: ">\n"},
  {kind: "text", text: "foooooooooooo\nooooooooooooo\nooooooooooooo\n"},
  {kind: "comment", text: "<!--#yatt comment text #-->"
   , innerRange: ` comment text `},
  {kind: "text", text: "\n"},
  {kind: "decl_begin", text: "<!yatt:widget"},
  {kind: "identplus", text: "bar"},
  {kind: "decl_end", text: ">\n"},
  {kind: "text", text: "bar\n"},
  {kind: "comment", text: `<!--#yatt
Another comment text
....................
#-->`, innerRange: `
Another comment text
....................
`},
  {kind: "text", text: "\n"},
])
