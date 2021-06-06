#!/usr/bin/env ts-node

import {YattConfig} from '../yatt-config'
import { Range, ParserContext, parserContext } from '../context'

import { tokenize, Token } from './tokenize'

import { Part, parse_multipart } from '../multipart/parse'

import { parse_attlist, AttItem } from '../attlist/parse'

import { EntNode } from '../entity/parse'

type Element = Range & {
    kind: "element"
    path: string[]
    attlist: AttItem[]
    children?: Node[]
    // containedRange
}

type Text = Range & {kind: "text"}
type Comment = Range & {kind: "comment"}
type PI = Range & {kind: "pi"}

export type Node = Text | Comment | PI | Element | EntNode

export function parse_template(ctx: ParserContext, part: Part): Node[] {
    let lex = tokenize(ctx, part.payload)
    let nodes = parse_tokens(ctx, part, lex, []);
    return nodes
}

function parse_tokens(ctx: ParserContext, part: Part
                      , lex: Generator<Token, any, any>, sink: Node[], close?: string) {

    for (const tok of lex) {
        ctx.index = tok.start
        switch (tok.kind) {
            case "text": case "comment": case "pi": {
                sink.push({kind: tok.kind, ...(tok as Range)})
                break;
            }
            case "entpath_open": break;
            case "entity": {
                sink.push(tok)
                break;
            }
            case "tag_open": {
                if (tok.is_close) {
                    if (close == null) {
                        ctx.throw_error(`close tag without open: ${tok.name}`)
                    }
                    if (tok.name !== close) {
                        ctx.throw_error(`tag mismatch! EXPECT ${close}, GOT ${tok.name} at index=${ctx.index}`)
                    }
                    const nx = lex.next().value
                    if (!nx || nx.kind !== 'tag_close')
                        ctx.throw_error(`tag is not closed by '>'`)
                    return sink
                }
                const [attlist, end] = parse_attlist(ctx, lex, "tag_close");
                if (end.kind !== "tag_close") {
                    ctx.NEVER()
                }
                let elem: Element = {
                    kind: "element", path: tok.name.split(/:/), attlist,
                    start: tok.start, end: tok.end
                }
                sink.push(elem)
                if (! end.is_empty_element) {
                    let body = elem.children = []
                    parse_tokens(ctx, part, lex, body, tok.name)
                }
                break;
            }
            default: {
                console.log("INVALID token:", tok)
                ctx.NEVER()
            }
        }
    }
    
    return sink
}

if (module.id === ".") {
    const { readFileSync } = require('fs')
    const [_cmd, _script, ...args] = process.argv;

    const { parse_long_options } = require("../utils/long-options")
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config: YattConfig = {
        debug: { parser: debugLevel }
    }
    parse_long_options(args, {target: config})
    
    for (const fn of args) {
        let ctx = parserContext({
            filename: fn, source: readFileSync(fn, { encoding: "utf-8" }), config
        })
        
        for (const part of parse_multipart(ctx)) {
            console.dir(part, {colors: true, depth: null})
            console.dir(parse_template(ctx, part), {colors: true, depth: null})
        }
    }
}
