import { AnyToken, Range, ParserContext } from '../context'
import { re_join } from '../utils/regexp'

import { re_entity_open, EntPrefixChar, parse_entpath, EntNode } from '../entity/parse'

function re_att(ns: string[], entPrefixChar: EntPrefixChar): RegExp {
  const pat = re_join(
    '(?<ws>[ \\t\\r\\n]+)',
    '(?<comment>--.*?--)',
    '(?<equal>=\\s*)',
    re_join(
      "(?<sq>'[^']*')",
      '(?<dq>"[^"]*")',
      '(?<nest>\\[)', '(?<nestclo>\\])',
      re_entity_open(ns, entPrefixChar),
      '(?<bare>[^\\s\'\"<>\\[\\]/=;]+)'
    )
  )
  return new RegExp(pat, 'sy');
}

export type AttComment = "comment"
export type AttSq = "sq"
export type AttDq = "dq"
export type AttNest = "nest"
export type AttNestClo = "nestclo"
export type AttBare = "bare"
export type AttEqual = "equal"
export type AttIdentPlus = "identplus"

export type AttOther = AttComment | AttSq | AttDq | AttNest |
  AttNestClo | AttBare | AttEqual
export type AttKind =  AttOther | AttIdentPlus

export type TokenContent = {text: string, innerRange?: Range} & AnyToken

type AttTokenOf<T> = {kind: T} & TokenContent

export type AttToken = AttTokenOf<AttComment> |
  AttTokenOf<AttSq> |
  AttTokenOf<AttDq> |
  AttTokenOf<AttNest> |
  AttTokenOf<AttNestClo> |
  AttTokenOf<AttBare> |
  AttTokenOf<AttEqual> |
  {kind: AttIdentPlus, has_three_colon: boolean} & TokenContent |
  EntNode

export function isAttToken(token: {kind: string} & Range)
: token is AttToken {
  switch (token.kind) {
    case "entity":
    case "comment":
    case "bare": case "sq": case "dq":
    case "nest": case "nestclo":
    case 'equal':
    case "identplus":
      return true
    default:
      return false;
  }
}

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
  entity?: string
}

export function extractMatch(am: AttMatch): [AttOther, string] | null {
  if (am.ws != null) {
    return null
  }
  for (const k in am) {
    const val = am[k]
    if (typeof val === "string") {
      return [k as AttOther, val]
    }
  }
  return null
}

export function* tokenize_attlist(ctx: ParserContext, entPrefixChar: EntPrefixChar): Generator<AttToken> {
  let re = ctx.re('attlist' + entPrefixChar, () => re_att(ctx.session.params.namespace, entPrefixChar))
  let match
  while ((match = ctx.match_index(re)) !== null) {
    if (match.groups && (match.groups as AttMatch).entity) {
      ctx.advance(match)
      yield parse_entpath(ctx)
      continue
    }
    let bare, m;
    if (match.groups && (bare = (match.groups as AttMatch).bare)
        && (m = /^(?<three_colon>:::)?(?<ident>[_A-Za-z]\w*(?::\w+)*)$/.exec(bare))
        && m.groups) {
      let mg = m.groups as {three_colon?: string, ident: string}
      yield {
        kind: "identplus", has_three_colon: !!mg.three_colon,
        text: mg.ident,
        line: ctx.line,
        start: match.index,
        end: re.lastIndex
      }
    }
    else {
      const kv = extractMatch(match.groups as AttMatch)
      if (kv) {
        const [kind, text] = kv
        const start = match.index
        const end = re.lastIndex
        if (kind === "comment") {
          const innerRange = {start: start+2, end: end-2}
          yield {kind, text, line: ctx.line, start, end, innerRange}
        }
        else {
          // XXX: ここで bare/sq/dq の時に attstring の tokenize を
          // する手も有る。が、token を受け取る側の変更も大きいので回避
          yield {kind, text, line: ctx.line, start, end}
        }
      }
    }
    ctx.advance(match)
  }
}
