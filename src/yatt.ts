#!/usr/bin/env ts-node

import {
    parserContext,
    parse_multipart,
    parse
} from 'lrxml-js'

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
        console.log(parse(ctx, part))
    }
}
