#!/usr/bin/env ts-node

import {
    Range, ParserContext, parserContext
} from '../../context'

import { Payload } from '../multipart/parse'

import { tokenize_attlist, AttToken } from '../attlist/tokenize'

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
        `(?<clo>/?)(?<opt>:?)(?<tag>${nspat}(?::\\w+)+)`,
        `\\?(?<pi>${nspat}(?::\\w+)*)`
    )
    const body = re_join(
        entOpen,
        `<${inTagOpen}\\b`
    )
    return new RegExp(body, 'g')
}

type BodyMatch = {
    [x: string]: string | undefined
    prefix: string
    clo?: string
    opt?: string
    tag?: string
    pi?: string
}

type Text = Range & {kind: "text"}
type Comment = Range & {kind: "comment", innerRange: Range}
type PI = Range & {kind: "pi", innerRange: Range}

type TagOpen  = Range & {kind: "tag_open", name: string, is_option: boolean}
type TagClose = Range & {kind: "tag_close", is_empty_element: boolean}

// Entity
type EntOpen = Range & {kind: "entpath_open", name: string}
// XXX: entpath

export type Token = Text | Comment | PI |
    TagOpen | AttToken | TagClose | EntOpen; // Entity

export function* tokenize(outerCtx: ParserContext, payloadList: Payload[]): Generator<Token,any,any>
{
    let re = outerCtx.re('body', () => re_body(outerCtx.session.params.namespace))
    for (const tok of payloadList) {
        if (tok.kind === "comment") {
            yield tok
        } else if (tok.kind === "text") {
            let ctx = outerCtx.narrowed(tok)
            let globalMatch
            while ((globalMatch = ctx.global_match(re))) {
                const prefix = ctx.tab_match_prefix(globalMatch)
                if (prefix != null) {
                    yield { kind: "text", ...prefix }
                }
                
                let bm = globalMatch.match.groups as BodyMatch
                if (bm.entity != null) {
                    const range = ctx.tab(globalMatch)
                    yield {kind: "entpath_open", name: ctx.range_text(range), ...range}
                    
                    // 
                    yield* tokenize_entpath(ctx)

                }
                else if (bm.tag != null) {
                    
                    const range = ctx.tab(globalMatch)
                    yield {kind: "tag_open",
                           is_option: bm.opt != null,
                           name: ctx.range_text(range), ...range}
                    yield* tokenize_attlist(ctx)
                    const end = ctx.match_index(/(?<empty_tag>\/)?>(\r?\n)?/y)
                    if (end == null) {
                        const gbg = ctx.match_index(/\S*\s*?\/?>/y)
                        if (gbg) {
                            ctx.throw_error("Garbage before CLO(>)")
                        } else {
                            ctx.throw_error("Missing CLO(>)")
                        }
                        return; // NOT REACHED
                    }
                    yield {kind: "tag_close",
                           is_empty_element: end.groups && end.groups.empty_tag != null ? true : false,
                           ...ctx.tab_string(end[0])}
                }
                else if (bm.pi != null) {
                    const range = ctx.tab(globalMatch)
                    const end = ctx.match_index(/\?>/y)
                    if (end == null) {
                        ctx.throw_error("Missing ?>")
                        return; // NOT REACHED
                    }
                    const innerRange = {start: range.end, end: end.index}
                    yield {kind: "pi", innerRange, ...range}
                }
                else {
                    // never
                }
            }
            
            const rest = ctx.rest_range()
            if (rest != null) {
                yield {kind: "text", ...rest}
            }

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
        let ctx = parserContext({
            filename: fn, source: readFileSync(fn, { encoding: "utf-8" }), config: {
                debug: {
                    parser: debugLevel
                }
            }
        })

        process.stdout.write(JSON.stringify({FILENAME: fn}) + "\n")
        for (const part of parse(ctx)) {
            process.stdout.write(JSON.stringify({part: part.kind, attlist: part.attlist}) + "\n")
            for (const tok of tokenize(ctx, part.payload)) {
                const text = ctx.range_text(tok)
                process.stdout.write(JSON.stringify([tok, text]) + "\n")
            }
        }
        process.stdout.write("\n")
    }

}
