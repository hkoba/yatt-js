#!/usr/bin/env -S deno run -RE

import {parse_long_options} from '@yatt/lrxml'

import {runFile} from "@yatt/codegen0"

import process from "node:process"

const args = process.argv.slice(2)
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
const config = {
  debug: { declaration: debugLevel },
  // ext: 'ytjs',
}
parse_long_options(args, {target: config});

const [filename, paramsJson] = args

if (filename == null) {
  console.error(`Usage: ${process.argv[1]} sourceFile`)
  process.exit(1)
}

const params = paramsJson ? JSON.parse(paramsJson) : {}

try {
  const output = await runFile(filename, params, config)
  process.stdout.write(`\n=== output ====\n`);
  process.stdout.write(output);
} catch (e) {
  console.log(e)
}

