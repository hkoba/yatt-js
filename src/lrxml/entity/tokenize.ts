#!/usr/bin/env ts-node

import { ParserContext } from '../../context'

import { re_join } from '../../utils/regexp'

function re_entpath_open() {
    const str = re_join(
        ':(?<var>\\w+)(?<call_open>\\()?',
        '(?<array_open>\\[)',
        '(?<dict_open>\\{)'
    )
    return new RegExp(str, 'y')
}

type EntMatch = {
    var?: string
    call_open?: string
    array_open?: string
    dict_open?: string
}

export function* tokenize_entpath(ctx: ParserContext): Generator<any, any, any> {
    const re_open = ctx.re('entpath_open', () => re_entpath_open())
    
    let termList = []
    let match: RegExpExecArray | null
    while ((match = ctx.match_index(re_open)) != null) {
        let mg = match.groups as EntMatch
        if (mg.var != null) {
            if (mg.call_open != null) {
                ctx.NIMPL()
            }
            else {
                yield {kind: "var", value: mg.var, ...ctx.tab_string(mg.var, 1)}
            }
        }
        else if (mg.array_open != null) {
            ctx.NIMPL()
        }
        else if (mg.dict_open != null) {
            ctx.NIMPL()
        }
        else {
            ctx.NEVER()
        }
    }

    const end = ctx.global_match(/;/y);

    if (! end) {
        console.log("REST: [[" + ctx.rest_line(3) + "]]")
        ctx.throw_error("entity is not terminated by ;")
    }
    
    yield {kind: "entpath_close", ...ctx.tab(end)}

}
