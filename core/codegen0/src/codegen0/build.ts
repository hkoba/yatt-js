#!/usr/bin/env -S deno run -WRE

//// ./build.ts --outDir=example/dist core/lrxml/test/input/t00[^25]*

import type {YattConfig} from '../config.ts'
import {longestPrefixDir, outFileName} from '../path.ts'
import {generate_namespace} from './namespace/generate.ts'
import {generate_module} from './module/generate.ts'

import {readFileSync, writeFileSync} from 'node:fs'
import * as Path from 'node:path'

export async function build(fileList: string[], config: YattConfig) {
  if (config.documentRoot == null) {
    config.documentRoot = longestPrefixDir(fileList) ?? "./"
  }
  if (config.yattRoot == null) {
    config.yattRoot = Path.dirname(Path.normalize(config.documentRoot))
  }

  const generate = config.templateNamespace ? generate_namespace :
    generate_module;

  // XXX: if generating namespace, output should go into single index.ts
  for (const filename of fileList) {
    const outFn = outFileName(filename, '.ts', config)
    const absFn = Path.resolve(filename)
    console.log(`Generating ${outFn} from ${absFn}`)
    const source = readFileSync(absFn, {encoding: 'utf-8'})
    const output = await generate(absFn, source, config)
    if (! config.noEmit) {
      writeFileSync(outFn, output.outputText)
    }
  }
}

if (import.meta.main) {
  (async () => {
    const { parse_long_options } = await import('../deps.ts')
    const process = await import("node:process")

    const args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config = {
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    await build(args, config);
  })()
}
