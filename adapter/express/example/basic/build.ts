#!/usr/bin/env ts-node

import fs from 'fs'
import * as Path from 'path'

import {glob} from 'glob'

import * as cgen from '@yatt/codegen0'

async function build(config: cgen.YattConfig) {

  const publicSubDir = "pages"

  // rootDir の trailing slash 問題

  if (! config.rootDir) {
    config.rootDir = config.yattSrcRoot + publicSubDir + '/'
  }
  const rootDir = config.rootDir.replace(/\/$/, '')
  console.log('rootDir:', rootDir)

  const rootDirName = Path.basename(rootDir)

  config.outDir ??= "./gen"

  if (! fs.existsSync(config.outDir)) {
    console.log(`mkdir: ${config.outDir}`)
    fs.mkdirSync(config.outDir)
  }

  const yattRuntimeFile = rootDir.replace(/[^\/]+$/, 'yatt.ts');
  if (! fs.existsSync(yattRuntimeFile)) {
    fs.copyFileSync(cgen.path.srcDir + '/yatt.ts', yattRuntimeFile)
    console.log(`Copied ${yattRuntimeFile} from ${cgen.path.srcDir}`)
  }
  let linkDir
  if (config.linkDir && config.linkDir !== '' && config.linkDir !== './') {
    linkDir = config.linkDir
  }
  if (!config.noEmit && linkDir) {
    ensureSymlink(Path.join(cgen.path.prefixPath(linkDir)
                            , yattRuntimeFile)
                  , Path.join(linkDir, 'yatt.ts'))
  }

  const pagesMap: Map<string, cgen.TemplateDeclaration> = new Map;
  for (const fn of glob.sync('**/*.ytjs', {root: rootDir, cwd: rootDir})) {
    const filename = Path.join(rootDir, fn)
    const source = fs.readFileSync(filename, {encoding: 'utf-8'})
    const output = cgen.generate_module(filename, source, config)
    if (output == null)
      throw new Error(`yatt transpile error found in: ${filename}`)
    pagesMap.set('/' + output.templateName, output.template)
    if (config.noEmit)
      continue
    const outFn = cgen.path.outFileName(filename, '.ts', config)
    if (! fs.existsSync(Path.dirname(outFn))) {
      fs.mkdirSync(Path.dirname(outFn))
    }

    // 元ディレクトリに .htyattrc.ts があれば、gen にも symlink
    let hasYattRC
    {
      const yattRcFn = Path.join(Path.dirname(filename), cgen.yattRcFile + ".ts")
      console.log(`src yattRcFn = ${yattRcFn}`)
      hasYattRC = fs.existsSync(yattRcFn)
      if (hasYattRC) {
        const linkTargetPrefix = cgen.path.prefixPath(yattRcFn)
        const linkPath = Path.join(Path.dirname(outFn), cgen.yattRcFile + ".ts")
        ensureSymlink(Path.join(linkTargetPrefix, yattRcFn)
                      , linkPath)
      }
    }

    console.log(`Emitting ${outFn} from ${filename}`)
    fs.writeFileSync(outFn, output.outputText)

    if (linkDir) {
      // linkDir (src/) が有れば、gen/ に作った ts をそこに symlink
      const linkTargetPrefix = cgen.path.prefixPath(filename)
      const tsFn = cgen.path.fileNameWithNewExt(fn, '.ts')
      const linkFn = Path.join(linkDir, publicSubDir, tsFn)
      console.log(`page linkFn=${linkFn}, outFn=${outFn}, linkTargetPrefix=${linkTargetPrefix}`)
      ensureSymlink(Path.join(linkTargetPrefix, config.outDir, publicSubDir, tsFn)
                    , linkFn)

      if (hasYattRC) {
        const yattRcFn = cgen.yattRcFile + ".ts"
        const linkTargetPrefix = cgen.path.prefixPath(linkFn)
        ensureSymlink(Path.join(linkTargetPrefix, config.outDir, publicSubDir, yattRcFn)
                      , Path.join(Path.dirname(linkFn), yattRcFn))
      }
    }
  }


  let viewNo = 0
  let routingScript = `
import type {Request, Response, NextFunction, Router} from 'express'
import {yatt} from './yatt'
import type {Connection} from './${publicSubDir}/${cgen.yattRcFile}'
import {makeConnection} from './${publicSubDir}/${cgen.yattRcFile}'
`

  let routerBody = `export function express(router: Router): Router {\n`

  for (const [path, template] of pagesMap) {
    const viewId = `v${++viewNo}`
    routingScript += `import * as ${viewId} from './${publicSubDir}${path}'\n`
    for (const part of template) {
      if (! part.is_public)
        continue

      let method, subroute, handler

      if (typeof part.route === "string") {
        [method, subroute] = ['all', part.route]
      } else if (part.route != null) {
        [method, subroute] = part.route
      } else {
        [method, subroute] = ['all', '']
      }
      const route = path + subroute

      switch (part.kind) {
        case "widget": {
          handler = generate_page_handler(part, viewId);
          break
        }
        case "action": {
          handler = generate_action_handler(part, viewId);
          break
        }
      }

      if (handler == null)
        continue

      routerBody += `  router.${method}("${route}", ${handler})\n`
      if (/\/index$/.exec(route)) {
        const index = route.replace(/\/index$/, '/')
        routerBody += `  router.${method}("${index}", ${handler})\n`
      }
    }
  }

routingScript += routerBody + `
  return router
}
`

  const routingScriptFn = config.outDir + '/' + rootDirName + '.ts'
  if (! config.noEmit) {
    console.log(`Emitting routes to ${routingScriptFn}`)
    fs.writeFileSync(routingScriptFn, routingScript)

    if (linkDir) {
      ensureSymlink(Path.join(cgen.path.prefixPath(linkDir), routingScriptFn)
                    , Path.join(linkDir, rootDirName + '.ts'))
    }
  }
}

