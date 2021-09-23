import {
  Range, ParserContext, TokenT
} from '../context'

import { AttToken, isAttToken, AttBare, AttSq, AttDq, AttNest, AttIdentPlus, TokenContent } from '../attlist/tokenize'

import { EntNode } from '../entity/parse'

type BaseTerm<T> = Range & {value: T, comment: string[]}

type QuotedStringTerm = {kind: AttSq | AttDq} & BaseTerm<string>;
type BareStringTerm = {kind: AttBare} & BaseTerm<string>;
type IdentplusTerm = {kind: AttIdentPlus, has_three_colon: boolean} & BaseTerm<string>;
export type StringTerm = BareStringTerm | QuotedStringTerm | IdentplusTerm

type NestedTerm = {kind: AttNest} & BaseTerm<AttItem[]>;


type EntTerm = (EntNode & {comment: string[]})

type Term = IdentplusTerm | StringTerm | NestedTerm | EntTerm

export type Label = IdentplusTerm | NestedTerm

export type AttValue = Term

export type AttItem = {label?: Label} & AttValue
export type AttLabeled = AttLabeledByIdent | AttLabeledNested
export type AttLabeledByIdent = {label: IdentplusTerm} & AttValue
export type AttLabeledNested = {label: NestedTerm} & AttValue
export type AttIdentOnly = IdentplusTerm
export type AttLabelPair = {label: Label} & Label

export function attKindIsQuotedString(kind: string): boolean {
  return kind === "sq" || kind === "dq";
}

export function isLabelTerm(term: Term)
: term is Label {
  return term.kind === "identplus" || term.kind === "nest"
}

// This returns copy of att with filtering att.label
export function attValue(att: AttItem): AttValue {
  let obj: any = {}
  for (const [k, v] of Object.entries(att)) {
    if (k === "label")
      continue
    obj[k] = v
  }
  return obj as AttValue
}

export function parse_attlist<T extends {kind: string} & Range>(
  ctx: ParserContext, lex: Generator<T,any,any>, end_kind: string
): [AttItem[], T] {
  let attList: AttItem[] = []
  let pendingTerm: Term | undefined = undefined
  let had_equal: boolean = false
  let cur
  while (!(cur = lex.next()).done) {
    if (ctx.debug >= 5) {
      console.log('att token: ', cur.value)
    }
    if (cur.value.kind === end_kind) {
      if (pendingTerm) {
        if (had_equal) {
          ctx.throw_error("Lack of attribute value")
        }
        attList.push({ ...pendingTerm })
      }
      return [attList, cur.value];
    }

    if (! isAttToken(cur.value)) {
      ctx.throw_error(`Unknown token from lexter: kind: ${cur.value.kind}`)
    }
    let token: AttToken = cur.value

    let term: Term | undefined
    // Following branches may fill term or continue to next loop.
    switch (token.kind) {
      case "comment": {
        if (pendingTerm) {
          pendingTerm.comment.push(ctx.range_text(token))
        }
        break;
      }
      case "entity": {
        term = term_entity(ctx, lex, token)
        break;
      }
      case "nest": {
        term = term_nest(ctx, lex, token)
        break;
      }
      case "identplus": {
        term = term_identplus(ctx, lex, token)
        break;
      }
      case "bare": case "sq": case "dq": {
        term = term_string(ctx, lex, token)
        break;
      }
      case "equal": {
        if (! pendingTerm) {
          ctx.throw_error("attribute name is not specified before assignment (=)")
        }
        if (had_equal) {
          ctx.throw_error("unexpected = in attribute list")
        }
        if (! isLabelTerm(pendingTerm)) {
          ctx.throw_error("unexpected = in attribute list")
        }
        had_equal = true
        if (ctx.debug >= 3) {
          console.log("found equal for pendingTerm: ", pendingTerm)
        }
        continue; // Important.
      }
      default:
        ctx.NIMPL(token)
    }

    if (term != null) {
      if (ctx.debug >= 3) {
        console.log("term: ", term)
      }
      if (! pendingTerm) {
        pendingTerm = term as Term
        if (ctx.debug >= 3) {
          console.log("-> pendingTerm")
        }
      } else {
        if (had_equal) {
          if (! isLabelTerm(pendingTerm)) {
            ctx.token_error(pendingTerm, `Invalid attribute term before '='`)
          }
          const att: AttItem = {label: pendingTerm, ...term};
          attList.push(att)
          if (ctx.debug >= 3) {
            console.log("Pushed to attList with label: ", att)
          }
          pendingTerm = undefined
          had_equal = false
        }
        else {
          attList.push({...pendingTerm})
          if (ctx.debug >= 3) {
            console.log("Pushed to attlist as a standalone term: ", pendingTerm)
          }
          pendingTerm = term as Term
        }
      }
    }
  }
  
  ctx.NEVER();
}

function term_nest<U extends TokenT<string>>(
  ctx: ParserContext, lex: Generator<U,any,any>,
  token: {kind: "nest"} & TokenContent
): NestedTerm {
  const [value, end] = parse_attlist(ctx, lex, "nestclo")
  return {
    kind: "nest", value, start: token.start, end: end.end, comment: []
  }
}

function term_entity<U extends TokenT<string>>(
  ctx: ParserContext, lex: Generator<U,any,any>,
  token: EntNode
): EntTerm {
  // XXX: Evil cast
  return {comment: [], ...(token as unknown as EntNode)}
}

function term_string<U extends TokenT<string>>(
  ctx: ParserContext, lex: Generator<U,any,any>,
  token: {kind: "bare" | "sq" | "dq"} & TokenContent
): StringTerm {
  let value = attKindIsQuotedString(token.kind) ?
    ctx.range_text(token, 1, -1) : ctx.range_text(token);
  return {
    kind: token.kind, value,
    start: token.start, end: token.end,
    comment: []
  }
}

function term_identplus<U extends TokenT<string>>(
  ctx: ParserContext, lex: Generator<U,any,any>,
  token: {kind: "identplus", has_three_colon: boolean} & TokenContent
): IdentplusTerm {
  let value = ctx.range_text(token)
  return {
    kind: token.kind, value,
    has_three_colon: token.has_three_colon,
    start: token.start, end: token.end,
    comment: []
  }
}
