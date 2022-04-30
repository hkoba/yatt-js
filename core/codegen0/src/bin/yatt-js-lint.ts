#!/usr/bin/env node

import {YattConfig} from '../config'
import * as yattPath from '../path'
import {generate_namespace} from '../codegen0/namespace/generate'
import {generate_module} from '../codegen0/module/generate'

import {readFileSync} from 'fs'

import { parse_long_options } from 'lrxml'

export function lint(fileList: string[], config: YattConfig) {
  if (config.rootDir == null) {
    config.rootDir = yattPath.longestPrefixDir(fileList)
  }

  const generate = config.templateNamespace ? generate_namespace :
    generate_module;

  for (const filename of fileList) {
    const outFn = yattPath.outFileName(filename, '.ts', config)
    const source = readFileSync(filename, {encoding: 'utf-8'})
    const _output = generate(source, {filename, ...config})
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
