#!/usr/bin/env ts-node

import express from 'express';
import type {Request, Response, NextFunction} from 'express'

import {resolveFilePath} from '../../src/filepath'

import fs from 'fs'

import * as cgen from 'yatt-codegen0'

{
  const app = express()
  const port = 3000
  const rootDir = `${__dirname}/views`

  const modCache: Map<string, cgen.Module> = new Map;

  console.log(`cgen: `, cgen)

  app.get('/*', (req: Request, res: Response, next: NextFunction) => {
    const fp = resolveFilePath(req.path, {rootDir, index: 'index.ytjs', ext: '.ytjs'})
    if (! fp) {
      next()
    } else {
      // XXX: fp.isIndex should be treated specially because
      // if index.ytjs do not contain catch-all route, it should return 404

      console.log(`path = `, req.path, `, fp = `, fp)
      if (! modCache.has(fp.location)) {
        const filename = fp.absPath
        const source = fs.readFileSync(filename, {encoding: 'utf-8'})
        const output = cgen.generate_module(source, {filename})
        if (output == null)
          throw new Error(`yatt transpile error found in: ${filename}`)
        let {program, outputMap} = cgen.makeProgram(output.outputText)
        if (program == null)
          throw new Error(`ts compile error found in: ${filename}`)
        const mod = cgen.compile([...outputMap.values()].join('\n'), filename)
        if (mod == null)
          throw new Error(`module load error found in ${filename}`)
        modCache.set(fp.location, mod)
      }
      const mod = modCache.get(fp.location)!
      const fn = mod.exports[`render_`]
      if (fn == null)
        throw new Error(`Can't find render_`)

      let CON = {
        buffer: "",
        append(str: string) {
          this.buffer += str;
        },
        appendUntrusted(str?: string) {
          if (str == null) return;
          this.buffer += cgen.yatt.runtime.escape(str)
        }
      }
      fn.apply(undefined, [CON, {}]);

      res.send(CON.buffer)
    }
  })

  app.listen(port, () => {
    console.log(`Listening http://localhost:${port}/`)
  })
}
