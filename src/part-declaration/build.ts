#!/usr/bin/env ts-node

import { parse_multipart, ParserContext, parserSession, ParserSession } from 'lrxml-js'

import { BuilderMap, BuilderContext } from './context'
import { Part } from './part'
import { WidgetBuilder } from './widget'
import { ActionBuilder } from './action'

export function builtin_builders(): BuilderMap {
    let builders = new Map
    builders.set('args', new WidgetBuilder(false, true))
    builders.set('widget', new WidgetBuilder(true, false))
    builders.set('page', new WidgetBuilder(true, true))
    builders.set('action', new ActionBuilder)
    // entity
    builders.set('', builders.get('args'))
    return builders
}

export function* build_declarations(session: ParserSession)
: Generator<Part>{
    // XXX: default private or public
    const builders = builtin_builders()

    const pCtx = new ParserContext(session)

    const ctx = new BuilderContext({builders, ...session})

    // XXX: declaration macro handling
    for (const rawPart of parse_multipart(pCtx)) {
        yield ctx.build_declaration(rawPart)
    }
}

if (module.id === ".") {
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const { readFileSync } = require('fs')

    for (const fn of process.argv.slice(2)) {
        let session = parserSession({
            filename: fn, source: readFileSync(fn, { encoding: "utf-8" }),
            config: {
                debug: { parser: debugLevel }
            }
        })
        for (const part of build_declarations(session)) {
            console.dir(part, {colors: true, depth: null})
        }
    }
}
