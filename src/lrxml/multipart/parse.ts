#!/usr/bin/env ts-node

import {
    Range, ParserContext, parserContext, parserSession
} from '../../context'

import { tokenize } from './tokenize'

import { AttItem, parse_attlist} from '../attlist/parse'

export type Payload = {kind: "text" | "comment", data: string} & Range

export type PartBase = {
    filename?: string
    lineno: number
    namespace: string
    kind: string
    subkind: string[]
    attlist: AttItem[]
    payload: Payload[]
}

export type Part = PartBase & Range

export function parse(ctx: ParserContext): Part[] {
    let partList: [number, PartBase][] = []
    let lex = tokenize(ctx)
    for (const tok of lex) {
        switch (tok.kind) {
            case "text": case "comment": {
                push_payload(ctx, partList, tok.kind, tok)
                break;
            }
            case "decl_begin": {
                let [namespace, kind, ...subkind] = tok.detail.split(/:/);
                const attlist = parse_attlist(ctx, lex, "decl_end")
                let part: PartBase = {
                    filename: ctx.session.filename,
                    lineno: tok.lineNo,
                    namespace, kind, subkind, attlist, payload: []
                }
                partList.push([tok.start, part])
                break;
            }
            default: {
                ctx.throw_error(`Unknown syntax error: kind=${tok.kind}`);
            }
        }
    }
    return add_range<PartBase>(partList, ctx.end)
}

function add_range<T>(list: [number, T][], end: number): (T & Range)[] {
    let result: (T & Range)[] = []
    let [cur, ...rest] = list
    for (const nx of rest) {
        const range = {start: cur[0], end: nx[0]}
        result.push({...range, ...cur[1]})
        cur = nx
    }
    if (cur != null) {
        const range = {start: cur[0], end}
        result.push({...range, ...cur[1]})
    }
    return result
}

function push_payload(ctx: ParserContext, partList: [number, PartBase][], kind: "text" | "comment", range: Range) {
    if (! partList.length) {
        // May fill default kind/namespace
        partList.push([0,{
            filename: ctx.session.filename,
            lineno: 1,
            kind: "", namespace: "", subkind: [], attlist: [], payload: []
        }])
    }
    partList[partList.length-1][1].payload.push({
        kind, data: ctx.range_text(range), ...range
    })
}

// console.log(this)

if (module.id === ".") {
    const { readFileSync } = require('fs')
    const [_cmd, _script, fn, ...args] = process.argv;
    
    let ctx = parserContext(parserSession({
        filename: fn, source: readFileSync(fn, {encoding: "utf-8"}), config: {
        }
    }))
    
    for (const part of parse(ctx)) {
        console.log(part)
    }
}
