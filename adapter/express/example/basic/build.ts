#!/usr/bin/env ts-node

import fs from 'fs'
import * as Path from 'path'

import {glob} from 'glob'

import * as cgen from '@yatt/codegen0'

async function build(config: cgen.YattConfig) {
  const rootDir = config.rootDir ?? "pages"
  console.log('rootDir:', rootDir)
  const entFnsFile = __dirname + '/entity-fn'

  const yattRuntimeFile = __dirname + '/yatt.ts';
  if (! fs.existsSync(yattRuntimeFile)) {
    fs.copyFileSync(cgen.path.srcDir + '/yatt.ts', yattRuntimeFile)
    console.log(`Copied ${yattRuntimeFile} from ${cgen.path.srcDir}`)
  }

  const pagesMap: Map<string, cgen.TemplateDeclaration> = new Map;
  for (const fn of glob.sync('**/*.ytjs', {root: rootDir, cwd: rootDir})) {
    const filename = Path.join(rootDir, fn)
    const source = fs.readFileSync(filename, {encoding: 'utf-8'})
    const output = cgen.generate_module(filename, source, {entFnsFile})
    if (output == null)
      throw new Error(`yatt transpile error found in: ${filename}`)
    pagesMap.set('/' + output.templateName, output.template)
    if (config.noEmit)
      continue
    const outFn = cgen.path.outFileName(filename, '.ts', config)
    console.log(`Emitting ${outFn} from ${filename}`)
    fs.writeFileSync(outFn, output.outputText)
  }

  let viewNo = 0
  let routingScript = `
import type {Request, Response, NextFunction, Router} from 'express'
import {yatt} from './yatt'
import type {Connection} from '${entFnsFile}'
import {makeConnection} from '${entFnsFile}'
`

  let routerBody = `export function express(router: Router): Router {\n`

  for (const [path, template] of pagesMap) {
    const viewId = `v${++viewNo}`
    routingScript += `import * as ${viewId} from './${rootDir}${path}'\n`
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

  const routingScriptFn = rootDir + '.ts'
  if (! config.noEmit) {
    console.log(`Emitting routes to ${routingScriptFn}`)
    fs.writeFileSync(routingScriptFn, routingScript)
  }
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
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    build(config)
  })()
}
