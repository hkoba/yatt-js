#!/usr/bin/env ts-node

import { Range, ParserContext, parserContext, ParserSession } from '../context'

import { re_join } from '../utils/regexp'

export type EntPrefixChar = '&' | '%'

// `(?<entity>(?:${nspat}))(?=:|(?<lcmsg>(?<msgopn>(?:\\#\\w+)?\\[{2,})|(?<msgsep>\\|{2,})|(?<msgclo>\\]{2,})))`

export function re_entity_open(ns: string[], entPrefixChar: EntPrefixChar): string {
    const nspat = ns.join("|")
    let entbase = `(?<entity>${nspat})`
    return `${entPrefixChar}(?:${entbase})`
}

export function re_lcmsg(): string {
    const lcmsg = re_join(
	'(?<msgopn>(?:\\#\\w+)?\\[{2,})',
	'(?<msgsep>\\|{2,})',
	'(?<msgclo>\\]{2,})'
    );
    return `(?<lcmsg>${lcmsg})`
}

export type EntPrefixMatch = {
    entity?: string
    lcmsg?: string
    msgopn?: string
    msgsep?: string
    msgclo?: string
}

export type LCMsg = Range & {kind: "lcmsg_sep" | "lcmsg_close"} |
    Range & {kind: "lcmsg_open", namespace: string[]}

const open_head: {[k: string]: "call" | "array" | "hash"} =
    {"(": "call",   "[": "array", "{": "hash"}
const open_rest: {[k: string]: "invoke" | "aref" | "href"} =
    {"(": "invoke", "[": "aref",  "{": "href"};
const close_ch: {[k in keyof typeof open_head]: RegExp}  =
    {"(": /\)/y,    "[": /\]/y,   "{": /\}/y}

type ValueOf<T> = T[keyof T]

type OpenChars = keyof typeof open_head
type EntPathOpenKind = ValueOf<typeof open_head> | ValueOf<typeof open_rest>;

export type EntText = {kind: "text" | "expr",
                       text: string, is_paren: boolean,
                       innerRange: Range} & Range

export type EntPath = EntPathItem[]

export type EntTerm = EntText | EntPath

export type EntPathItem = {kind: "var" | "prop", name: string} & Range |
    {kind: "call" | "invoke", name: string, elements: EntTerm[]} & Range |
    {kind: "array" | "aref" | "hash" | "href", elements: EntTerm[]} & Range

export type EntNode = {kind: "entity", path: EntPath} & Range

function re_entpath_open() {
    const str = re_join(
        ':(?<var>\\w+)(?<call_open>[(])?',
        '(?<array_open>[[])',
        '(?<dict_open>[{])'
    )
    return new RegExp(str, 'y')
}

function re_enttext(other: string[]) {
    const head = '\\[\\](){}\\ \\t\\n,;';
    const rest = head + ':';
    const re_str = re_join(
        `[^${head}][^${rest}]*`, '(?<paren>[(])'
        , ...other
    )
    return new RegExp(re_str, 'y')
}

type EntPathMatch = {
    var?: string
    call_open?: string
    array_open?: string
    dict_open?: string
}

export function parse_entpath(ctx: ParserContext): EntNode {

    const start = ctx.index
    const path = parse_pipeline(ctx);

    const end = ctx.global_match(/;/g);
    if (! end) {
        ctx.throw_error("entity is not terminated by ;")
    }
    ctx.tab(end)
    return {kind: "entity", start, end: ctx.index, path}
}

function parse_pipeline(ctx: ParserContext): EntPath {
    const re_open = ctx.re('entpath_open', () => re_entpath_open())
    let pipe: EntPath = []

    let match: RegExpExecArray | null
    while ((match = ctx.match_index(re_open)) != null) {
        let mg = match.groups as EntPathMatch
        const is_open = _is_open(mg)
        const is_head: boolean = pipe.length == 0
        if (! is_open) {
            pipe.push({kind: (is_head ? 'var' : 'prop')
                       , name: mg.var as string
                       , ...ctx.tab_match(match)})
        }
        else {
            const start = ctx.index // === match.index
            ctx.tab_match(match)
            const kind: EntPathOpenKind =
                (is_head ? open_head : open_rest)[is_open]
            const elements = parse_entgroup(ctx, close_ch[is_open])
            const end = ctx.index
            if (kind === "call" || kind === "invoke") {
                pipe.push({kind, name: mg.var as string, elements, start, end})
            } else {
                pipe.push({kind, elements, start, end})
            }

        }
    }
    return pipe
}

function _is_open(mg: EntPathMatch): OpenChars | undefined {
    return (mg.call_open ?? mg.array_open ?? mg.dict_open) as OpenChars | undefined
}

function parse_entgroup(ctx: ParserContext, close: RegExp): EntTerm[] {
    let elements: EntTerm[] = [];
    let lastIndex = ctx.index
    while (! ctx.empty()) {
        const term: EntTerm | undefined = parse_entterm(ctx)
        if (term) {
            elements.push(term)
        }
        const is_closed = ctx.match_index(close)
        if (is_closed) {
            ctx.tab_match(is_closed)
            break;
        }
        if (ctx.index == lastIndex) {
            ctx.throw_error("Syntax error in entity");
        }
        lastIndex = ctx.index
    }
    return elements
}

function parse_entterm(ctx: ParserContext): EntTerm | undefined {
    const re_text = ctx.re('entpath_text', () => re_enttext([]))
    const re_text_cont = ctx.re('entpath_text_cont', () =>
                                re_enttext(['(?=(?<close>[\\])};,]))']))
    let match;
    // For backward compat
    if (match = ctx.match_index(/,/y)) {
        // yield empty string
        let range = {start: match.index, end: match.index}
        let term: EntText = {kind: "text", text: "",
                                 ...range, is_paren: false, innerRange: range}
        ctx.tab_match(match);
        return term;
    }
    if (ctx.match_index(/[\]\)\};]/y)) {
        // lookahead, end of term
        return;
    }
    let term: EntText | EntPathItem[] | undefined
    if (match = ctx.match_index(re_text)) {
        const start = ctx.index
        const is_paren = match.groups && match.groups.paren ? true : false;
        do {
            if (match.groups && match.groups.close)
                break
            ctx.tab_match(match)
            if (match.groups && match.groups.paren) {
                parse_entparen(ctx)
            }
        } while (match = ctx.match_index(re_text_cont))
        const end = ctx.index
        const range = {start, end};
        const innerRange = is_paren ? {start: range.start+1, end: range.end-1} : range
        const rawText = ctx.range_text(innerRange)
        const kind = /^=/.test(rawText) ? "expr" : "text"
        const text = kind === "expr" ? rawText.substring(1) : rawText
        term = {kind, text, ...range, is_paren, innerRange}
    } else {
        term = parse_pipeline(ctx)
    }
    if (match = ctx.match_index(/[,:]/y)) {
        ctx.tab_match(match)
    }
    return term;
}

function parse_entparen(ctx: ParserContext): void {
    let match
    while (match = ctx.match_index(/[^()]+|[()]/y)) {
        ctx.tab_match(match)
        switch (match[0]) {
            case '(': {
                parse_entparen(ctx)
                continue;
            }
            case ')': {
                return;
            }
            default: {
                continue
            }
        }
    }
}

modulino: if (module.id === ".") {
    for (const str of process.argv.slice(2)) {
        let ctx = parserContext({
            source: str, config: {}
        })

        const node = parse_entpath(ctx)
        console.dir(node, {depth: null, colors: true})
    }
}
