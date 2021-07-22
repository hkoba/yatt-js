#!/usr/bin/env ts-node

import {glob} from 'glob'
import {promisify} from 'util'
import {readFileSync} from 'fs'
import path from 'path'

const pGlob = promisify(glob)

import { parse_long_options, parse_template } from 'lrxml-js'

import { build_template_declaration, BuilderContext } from './declaration/'

import {generate_widget} from './codegen'

const [_cmd, _script, ...args] = process.argv;
const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0;

const baseNS = 'templates';

function rootname(fn: string): string {
  const ext = path.extname(fn)
  if (ext === '') {
    return fn
  } else {
    return fn.substring(0, fn.length - ext.length)
  }
}


(async () => {
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    body_argument_name: "body",
    debug: { declaration: debugLevel },
    ext: 'ytjs'
  }
  parse_long_options(args, {target: config})
  // 拡張子もオプションで渡さないと

  // const { readFileSync } = require('fs')

  for (const tmplDir of args) {
    const fileList = await pGlob(`**/*.${config.ext}`, {cwd: tmplDir, root: tmplDir})
    for (const fn of fileList) {
      const nsPrefix = baseNS + '.' + rootname(fn).split('/').join('.')
      process.stdout.write(`namespace ${nsPrefix} {\n`);

      const [template, session] = build_template_declaration(
        readFileSync(path.resolve(tmplDir, fn), {encoding: "utf-8"}),
        {filename: fn, ...config}
      );

      const ctx = new BuilderContext(session)

      for (const [kind, name] of template.partOrder) {
        const partMap = template.partMap[kind]
        if (partMap == null)
          throw new Error(`BUG: Unknown part kind ${kind}`)
        const part = partMap.get(name)
        if (part == null)
          throw new Error(`BUG: Unknown part ${kind} ${name}`)

        if (part.raw_part == null)
          throw new Error(`raw_part is empty for ${kind} ${name}`)

        switch (part.kind) {
          case "widget": {
            const ast = parse_template(session, part.raw_part)
            const script = generate_widget(ctx, name, part, ast)
            process.stdout.write(script);
            break;
          }
          default: {
            process.stdout.write(`// XXX: dummy\n`);
            process.stdout.write(`export function ${kind}_${name} {\n`)
            process.stdout.write(`}\n`)
          }
        }
      }

      process.stdout.write(`}\n`);
    }
  }
})()
