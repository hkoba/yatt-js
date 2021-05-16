import { Range, ParserContext } from '../../context'
import { re_join } from '../../utils/regexp'

function re_att(ns: string[]): RegExp {
    const pat = re_join(
        '(?<ws>[ \\t\\r\\n]+)',
        '(?<comment>--.*?--)',
        '(?<equal>=\\s*)',
        re_att_literal(ns)
    )
    return new RegExp(pat, 'sy');
}

function re_att_literal(ns: string[]): string {
    return re_join(
        "(?<sq>'[^']*')",
        '(?<dq>"[^"]*")',
        '(?<nest>\\[)', '(?<nestclo>\\])',
        // pat_entOpen(ns), // XXX: 要らんのでは ← 細かいエラー通知のためか
        '(?<bare>[^\\s\'\"<>\\[\\]/=;]+)'
    )
}

export type AttComment = "comment"
export type AttSq = "sq"
export type AttDq = "dq"
export type AttNest = "nest"
export type AttNestClo = "nestclo"
export type AttBare = "bare"
export type AttEqual = "equal"

export type AttKind = AttComment | AttSq | AttDq | AttNest |
    AttNestClo | AttBare | AttEqual

export type AttToken = {kind: AttKind, text: string, innerRange?: Range} & Range

type AttMatch = {
    [x: string]: string | undefined
    ws?: string
    comment?: string
    sq?: string
    dq?: string
    nest?: string
    nestclo?: string
    bare?: string
    equal?: string
}

export function extractMatch(am: AttMatch): [AttKind, string] | null {
    if (am.ws != null) {
        return null
    }
    for (const k in am) {
        const val = am[k]
        if (typeof val === "string") {
            return [k as AttKind, val]
        }
    }
    return null
}

export function* tokenize_attlist(ctx: ParserContext): Generator<AttToken> {
    let re = ctx.re('attlist', () => re_att(ctx.session.params.namespace))
    let match
    while ((match = ctx.match_index(re)) !== null) {
        const kv = extractMatch(match.groups as AttMatch)
        if (kv) {
            const [key, val] = kv
            yield {kind: key
                   , text: val
                   , start: match.index
                   , end: re.lastIndex}
        }
        ctx.advance(match)
    }
}
