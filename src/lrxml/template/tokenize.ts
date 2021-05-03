#!/usr/bin/env ts-node

import {
    Range, ParserContext, parserContext, parserSession
} from '../../context'

import { Payload } from '../multipart/parse'

import { tokenize_attlist } from '../attlist/tokenize'

import { tokenize_entpath } from '../entity/tokenize'

import { re_join } from '../../utils/regexp'

function re_entity_open(ns: string[]): string {
    const nspat = ns.join("|")
    const entbase = `(?<entity>${nspat})`
    // XXX: lcmsg, special_entities
    return `&(?:${entbase})`
} 

function re_body(ns: string[]): RegExp {
    const nspat = ns.join("|")
    const entOpen = re_entity_open(ns)
    const inTagOpen = re_join(
        `(?<clo>/?)(?<opt>:?)(?<elem>${nspat}(?::\\w+)+)`,
        `\\?(?<pi>${nspat}(?::\\w+)*)`
    )
    const body = re_join(
        entOpen,
        `<${inTagOpen}\\b`
    )
    return new RegExp(`(?<prefix>.*?)${body}`, 'sy')
}

type BodyMatch = {
    [x: string]: string | undefined
    prefix: string
    clo?: string
    opt?: string
    elem?: string
    pi?: string
}

export function* tokenize(outerCtx: ParserContext, payloadList: Payload[]): Generator<any,any,any>
{
    let re = outerCtx.re('body', () => re_body(outerCtx.session.params.namespace))
    for (const tok of payloadList) {
        if (tok.kind === "comment") {
            yield tok
        } else if (tok.kind === "text") {
            let ctx = outerCtx.narrowed(tok)
            let match
            while ((match = ctx.match_index(re))) {
                let bm = match.groups as BodyMatch
                if (bm.prefix.length) {
                    yield {kind: "prefix", value: bm.prefix}
                }
                if (bm.entity != null) {
                    yield {kind: "entpath_open", value: ctx.tab_string(match[0])}
                    
                    yield* tokenize_entpath(ctx)

                }
                else if (bm.elem != null) {
                    yield {kind: "elem_open", value: ctx.tab_string(match[0])}
                    yield* tokenize_attlist(ctx)
                    const end = ctx.match_index(/(?<empty_elem>\/)?>(\r?\n)?/y)
                    if (! end) {
                        const gbg = ctx.match_index(/\S*\s*?\/?>/y)
                        if (gbg) {
                            ctx.throw_error("Garbage before CLO(>)")
                        } else {
                            ctx.throw_error("Missing CLO(>)")
                        }
                    }
                    yield {kind: "elem_close"}
                }
                else if (bm.pi != null) {
                    yield {kind: "pi", value: ctx.tab_string(match[0])}
                }
                else {
                    // never
                }
            }
            
            // XXX: match しなかった残り

        } else {
            // never
        }
    }
}

if (module.id === ".") {
    const { readFileSync } = require('fs')
    const [_cmd, _script, ...args] = process.argv;
    const { parse } = require('../multipart/parse')
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    
    for (const fn of args) {
        let ctx = parserContext(parserSession({
            filename: fn, source: readFileSync(fn, { encoding: "utf-8" }), config: {
                debug: {
                    parser: debugLevel
                }
            }
        }))

        process.stdout.write(JSON.stringify({FILENAME: fn}) + "\n")
        for (const part of parse(ctx)) {
            process.stdout.write(JSON.stringify({part: part.kind, attlist: part.attlist}) + "\n")
            for (const tok of tokenize(ctx, part.payload)) {
                process.stdout.write(JSON.stringify(tok) + "\n")
            }
        }
        process.stdout.write("\n")
    }

}
