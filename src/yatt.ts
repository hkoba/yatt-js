#!/usr/bin/env ts-node

import {
    parserContext,
    parse_multipart,
    parse
} from 'lrxml-js'

import {build} from './part-set/build'

const [_cmd, _script, ...args] = process.argv;
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

for (const fn of args) {
    const { readFileSync } = require("fs")
    let ctx = parserContext({
        filename: fn, source: readFileSync(fn, {encoding: "utf-8"}), config: {
            debug: {
                parser: debugLevel
            }
        }
    })

    const partSet = build(ctx)

    for (const name of Object.keys(partSet)) {
        const part = partSet[name]
        if (part.type === "widget") {
            parse(ctx, part.raw_part)
        }
    }

    console.log(partSet)
}
