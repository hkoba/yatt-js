#!/usr/bin/env -S deno run -RE

import {test} from '@cross/test'
import {assertEquals, assertMatch, fail} from '@std/assert'

import {readFileSync} from 'node:fs'

import {parseAsObjectList} from '@yatt/xhf'

import type {YattConfig} from './config.ts'

import { cgenSession, freshCGenSession, type CGenBaseSession } from "./codegen0/context.ts"
import {
  refresh_populator, type DirHandler, type Connection, type typeof$yatt
} from "./codegen0/populator/loader.ts"
import { SourceRegistry, SourceConfig } from "./declaration/registry.ts" 
import { runtime } from "./yatt.ts"

export type Header = {
  YATT_CONFIG?: string[]

  encoding?: string
  YATT_RC?: string
  ONLY_UTF8?: string
}

export interface ItemSpec {
  SKIP?: string

  FILE?: string
  TITLE?: string
  WIDGET?: string

  IN?: string
  PARAM?: string[]
  OUT?: string
  ERROR?: string
}

export type TestItem = TestItemOk | TestItemError

export interface TestItemBase {
  kind: 'output' | 'error'
  realfile: string
  num: number

  FILE: string
  TITLE: string
  WIDGET: string
  PARAM?: string[]
}

export type TestItemOk = TestItemBase & {
  kind: 'output'
  OUT: string
}
export type TestItemError = TestItemBase & {
  kind: 'error'
  ERROR: string
}

/*
  BREAK?: string
  SKIP?: string
  TODO?: string
  PERL_MINVER?: string

  RANDOM?: string
  ERROR_BODY?: string

  REQUIRE?: string

  TAG?: string
  CON_CLASS?: string
 */

export function runtests(files: string[], baseConfig: YattConfig): void {

  for (const fn of files) {
    // console.log('=====', fn)

    const {header, sourceCache, testItems} = loadTestItems(fn, {})

    const baseCgen = cgenSession('populator', {
      ...header,
      ...baseConfig,
      sourceCache
    })

    const $yatt = {
      runtime, $public: {}
    }

    for (const item of testItems) {
      // console.log(item)

      test(`${item.TITLE}`, async () => {
        const cgen = freshCGenSession(baseCgen)

        switch (item.kind) {
          case 'error': {
            assertMatch(await doErrorTest(item, $yatt, baseCgen)
              , new RegExp(item.ERROR))
            break;
          }
          case 'output': {
            assertEquals(await doOutputTest(item, $yatt, baseCgen)
              , item.OUT)
            break;
          }
          default: {
            // NEVER
            break;
          }
        }
      })
    }
  }
}

export async function doErrorTest(
  item: TestItemError & {kind: 'error'},
  $yatt: typeof$yatt,
  baseCgen: CGenBaseSession
): Promise<string> {
  const cgen = freshCGenSession(baseCgen)

  try {
    await refresh_populator(
      item.FILE, {...cgen, $yatt}
    )
  } catch (error) {
    if (! (error instanceof Error)) {
      throw error
    }
    return error.message
  }

  throw new Error(`Failed to detect error: ${item.TITLE}`)
}

export async function doOutputTest(
  item: TestItemOk & {kind: 'output'},
  $yatt: typeof$yatt,
  baseCgen: CGenBaseSession
): Promise<string> {
  const cgen = freshCGenSession(baseCgen)

  const $this = await refresh_populator(
    item.FILE, {...cgen, $yatt}
  )
  if (! $this) {
    fail(`FAILED to compile: ${item.TITLE}`)
  }
  const CON = {
    buffer: "",
    append(str: string) {
      this.buffer += str;
    },
    appendUntrusted(str?: string) {
      if (str == null) return;
      this.buffer += $yatt.runtime.escape(str)
    },
    appendRuntimeValue(val: any) {
      this.buffer += $yatt.runtime.escape(val)
    }
  }
  $this.render_(CON, {})

  return CON.buffer
}

export function loadTestItems(fn: string, config: SourceConfig): {
  header: Header,
  testItems: TestItem[],
  sourceCache: SourceRegistry
} {
  const xhf_content = readFileSync(fn, {encoding: "utf-8"})
  const xhf_stream = parseAsObjectList(xhf_content, {header: true})
  const header = xhf_stream.next()?.value as Header
  // console.log('header: ', header)

  const sourceCache = new SourceRegistry(config);

  const now = Date.now()
  let fileNo = 0
  const testItems: TestItem[] = []
  for (const item of (xhf_stream as Generator<ItemSpec>)) {
    if (item.IN != null) {
      ++fileNo
    }

    if (item.SKIP) {
      console.warn(`SKIP: ${item.TITLE ?? fileNo}`)
      continue
    }

    const [realfile, testItem] = parseTestItemSpec(item, fileNo, testItems[testItems.length-1])

    if (item.IN != null) {
      sourceCache.setFile(realfile, item.IN, now)
    }

    if (testItem) {
      testItems.push(testItem)
    }
  }

  return {header, testItems, sourceCache}
}

export function parseTestItemSpec(spec: ItemSpec, fileNo: number, prevItem?: TestItem): [string, TestItem | undefined] {
  let {IN, TITLE, FILE, WIDGET} = spec

  if (prevItem == null) {
    if (IN == null) {
      throw new Error(`First item must have "IN" field!`)
    }
    if (TITLE == null) {
      throw new Error(`First item must have "TITLE" field!`)
    }
  }

  FILE ??= `f${fileNo}.yatt`
  const realfile = IN != null ? FILE : prevItem!.realfile

  WIDGET ??= filename2widgetname(realfile)

  TITLE ??= prevItem!.TITLE

  let testItem: TestItem | undefined
  if (spec.OUT != null) {
    testItem = {
      ...spec,
      kind: 'output',
      realfile, num: fileNo,
      TITLE, FILE, WIDGET,
      OUT: spec.OUT
    }
  } else if (spec.ERROR != null) {
    testItem = {
      ...spec,
      kind: 'error',
      realfile, num: fileNo,
      TITLE, FILE, WIDGET,
      ERROR: spec.ERROR
    }
  } else {
    // none
  }

  return [realfile, testItem]
}

function filename2widgetname(path: string): string {
  return path.replace(/\.\w+$/, '').replaceAll(/\//g, ':')
}

if (import.meta.main) {
  const process = await import('node:process')

  const args = process.argv.slice(2)
  const baseConfig = {
    ext_public: ['.ytjs', '.yatt', '.html']
  }

  for (const fn of args) {
    const {header, testItems, sourceCache} = loadTestItems(fn, {})
    const baseCgen = cgenSession('populator', {
      ...header,
      ...baseConfig,
      sourceCache
    })

    const $yatt = {
      runtime, $public: {}
    }

    for (const item of testItems) {
      console.log(item)
      switch (item.kind) {
        case 'error': {
          assertMatch(await doErrorTest(item, $yatt, baseCgen)
            , new RegExp(item.ERROR))
          break;
        }
        case 'output': {
          assertEquals(await doOutputTest(item, $yatt, baseCgen)
            , item.OUT)
          break;
        }
        default: {
          // NEVER
          break;
        }
      }
    }
  }
}
