#!/usr/bin/env ts-node

import {
    parserContext,
    parse_multipart,
    parse
} from 'lrxml-js'

import {builderDict} from './declaration/builder'

const { readFileSync } = require('fs')
const [_cmd, _script, ...args] = process.argv;
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

for (const fn of args) {
    let ctx = parserContext({
        filename: fn, source: readFileSync(fn, { encoding: "utf-8" }), config: {
            debug: {
                parser: debugLevel
            }
        }
    })

    for (const part of parse_multipart(ctx)) {

        let builder = builderDict[part.kind]
        if (! builder)
            continue

        let result = builder.build(ctx, part.kind, part)
        console.log(result)
    }
}
