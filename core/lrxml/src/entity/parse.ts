#!/usr/bin/env ts-node

import { Range, ParserContext } from '../context'

// tokenize_entpath should provide the type

export function parse_entpath<T extends {kind: string} & Range>(ctx: ParserContext, lex: Generator<T,any,any>) {
    
    let result: any[] = []

    for (const tok of lex) {
        switch (tok.kind) {
            case "entpath_close": {
                return {kind: "entity", path: result}
            }
            case "var": {
                result.push(tok)
                break;
            }
            default: {
                console.log("NIMPL:", tok)
                ctx.NIMPL()
            }
        }
    }
}