function ensureSymlink(target: string, linkPath: string) {
  console.log(`linkPath = ${linkPath}`)
  if (! fs.existsSync(Path.dirname(linkPath))) {
    console.log(`mkdir`)
    fs.mkdirSync(Path.dirname(linkPath))
  } else {
    console.log(`hasdir`)
  }
  if (fs.lstatSync(linkPath, {throwIfNoEntry: false})) {
    console.log(`exists. wantTarget=${target}`)
    const curTarget = fs.readlinkSync(linkPath)
    if (curTarget === target) {
      return
    }
    console.log(`unlink old link to ${curTarget}`)
    fs.unlinkSync(linkPath)
  }
  fs.symlinkSync(target, linkPath)
}

function generate_page_handler(widget: cgen.Widget, viewId: string): string {
  let paramsExpr = []
  for (const [name, argSpec] of widget.argMap) {
    if (argSpec.is_body_argument)
      continue
    paramsExpr.push(`${name}: req.params.${name} ?? req.query.${name}`)
  }
  return `(req: Request, res: Response) => {
    let CON = makeConnection(req, res)
    let handler, spec
    if (CON.subitem != null) {
      const {kind, name} = CON.subitem
      switch (kind) {
        case 'page': {
          spec = 'render_' + name
          break;
        }
        case 'action': {
          spec = 'do_' + name
          break;
        }
      }
      handler = (${viewId} as {[k: string]: any})[spec]
    } else {
      spec = 'render_' + '${widget.name}'
      handler = ${viewId}.render_${widget.name}
    }
    if (handler == null) {
      throw new Error("Invalid request: " + spec)
    }
    console.log("Requested: ", spec)
    handler(CON, {${paramsExpr.join(', ')}})
    res.send(CON.buffer)
  }`
}

function generate_action_handler(action: cgen.Action, viewId: string): string {
  let paramsExpr = []
  for (const [name, argSpec] of action.argMap) {
    if (argSpec.is_body_argument)
      continue
    paramsExpr.push(`${name}: req.params.${name} ?? req.query.${name}`)
  }
  return `(req: Request, res: Response) => {
    let CON = makeConnection(req, res)
    ${viewId}.do_${action.name}(CON, {${paramsExpr.join(', ')}})
    res.send(CON.buffer)
  }`
}

if (module.id === ".") {
  (async () => {
    const { parse_long_options } = await import('@yatt/lrxml')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      yattSrcRoot: "yatt/",
      linkDir: "src/",
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    build(config)
  })()
}
