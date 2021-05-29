#!/usr/bin/env ts-node

import {glob} from 'glob'
import {promisify} from 'util'
import {readFileSync} from 'fs'
import path from 'path'

const pGlob = promisify(glob)

import { parserContext, parse } from 'lrxml-js'
import {build} from './part-set/build'

const [_cmd, _script, ...args] = process.argv;
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0;

const baseNS = 'template';

function rootname(fn: string): string {
    const ext = path.extname(fn)
    if (ext === '') {
        return fn
    } else {
        return fn.substring(0, fn.length - ext.length)
    }
}

(async () => {
    for (const tmplDir of args) {
        const fileList = await pGlob('**/*.ytjs', {cwd: tmplDir, root: tmplDir})
        for (const fn of fileList) {
            const nsPrefix = baseNS + '.' + rootname(fn).split('/').join('.')
            process.stdout.write(`namespace ${nsPrefix} {\n`);
            let ctx = parserContext({
                filename: fn, source: readFileSync(
                    path.resolve(tmplDir, fn), {encoding: "utf-8"}
                ),
                config: {
                    debug: {parser: debugLevel}
                }
            })

            const partSet = build(ctx)
            for (const name of Object.keys(partSet)) {
                const part = partSet[name]

                switch (part.type) {
                    case "widget": {
                        const args = Object.keys(part.arg_dict).join(", ")
                        const ast = parse(ctx, part.raw_part)
                        process.stdout.write(`export function render_${name} (${args}) {\n`)
                        console.log("// ", part.arg_dict, "\n")
                        for (const item of ast) {
                            console.log(item)
                        }
                        process.stdout.write(`}\n`);
                        break;
                    }
                    case "entity": {
                        process.stdout.write(`export function entity_${name} {\n`)
                        for (const item of part.raw_part.payload) {
                            console.log(item)
                        }

                        process.stdout.write(`}\n`);
                        break;
                    }
                    case "action": {
                        process.stdout.write(`export function do_${name} {\n`)
                        for (const item of part.raw_part.payload) {
                            console.log(item)
                        }
                        process.stdout.write(`}\n`);
                        break;
                    }
                    default:
                }

            }
            process.stdout.write(`}\n`);
        }
    }
})()
