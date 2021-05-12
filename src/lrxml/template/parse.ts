#!/usr/bin/env ts-node

import { Range, ParserContext, parserContext } from '../../context'

import { tokenize } from './tokenize'

import { Part, parse as parse_multipart } from '../multipart/parse'

import { parse_attlist, AttItem } from '../attlist/parse'

type Element = Range & {
    kind: "element"
    path: string[]
    attlist: AttItem[]
    // body
    // containedRange
}

type Text = Range & {kind: "text"}
type Comment = Range & {kind: "comment"}
type PI = Range & {kind: "pi"}

type Node = Text | Comment | PI | Element ; // Entity

export function parse(ctx: ParserContext, part: Part, sink?: Node[]): Node[] {
    let result: Node[] = sink ?? []

    let lex = tokenize(ctx, part.payload)
    for (const tok of lex) {
        switch (tok.kind) {
            case "text": case "comment": case "pi": {
                result.push({kind: tok.kind, ...(tok as Range)})
                break;
            }
            case "entpath_open": {
                // parse_entpath(ctx, lex)
                break;
            }
            case "tag_open": {
                const attlist = parse_attlist(ctx, lex, "tag_close");
                
                break;
            }
            default: {
                ctx.NEVER()
            }
        }
    }
    
    return result
}

if (module.id === ".") {
    const { readFileSync } = require('fs')
    const [_cmd, _script, ...args] = process.argv;
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    
    for (const fn of args) {
        let ctx = parserContext({
            filename: fn, source: readFileSync(fn, { encoding: "utf-8" }), config: {
                debug: {
                    parser: debugLevel
                }
            }
        })
        
        for (const part of parse_multipart(ctx)) {
            parse(ctx, part)
        }
    }
}
