#!/usr/bin/env ts-node

//// ./build.ts --outDir=example/dist core/lrxml/test/input/t00[^25]*

import {YattConfig} from '../../config'

import {generate_namespace} from './generate'

import {readFileSync, writeFileSync} from 'fs'

import {dirname} from 'path'

import {longestPrefixDir, outFileName, srcDir} from '../../path'

export function build_namespace(fileList: string[], config: YattConfig): void {
  if (config.rootDir == null) {
    config.rootDir = longestPrefixDir(fileList)
  }

  let outDir
  for (const filename of fileList) {
    let outFn = outFileName(filename, '.ts', config)
    if (outDir == null)
      outDir = dirname(outFn);
    console.log(`Generating ${outFn} from ${filename}`)
    let source = readFileSync(filename, {encoding: 'utf-8'})
    const output = generate_namespace(source, {filename, ...config});
    if (config.noEmit)
      continue
    writeFileSync(outFn, output.outputText)
  }

  if (outDir != null && ! config.noEmit) {
    let outFn = `${outDir}/yatt.ts`
    let filename = `${srcDir}/yatt.ts`
    console.log(`Generating ${outFn} from ${filename}`)
    let source = readFileSync(filename, {encoding: 'utf-8'}).
      replace(/^\#![^\n]*\n/, '');
    if (! config.exportNamespace)
      source = source.replace(/^export /mg, '');
    writeFileSync(outFn, source)
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

  build_namespace(args, config);
}
