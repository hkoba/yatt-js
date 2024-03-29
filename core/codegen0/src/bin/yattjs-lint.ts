#!/usr/bin/env node

import {TokenError} from 'lrxml'
import {YattConfig} from '../config'
import {longestPrefixDir} from '../path'
import {generate_namespace} from '../codegen0/namespace/generate'
import {generate_module} from '../codegen0/module/generate'

import * as Path from 'path'
import {readFileSync, existsSync} from 'fs'

import { parse_long_options } from 'lrxml'

function* pathParents(path: string): Generator<string> {
  let p = Path.isAbsolute(path) ? path : Path.resolve(path)
  do {
    yield p
    p = Path.parse(p).dir;
  } while (p.length && p !== "/")
}

function isClasp(rootDir: string): boolean {
  for (const dir of pathParents(rootDir)) {
    // console.log(`updir: ${dir}`)
    if (existsSync(Path.join(dir, '.clasp.json'))) {
      return true
    }
  }
  return false;
}

export function lint(fileList: string[], config: YattConfig) {
  // console.log(`in lint`);
  const rootDir = Path.resolve(config.rootDir ?? longestPrefixDir(fileList) ?? "./") + "/"
  // console.log(`rootDir=${rootDir}`)
  config.rootDir ??= rootDir;
  // console.log(`isClasp=`, isClasp(rootDir))

  const generate = isClasp(rootDir) ? generate_namespace :
    generate_module;

  for (const filename of fileList) {
    const absFn = Path.resolve(filename)
    const source = readFileSync(absFn, {encoding: 'utf-8'})
    try {
      generate(absFn, source, config)
    } catch (e) {
      if (e instanceof TokenError) {
        console.error(e.message)
      } else {
        console.error(e)
      }
      process.exit(1)
    }
  }
}


let args = process.argv.slice(2)
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
let config = {
  debug: { declaration: debugLevel },
  // ext: 'ytjs',
}

parse_long_options(args, {target: config})

lint(args, config);
