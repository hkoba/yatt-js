#!/usr/bin/env ts-node

//// ./build.ts --outDir=example/dist core/lrxml/test/input/t00[^25]*

import {YattConfig} from '../config'
import {longestPrefixDir, outFileName} from '../path'
import {generate_namespace} from './namespace/generate'
import {generate_module} from './module/generate'

import {readFileSync, writeFileSync} from 'fs'

export function build(fileList: string[], config: YattConfig): void {
  if (config.rootDir == null) {
    config.rootDir = longestPrefixDir(fileList)
  }

  let generate = config.templateNamespace ? generate_namespace :
    generate_module;

  // XXX: if generating namespace, output should go into single index.ts
  for (const filename of fileList) {
    let outFn = outFileName(filename, '.ts', config)
    console.log(`Generating ${outFn} from ${filename}`)
    let source = readFileSync(filename, {encoding: 'utf-8'})
    const output = generate(source, {filename, ...config});
    if (config.noEmit)
      continue
    writeFileSync(outFn, output.outputText)
  }

}

if (module.id === ".") {
  const { parse_long_options } = require('lrxml-js')

  let args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config})

  build(args, config);
}
