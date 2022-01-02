#!/usr/bin/env ts-node

import {glob} from 'glob'
import * as Path from 'path'

import * as cgen from 'yatt-codegen0'

async function build(templateDir: string, config: cgen.YattConfig) {
  const fileList = glob.sync('**/*.ytjs', {root: templateDir, cwd: templateDir})

  console.log(fileList)

  cgen.build_namespace(fileList.map(f => Path.join(templateDir, f)), config)
}

if (module.id === ".") {
  const { parse_long_options } = require('lrxml-js')

  let args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    outDir: './root',
    rootDir: 'templates/',
    exportNamespace: false,
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config})

  build(config.rootDir, config).catch((err) => {
    // XXX:
    console.error(err)
    // exit failure
  })
}
