#!/usr/bin/env ts-node

import { YattConfig, parse_multipart, parserContext } from 'lrxml-js'

import { BuilderMap, builderContext } from './context'
import { Part } from './part'
import { WidgetBuilder } from './widget'
import { ActionBuilder } from './action'

export function builtin_builders(): BuilderMap {
    let builders = new Map
    builders.set('args', new WidgetBuilder(false, true))
    builders.set('widget', new WidgetBuilder(true, false))
    builders.set('page', new WidgetBuilder(true, true))
    builders.set('action', new ActionBuilder)
    builders.set('', builders.get('args'))
    return builders
}

export function* build_declarations_from_file(fn: string, config: YattConfig)
: Generator<Part>{
    const { readFileSync } = require('fs')
    const builders = builtin_builders()

    const pCtx = parserContext({
        filename: fn, source: readFileSync(fn, { encoding: "utf-8" }), config
    })

    const ctx = builderContext({
        builders, filename: fn, source: pCtx.session.source, config
    })

    for (const rawPart of parse_multipart(pCtx)) {
        yield ctx.build_declaration(rawPart)
    }
}

if (module.id === ".") {
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

    for (const fn of process.argv.slice(2)) {
        let gen = build_declarations_from_file(fn, {debug: {
            parser: debugLevel
        }})
        for (const part of gen) {
            console.log(part)
        }
    }
}
