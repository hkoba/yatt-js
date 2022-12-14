#!/usr/bin/env ts-node

import tap from 'tap'

import {runFile as runFileNS} from '../src/codegen0/namespace/run0'

import {runFile as runFileMod} from '../src/codegen0/module/run0'

import {rootname} from '../src/path'

{
  const dir = rootname(__filename) + '.d/'

  tap.test(`namespace`, t => {
    const testFile = (filename: string, expect: string) =>
      t.same(runFileNS(dir + filename, {connectionTypeName: 'yatt.runtime.Connection'}), expect, filename);
    
    testFile("widget.ytjs", `<h2>3</h2>
<div>hoehoe</div>
8
aaa
`)

    testFile("entity.ytjs", `11\n`)

    t.end()
  })

  tap.test(`module`, t => {
    const testFile = (filename: string, expect: string) =>
      t.same(runFileMod(dir + filename, {connectionTypeName: 'yatt.runtime.Connection'}), expect, filename);
    
    testFile("widget.ytjs", `<h2>3</h2>
<div>hoehoe</div>
8
aaa
`)

    testFile("entity.ytjs", `11\n`)

    t.end()
  })

}
