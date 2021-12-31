#!/usr/bin/env ts-node

import fs from 'fs'
import * as Path from 'path'

import {glob} from 'glob'

import * as cgen from 'yatt-codegen0'

// ↓ここが微妙…
import type {Connection} from './entity-fn'


async function build(config: cgen.YattConfig) {
  const rootDir = config.rootDir ?? "pages"
  console.log('rootDir:', rootDir)
  const entFns = await import('./entity-fn')
  console.log('entity-fn: ', entFns)

  const pagesMap: Map<string, cgen.TemplateDeclaration> = new Map;
  for (const fn of glob.sync('**/*.ytjs', {root: rootDir, cwd: rootDir})) {
    const filename = Path.join(rootDir, fn)
    const source = fs.readFileSync(filename, {encoding: 'utf-8'})
    const output = await cgen.generate_module(source, {filename, entFnsFile})
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
import {yatt} from '${cgen.path.srcDir}/yatt'

const makeConnection = () => {
  return {
    buffer: "",
    append(str: string) {
      this.buffer += str;
    },
    appendUntrusted(str?: string) {
      if (str == null) return;
      this.buffer += yatt.runtime.escape(str)
    }
  }
}

`

  let routerBody = `export function express(router: Router): Router {\n`

  for (const [path, template] of pagesMap) {
    const viewId = `v${++viewNo}`
    routingScript += `import * as ${viewId} from './${rootDir}${path}'\n`
    for (const widget of template.partMap.widget.values()) {
      if (! widget.is_public)
        continue
      const route = path + (widget.route ?? "");
      let paramsExpr = []
      for (const [name, argSpec] of widget.argMap) {
        if (argSpec.is_body_argument)
          continue
        paramsExpr.push(`${name}: req.params.${name}`)
      }
      const handler = `(req: Request, res: Response) => {
    let CON = makeConnection()
    ${viewId}.render_${widget.name}(CON, {${paramsExpr.join(', ')}})
    res.send(CON.buffer)
  }`
      routerBody += `  router.get("${route}", ${handler})\n`
      if (/\/index$/.exec(route)) {
        const index = route.replace(/\/index$/, '/')
        routerBody += `  router.get("${index}", ${handler})\n`
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

if (module.id === ".") {
  const { parse_long_options } = require('lrxml-js')

  let args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config})

  build(config).catch((err) => {
    // XXX:
    console.error(err)
    // exit failure
  })
}
