#!/usr/bin/env -S deno run -A

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import process from "node:process"

import {runFile as runFileNS} from '../src/codegen0/namespace/run0.ts'

import {runFile as runFileMod} from '../src/codegen0/module/run0.ts'

import {rootname} from '../src/path.ts'

{
  const dir = rootname(new URL(import.meta.url).pathname) + '.d/'

  test(`namespace`, () => {
    const testFile = (filename: string, expect: string) =>
      assertEquals(runFileNS(dir + filename, {
        connectionTypeName: 'yatt.runtime.Connection',
        debug: {codegen: parseInt(process.env['DEBUG_YATT_CODEGEN'] ?? '', 10) || 0}
      }), expect, filename);
    
    testFile("widget.ytjs", `<h2>3</h2>
<div>hoehoe</div>
8
aaa
`)

    testFile("entity.ytjs", `11\n`)
  })

  test(`module`, () => {
    const testFile = (filename: string, expect: string) =>
      assertEquals(runFileMod(dir + filename, {
        connectionTypeName: 'yatt.runtime.Connection',
        debug: {codegen: parseInt(process.env['DEBUG_YATT_CODEGEN'] ?? '', 10) || 0}
      }), expect, filename);
    
    testFile("widget.ytjs", `<h2>3</h2>
<div>hoehoe</div>
8
aaa
`)

    testFile("entity.ytjs", `11\n`)
  })
}
