#!/usr/bin/env ts-node

import tap from 'tap'

import { parserContext } from '../src/context'

import { tokenize } from '../src/lrxml/multipart/tokenize'

// import { createInterface } from 'readline'

const it = (source: string) => {
    let ctx = parserContext({source, config: {}})
    return Array.from(tokenize(ctx)).map((tok) => {
        if (tok.kind === "comment" && tok.innerRange != null) {
            return {kind: tok.kind, "text": ctx.range_text(tok),
                    innerRange: ctx.range_text(tok.innerRange)}
        } else {
            return {kind: tok.kind, "text": ctx.range_text(tok)}
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
    {kind: "bare", text: "bar"},
    {kind: "bare", text: "x"},
    {kind: "equal", text: "="},
    {kind: "bare", text: "3"},
    {kind: "bare", text: "y"},
    {kind: "equal", text: "="},
    {kind: "dq", text: '"8"'},
    {kind: "bare", text: "z"},
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
