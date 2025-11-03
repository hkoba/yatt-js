#!/usr/bin/env -S deno run -RE

import {test} from '@cross/test'
import {assertEquals, assertMatch, fail} from '@std/assert'

import {readFileSync} from 'node:fs'

import {parseAsObjectList} from '@yatt/xhf'

import type {YattConfig} from './config.ts'

import { cgenSettings, freshCGenSession, type CGenSettings } from "./codegen0/context.ts"
import {
Populator,
  refresh_populator, type Connection, type typeof$yatt
} from "./codegen0/populator/loader.ts"
import { SourceRegistry, type SourceConfig } from "./declaration/registry.ts"
import { runtime } from "./yatt.ts"

export type Header = {
  YATT_CONFIG?: string[]

  encoding?: string
  YATT_RC?: string
  ONLY_UTF8?: string
}

export interface ItemSpec {
  SKIP?: string
  BREAK?: string

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

  BREAK: boolean

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

    const baseCgen = cgenSettings('populator', {
      ...header,
      ...baseConfig,
      sourceCache
    })

    const $yatt = {
      runtime, $public: {}
    }

    // console.log(`testItems: `, testItems);

    for (const item of testItems) {
      // console.log(item)

      test(testTitle(item), async () => {
        // const cgen = freshCGenSession(baseCgen)
        if (item.BREAK) {
          debugger;
        }

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

function testTitle(item: TestItemBase, params?: string[]): string {
  let msg = item.TITLE
  if (item.PARAM) {
    msg += ": " + JSON.stringify(params ?? item.PARAM)
  }
  return msg
}

export async function doErrorTest(
  item: TestItemError & {kind: 'error'},
  $yatt: typeof$yatt,
  baseCgen: CGenSettings
): Promise<string> {
  const cgen = freshCGenSession(baseCgen)

  let entry
  try {
    entry = await refresh_populator(
      item.FILE, {...cgen, $yatt}
    )
  } catch (error) {
    if (! (error instanceof Error)) {
      throw error
    }
    return error.message
  }

  if (entry) {
    try {
      runCompiledWidget(item, $yatt, entry)
    } catch (error) {
      if (! (error instanceof Error)) {
        throw error
      }
      return error.message
    }
  }

  fail(`Failed to detect error: ${item.TITLE}`)
}

export async function doOutputTest(
  item: TestItemOk & {kind: 'output'},
  $yatt: typeof$yatt,
  baseCgen: CGenSettings
): Promise<string> {
  const cgen = freshCGenSession(baseCgen)

  const entry = await refresh_populator(
    item.FILE, {...cgen, $yatt}
  )
  if (! entry) {
    fail(`FAILED to compile: ${item.TITLE}`)
  }

  return runCompiledWidget(item, $yatt, entry)
}

function runCompiledWidget(
  item: TestItemOk & {kind: 'output'} | TestItemError,
  $yatt: typeof$yatt,
  entry: Populator
): string {
  const {$this, template} = entry

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
  // item.PARAMS を引数列に map しないと…
  // そのためには、位置引数が必要…

  const widget = template.partMap.widget.get('')!

  const params: {[k: string]: any} = {}

  if (item.PARAM) {
    for (const [name, varSpec] of widget.argMap.entries()) {
      if (varSpec.argNo != null && varSpec.argNo < item.PARAM.length) {
        params[name] = item.PARAM[varSpec.argNo]
      }
    }
    // console.log(`params(${item.TITLE}):`, params, 'from', item.PARAM)
  }

  $this.render_(CON, params)

  return CON.buffer
}

export function loadTestItems(fn: string, config: SourceConfig): {
  header: Header,
  testItems: TestItem[],
  sourceCache: SourceRegistry
} {
  
  config.sourceLoader = undefined;
  config.sourceTester = undefined;

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
      const lastTestItem = testItems[testItems.length - 1]
      let title = item.TITLE ?? (lastTestItem ? testTitle(lastTestItem, item.PARAM) : fileNo)
      if (item.SKIP !== "1") {
        title += ": " + item.SKIP
      }
      console.warn(`SKIP: ${title}`)
      continue
    }

    const [realfile, testItem] = parseTestItemSpec(item, fileNo, testItems[testItems.length-1])

    if (item.IN != null) {
      sourceCache.setFile(realfile, item.IN, now, item.TITLE)
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

  const BREAK: boolean = spec.BREAK ? true : false;

  FILE ??= `f${fileNo}.yatt`
  const realfile = IN != null ? FILE : prevItem!.realfile

  WIDGET ??= filename2widgetname(realfile)

  TITLE ??= prevItem!.TITLE

  let testItem: TestItem | undefined
  if (spec.OUT != null) {
    testItem = {
      ...spec,
      BREAK,
      kind: 'output',
      realfile, num: fileNo,
      TITLE, FILE, WIDGET,
      OUT: spec.OUT
    }
  } else if (spec.ERROR != null) {
    testItem = {
      ...spec,
      BREAK,
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
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0

  const args = process.argv.slice(2)
  const baseConfig = {
    ext_public: ['.ytjs', '.yatt', '.html'],
    debug: { declaration: debugLevel }
  }

  for (const fn of args) {
    const {header, testItems, sourceCache} = loadTestItems(fn, {})
    const baseCgen = cgenSettings('populator', {
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
