#!/usr/bin/env ts-node

//// ./build.ts --outDir=example/dist core/lrxml/test/input/t00[^25]*

import {YattConfig} from '../../config'

import {generate_namespace} from './generate'

import {readFileSync, writeFileSync} from 'fs'
import path from 'path'

export function build_namespace(fileList: string[], config: YattConfig): void {
  if (config.rootDir == null || config.rootDir === "") {
    config.rootDir = path.dirname(longestPrefix(fileList))
  }

  for (const filename of fileList) {
    let outFn = outFileName(filename, '.ts', config)
    console.log(`Generating ${outFn} from ${filename}`)
    let source = readFileSync(filename, {encoding: 'utf-8'})
    const script = generate_namespace(source, {filename, ...config});
    if (config.noEmit)
      continue
    writeFileSync(outFn, script)
  }
}

function pathUnderRootDir(filename: string, rootDir: string): string | undefined {
  if (filename.startsWith(rootDir)) {
    return filename.substring(rootDir.length)
  }
}

function outFileName(filename: string, newExt: string, config: YattConfig): string {
  const ext = path.extname(filename)
  if (config.outDir != null && config.outDir !== "") {
    if (config.rootDir == null || config.rootDir === "")
      throw new Error(`rootDir should not be empty when outDir is specified`);
    const subName = pathUnderRootDir(filename, config.rootDir)
    if (subName == null)
      throw new Error(`Can't determine outFileName for ${filename} under rootDir ${config.rootDir}`);
    const rootName = path.join(path.dirname(subName), path.basename(subName, ext))
    return path.join(config.outDir, rootName + newExt)
  } else {
    return path.join(path.dirname(filename), path.basename(filename, ext) + newExt)
  }
}

function longestPrefix(fileList: string[]): string {
  const [first, ...rest] = fileList;
  let prefix = ""
  for (let i = 0; i < first.length; i++) {
    let char = first.charAt(i)
    if (rest.some(fn => fn.charAt(i) !== char))
      break;
    prefix += char;
  }
  return prefix;
}

if (module.id === ".") {
  const { parse_long_options } = require('lrxml-js')

  let args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    body_argument_name: "body",
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config})

  build_namespace(args, config);
}
