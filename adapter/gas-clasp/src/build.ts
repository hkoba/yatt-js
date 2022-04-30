#!/usr/bin/env ts-node

import {glob} from 'glob'
import * as Path from 'path'

import * as cgen from 'yatt-codegen0'

async function build(templateDir: string, config: cgen.YattConfig): Promise<void> {
  const fileList = glob.sync('**/*.ytjs', {root: templateDir, cwd: templateDir})

  console.log(fileList)

  await cgen.build_namespace(fileList.map(f => Path.join(templateDir, f)), config)
}

if (module.id === ".") {
  (async () => {
    const { parse_long_options } = await import('lrxml')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const rootDir = 'templates/'
    let config: cgen.YattConfig = {
      outDir: './root',
      rootDir,
      exportNamespace: false,
      connectionTypeName: 'yatt.Connection',
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    await build(rootDir, config)
  })()
}
