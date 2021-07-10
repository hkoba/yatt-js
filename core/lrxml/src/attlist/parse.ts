import {
  Range, ParserContext
} from '../context'

import { AttBare, AttSq, AttDq, AttNest } from '../attlist/tokenize'

import { EntNode } from '../entity/parse'

type BaseTerm<T> = Range & {value: T, comment: string[]}

type QuotedStringTerm = {kind: AttSq | AttDq} & BaseTerm<string>;
type BareStringTerm = {kind: AttBare} & BaseTerm<string>;
type StringTerm = BareStringTerm | QuotedStringTerm
type NestedTerm = {kind: AttNest} & BaseTerm<AttItem[]>;

type Term = StringTerm | NestedTerm |
  (EntNode & {comment: string[]})

export type AttValue = Term

export type AttItem = {label?: Term} & AttValue
export type AttLabeled = {label: Term} & AttValue
export type AttBareLabeled = {label: BareStringTerm} & AttValue
export type AttBareword = BareStringTerm

export function hasStringValue(att: AttItem)
: att is ({label?: Term} & StringTerm) {
  return att.kind === "bare" || att.kind === "sq" || att.kind === "dq";
}

export function hasQuotedStringValue(att: AttItem)
: att is ({label?: Term} & StringTerm) {
  return attKindIsQuotedString(att.kind);
}

function attKindIsQuotedString(kind: string): boolean {
  return kind === "sq" || kind === "dq";
}

export function isBareword(att: AttItem)
: att is AttBareword {
  return !hasLabel(att) && att.kind === 'bare'
}

export function hasNestedValue(att: AttItem)
: att is ({label?: Term} & NestedTerm) {
  return att.kind === 'nest'
}

export function hasLabel(att: AttItem): att is AttLabeled {
  return att.label !== undefined
}

export function isBareLabeledAtt(att: AttItem): att is AttBareLabeled {
  return hasLabel(att) && att.label.kind === 'bare'
}

export function parse_attlist<T extends {kind: string} & Range>(ctx: ParserContext, lex: Generator<T,any,any>
                                                                , end_kind: string): [AttItem[], T] {
  let attList: AttItem[] = []
  let pendingTerm: Term | undefined = undefined
  let had_equal: boolean = false
  let cur
  while (!(cur = lex.next()).done) {
    if (ctx.debug >= 2) {
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
    switch (cur.value.kind) {
      case "comment": {
        if (pendingTerm) {
          pendingTerm.comment.push(ctx.range_text(cur.value))
        }
        break
      }
      case "entity":
      case "nest":
      case "bare": case "sq": case "dq": {
        const start = cur.value.start
        let term: Term;
        if (cur.value.kind === "nest") {
          const [value, end] = parse_attlist(ctx, lex, "nestclo")
          term = {
            kind: "nest", value, start, end: end.end, comment: []
          }
        }
        else if (cur.value.kind === "entity") {
          // XXX: Evil cast
          term = {comment: [], ...(cur.value as unknown as EntNode)}
        }
        else {
          // XXX: parse (type, declflag, default)
          // XXX: parse entity
          let value = attKindIsQuotedString(cur.value.kind) ?
            ctx.range_text(cur.value, 1, -1) : ctx.range_text(cur.value);
          term = {
            kind: cur.value.kind, value,
            start, end: cur.value.end,
            comment: []
          }
        }

        if (ctx.debug) {
          console.log("term: ", term)
        }
        if (! pendingTerm) {
          pendingTerm = term as Term
          if (ctx.debug) {
            console.log("-> pendingTerm")
          }
        } else {
          if (had_equal) {
            const att = {label: pendingTerm, ...term};
            attList.push(att)
            if (ctx.debug) {
              console.log("Pushed to attList with label: ", att)
            }
            pendingTerm = undefined
            had_equal = false
          } else {
            attList.push({...pendingTerm})
            if (ctx.debug) {
              console.log("Pushed to attlist as a standalone term: ", pendingTerm)
            }
            pendingTerm = term as Term
          }
        }
        break;
      }
      case "equal": {
        if (! pendingTerm) {
          ctx.throw_error("attribute name is not specified before assignment (=)")
        }
        if (had_equal) {
          ctx.throw_error("unexpected = in attribute list")
        }
        if (pendingTerm.kind !== "bare" && pendingTerm.kind !== "nest") {
          ctx.throw_error("unexpected = in attribute list")
        }
        had_equal = true
        if (ctx.debug) {
          console.log("found equal for pendingTerm: ", pendingTerm)
        }
        break
      }
      default: {
        ctx.NIMPL(cur.value)
      }
    }
  }
  
  ctx.NEVER();
}
