#!/usr/bin/env ts-node

import * as cgen from '@yatt/codegen0'

import * as chokidar from 'chokidar'

import {build, build_page, build_router} from "./build"

import * as Path from 'node:path'

export async function watch(origConfig: cgen.YattConfig) {
  const config = cgen.yattParams(origConfig)

  if (config.debug?.build) {
    console.log(`project style:`, config.projectStyle, cgen.extractProjectStyle(config))
  }

  const pagesMap = await build(config)

  const watcher = chokidar.watch(
    config.yattRoot
  )

  watcher.on('all', (event, path) => {
    console.log(`event`, event, path)
    // XXX: lib/widgets

    // fn, rootDir の分解が必要
    const fn = cgen.path.pathUnderRootDir(path, config.documentRoot)
    console.log(`path ${path} fn=`, fn)
    if (! fn) {
      return
    }
    if (Path.extname(path) === config.ext_public) {
      switch (event) {
        case 'add': case 'change': {
          // XXX: await
          build_page(fn, pagesMap, config)
          build_router(pagesMap, config)
          break;
        }
        case 'unlink': {
          // XXX: pagesMap から削除して、
          build_router(pagesMap, config)
        }
      }
    }
    else if (Path.basename(path) === cgen.yattRcFile) {
      // XXX: build_rc
    }
  })
}

if (module.id === ".") {
  (async () => {
    const { parse_long_options } = await import('@yatt/lrxml')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      debug: { declaration: debugLevel, build: debugLevel }
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    console.log(`parsed config: `, config)

    watch(config)
  })()
}
