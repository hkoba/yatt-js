#!/usr/bin/env -S deno test -R

import {test} from "@cross/test"
import {assertStringIncludes, fail} from '@std/assert'

import path from 'node:path'
import process from 'node:process'
import {readFileSync} from 'node:fs'

import {glob} from 'npm:glob'

import {parse_multipart, parse_template} from '@yatt/lrxml'
import type {LrxmlConfig} from '@yatt/lrxml'

import {rootname} from '@yatt/lrxml'

const __dirname = new URL('.', import.meta.url).pathname;

const error_input = path.join(__dirname, 'error_input')

{
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0;
  const config: LrxmlConfig = {
    debug: { parser: debugLevel }
  }

  for (const fn of glob.globSync("**/*.{yatt,ytjs}", {
    cwd: error_input
  })) {

    test(fn, () => {
      const realPath = path.join(error_input, fn)
      const errorFn = rootname(realPath) + '.error'
      const expectedError = readFileSync(errorFn, { encoding: "utf-8" }).trim()
      let gotError: string | undefined
      try {
        const source = readFileSync(realPath, { encoding: "utf-8" })
        const [partList, session] = parse_multipart(source, {
          filename: fn, ...config
        })

        for (const part of partList) {
          if (config.debug?.parser) {
            console.dir(part, {colors: true, depth: null})
          }
          const output = parse_template(session, part)
          if (config.debug?.parser) {
            console.dir(output, {colors: true, depth: null})
          }
        }
      } catch (e) {
        gotError = (e as Error).message
      }

      if (gotError == null) {
        fail("failed to raise error")
      } else {
        assertStringIncludes(gotError, expectedError)
      }
    })
  }
}
