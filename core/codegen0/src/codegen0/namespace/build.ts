#!/usr/bin/env ts-node

//// ./build.ts --outDir=example/dist core/lrxml/test/input/t00[^25]*

import {YattConfig} from '../../config'

import {generate_namespace} from './generate'

// XXX: Remove node path dependencies
import {readFileSync, writeFileSync} from 'fs'
import * as Path from 'path'

import {longestPrefixDir, srcDir} from '../../path'

export function compose_namespace(fileList: string[], config: YattConfig): string {
  let program = ""
  for (const filename of fileList) {
    const absFn = Path.resolve(filename)
    const source = readFileSync(absFn, {encoding: 'utf-8'})
    const output = generate_namespace(absFn, source, config)
    program += output.outputText
  }
  return program
}

export function build_namespace(fileList: string[], config: YattConfig): void {
  if (config.rootDir == null) {
    config.rootDir = longestPrefixDir(fileList)
  }

  const outDir = config.outDir ?? config.rootDir
  const outFn = `${outDir}/index.ts`
  const program = compose_namespace(fileList, config)

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
  (async () => {
    const { parse_long_options } = await import('lrxml')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    build_namespace(args, config);
  })()
}
