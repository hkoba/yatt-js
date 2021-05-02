#!/usr/bin/env ts-node

import {
    Range, ParserContext, parserContext, parserSession
} from '../../context'

import { Payload } from '../multipart/parse'

import { tokenize_attlist } from '../attlist/tokenize'

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
    return new RegExp(`^(?<prefix>.*?)${body}`, 's')
}

type BodyMatch = {
    [x: string]: string | undefined
    prefix: string
    clo?: string
    opt?: string
    elem?: string
    pi?: string
}

export function tokenize(outerCtx: ParserContext, payloadList: Payload[]) {
    let re = outerCtx.re('body', () => re_body(outerCtx.session.params.namespace))
    for (const tok of payloadList) {
        if (tok.kind === "comment") {
            console.log("comment", tok)
        } else if (tok.kind === "text") {
            let ctx = outerCtx.narrowed(tok)
            let match
            while ((match = ctx.match_index(re))) {
                let bm = match.groups as BodyMatch
                if (bm.prefix.length) {
                    console.log("prefix", bm.prefix)
                }
                if (bm.entity != null) {
                    console.log("entity", bm)
                    ctx.tab_string(match[0])
                }
                else if (bm.elem != null) {
                    console.log("elem_open", bm)
                    ctx.tab_string(match[0])
                    for (const att of tokenize_attlist(ctx)) {
                        console.log("att tok", att)
                    }
                    const end = ctx.match_index(/^(?<empty_elem>\/)?>(\r?\n)?/)
                    if (! end) {
                        const gbg = ctx.match_index(/^\S*\s*?\/?>/)
                        if (gbg) {
                            ctx.throw_error("Garbage before CLO(>)")
                        } else {
                            ctx.throw_error("Missing CLO(>)")
                        }
                    }
                    console.log("elem_close", end)
                }
                else if (bm.pi != null) {
                    console.log("pi", bm)
                    ctx.tab_string(match[0])
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
    const [_cmd, _script, fn, ...args] = process.argv;
    const { parse } = require('../multipart/parse')
    
    let ctx = parserContext(parserSession({
        filename: fn, source: readFileSync(fn, {encoding: "utf-8"}), config: {
            debug: {
                parser: 2
            }
        }
    }))
    
    for (const part of parse(ctx)) {
        tokenize(ctx, part.payload)
    }
}
