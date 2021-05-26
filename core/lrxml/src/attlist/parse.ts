import {
    Range, ParserContext
} from '../context'

import { AttBare, AttSq, AttDq, AttNest } from '../attlist/tokenize'

type Term = ({kind: AttBare | AttSq | AttDq, value: string, comment: string[]}
             |
             {kind: AttNest, value: AttItem[], comment: string[]}
            ) & Range
export type AttItem = {label?: Term} & Term

export function parse_attlist<T extends {kind: string} & Range>(ctx: ParserContext, lex: Generator<T,any,any>
                                 , end_kind: string): [AttItem[], T] {
    let attList: AttItem[] = []
    let pendingTerm: Term | undefined = undefined
    let had_equal: boolean = false
    let cur
    while (!(cur = lex.next()).done) {
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
            case "nest": {
                ctx.throw_error("Not yet implemented")
                break
            }

            case "bare": case "sq": case "dq": {
                const term = {
                    kind: cur.value.kind, value: ctx.range_text(cur.value),
                    start: cur.value.start, end: cur.value.end,
                    comment: []
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
                        attList.push({label: pendingTerm, ...pendingTerm})
                        if (ctx.debug) {
                            console.log("Pushed to attList with label: ", pendingTerm)
                        }
                        pendingTerm = undefined
                        had_equal = false
                    } else {
                        attList.push({...pendingTerm})
                        if (ctx.debug) {
                            console.log("Pushed to attlist as a standalone term")
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
                break
            }
            default:
        }
    }
    
    ctx.NEVER();
}
