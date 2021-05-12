#!/usr/bin/env ts-node

import { ParserContext, parserContext } from '../../context'

import { tokenize } from './tokenize'

import { Part, parse as parse_multipart } from '../multipart/parse'

import { parse_attlist } from '../attlist/parse'

export function parse(ctx: ParserContext, part: Part) {
    let lex = tokenize(ctx, part.payload)
    for (const tok of lex) {
        switch (tok.kind) {
            case "text": case "comment":
            case "entpath_open": {
            }
            case "elem_open": {
                const attlist = parse_attlist(ctx, lex, "elem_close");
            }
            case "pi":
            default:
        }
    }
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
