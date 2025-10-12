#!/usr/bin/env -S deno test -RE

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import * as path from "node:path"
import * as process from "node:process"

import {rootname} from '../../src/path.ts'

import {runFile} from '../../src/codegen0/populator/runner.ts'

const testDir = rootname(rootname(new URL(import.meta.url).pathname)) + '.d'

{
  const rootDir = path.join(testDir, '1')

  test("foo1.ytjs", async () => {
    const output = await runFile(path.join(rootDir, "foo1.ytjs"), {}, {})
    assertEquals(output, `x=3
y=8

`)
  })

  test('bar1.ytjs', async () => {
    const output = await runFile(path.join(rootDir, "bar1.ytjs"), {}, {})
    assertEquals(output, `x=aa
y=bb

`)
  })

  test('baz1.ytjs', async () => {
    const output = await runFile(path.join(rootDir, "baz1.ytjs"), {}, {})
    assertEquals(output, `x=cc
y=dd

`)
  })

  test('qux1.ytjs', async () => {
    const output = await runFile(path.join(rootDir, "qux1.ytjs"), {}, {})
    assertEquals(output, `a=3 b=8

`)
  })
}
