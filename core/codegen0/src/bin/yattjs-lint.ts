#!/usr/bin/env -S deno run -A

import {TokenError} from '../deps.ts'
import type {YattConfig} from '../config.ts'
import {longestPrefixDir} from '../path.ts'
import {generate_namespace} from '../codegen0/namespace/generate.ts'
import {generate_module} from '../codegen0/module/generate.ts'

import * as Path from 'node:path'
import {readFileSync, existsSync} from 'node:fs'

import { parse_long_options } from '../deps.ts'

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


const process = await import("node:process")
const args = process.argv.slice(2)
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
const config = {
  debug: { declaration: debugLevel },
  // ext: 'ytjs',
}

parse_long_options(args, {target: config})

lint(args, config);
