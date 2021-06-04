#!/usr/bin/env ts-node

import tap from 'tap'

import { parserContext } from '../src/context'

import { parse } from '../src/multipart/parse'
import { tokenize } from '../src/template/tokenize'

// import { createInterface } from 'readline'

const it = (source: string) => {
    let ctx = parserContext({ source, config: {} })
    return Array.from(parse(ctx)).map((part) => {
        return {
            part: part.kind, attlist: part.attlist.map((att) => ctx.range_text(att)),
            tokens: Array.from(tokenize(ctx, part.payload)).map((tok) => {
                if (tok.kind === "comment" && tok.innerRange != null) {
                    return {
                        kind: tok.kind, "text": ctx.range_text(tok),
                        innerRange: ctx.range_text(tok.innerRange)
                    }
                } else {
                    return { kind: tok.kind, "text": ctx.range_text(tok) }
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
