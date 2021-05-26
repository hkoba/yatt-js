#!/usr/bin/env ts-node

import {
    parserContext,
    parse_multipart,
    parse
} from 'lrxml-js'

import {build_from_file} from './part-set/build'

const [_cmd, _script, ...args] = process.argv;
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

for (const fn of args) {

    const part = build_from_file(fn, {
        debug: {
            parser: debugLevel
        }
    })

    console.log(part)
}
