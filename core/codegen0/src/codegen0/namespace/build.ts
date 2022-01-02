#!/usr/bin/env ts-node

//// ./build.ts --outDir=example/dist core/lrxml/test/input/t00[^25]*

import {YattConfig} from '../../config'

import {generate_namespace} from './generate'

import {readFileSync, writeFileSync} from 'fs'

import {dirname} from 'path'

import {longestPrefixDir, outFileName, srcDir} from '../../path'

export async function compose_namespace(fileList: string[], config: YattConfig): Promise<string> {
  let tasks = []
  for (const filename of fileList) {
    const source = readFileSync(filename, {encoding: 'utf-8'})
    tasks.push(generate_namespace(source, {filename, ...config}))
  }
  return Promise.all(tasks).then(values => {
    return values.map(o => o.outputText).join('');
  }).catch(err => {throw err});
}

export async function build_namespace(fileList: string[], config: YattConfig): Promise<void> {
  if (config.rootDir == null) {
    config.rootDir = longestPrefixDir(fileList)
  }

  const outDir = config.outDir ?? config.rootDir
  const outFn = `${outDir}/index.ts`
  const program = await compose_namespace(fileList, config)

  if (! config.noEmit) {
    console.log(`Generating ${outFn}`)
    writeFileSync(outFn, program)
  }

  if (outDir != null && ! config.noEmit) {
    let outFn = `${outDir}/yatt.ts`
    let filename = `${srcDir}/yatt.ts`
    console.log(`srcDir = ${srcDir}`)
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
