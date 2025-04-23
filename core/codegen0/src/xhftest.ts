#!/usr/bin/env -S deno run -RE

import {test} from '@cross/test'
import {} from '@std/assert'

import {readFileSync} from 'node:fs'

import {parseAsObjectList} from '@yatt/xhf'

import type {YattConfig} from './config.ts'

import { cgenSession, freshCGenSession } from "./codegen0/context.ts"
import { refresh_populator } from "./codegen0/populator/loader.ts"
import { SourceLoader } from "./declaration/registry.ts" 
import { runtime } from "./yatt.ts"

export type Header = {
  YATT_CONFIG?: string[]

  encoding?: string
  YATT_RC?: string
  ONLY_UTF8?: string
}

export type TestItem = Required<ItemSpecBase> & ItemSpec & {
  realfile: string
  num: number
}

export type ItemSpecBase = {
  FILE?: string
  TITLE?: string
  WIDGET?: string
}

export type ItemSpec = ItemSpecBase & {
  IN?: string
  PARAM?: string
} & ({OUT?: string} | {ERROR?: string})

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

export async function runtest(files: string[], baseConfig: YattConfig): Promise<void> {
  for (const fn of files) {
    console.log('=====', fn)
    const xhf_content = readFileSync(fn, {encoding: "utf-8"})
    const xhf_stream = parseAsObjectList(xhf_content, {header: true})
    const header = xhf_stream.next()?.value as Header
    console.log('header: ', header)
    
    const baseCgen = cgenSession('populator', baseConfig)
    
    const now = Date.now()
    let fileNo = 0
    const testItems: TestItem[] = []
    for (const item of (xhf_stream as Generator<ItemSpec>)) {
      let {IN, TITLE, FILE, WIDGET} = item

      if (! testItems.length) {
        if (IN == null) {
          throw new Error(`First item must have "IN" field!`)
        }
        if (TITLE == null) {
          throw new Error(`First item must have "TITLE" field!`)
        }
      }
      if (IN != null) {
        ++fileNo
      }
      FILE ??= `f${fileNo}.yatt`
      const realfile = IN != null ? FILE : testItems[testItems.length-1].realfile

      WIDGET ??= filename2widgetname(realfile)

      if (IN != null) {
        baseCgen.sourceCache.setFile(FILE, IN, now)
      }

      TITLE ??= testItems[testItems.length-1].TITLE

      const testItem = {
        ...item,
        realfile, num: fileNo,
        IN, TITLE, FILE, WIDGET
      }

      testItems.push(testItem)
    }

    const $yatt = {
      runtime, $public: {}
    }

    // deno.test に入れないと！
    for (const item of testItems) {
      // console.log(item)
      try {
        const cgen = freshCGenSession(baseCgen)
        const $this = await refresh_populator(
          item.FILE, {...cgen, $yatt}
        )

        if (! $this) {
          console.warn(`Can't compile ${item.TITLE}`)

          continue
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

        console.log('output:', CON.buffer)
      } catch (err) {
        console.log(`catch error:`, err)
      }
    }
  }
}

function filename2widgetname(path: string): string {
  return path.replace(/\.\w+$/, '').replaceAll(/\//g, ':')
}

if (import.meta.main) {
  const process = await import('node:process')

  const args = process.argv.slice(2)

  await runtest(args, {})
}
