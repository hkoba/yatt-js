#!/usr/bin/env -S deno run -RE

import {test} from '@cross/test'
import {assertEquals, assertMatch, fail} from '@std/assert'

import {readFileSync} from 'node:fs'
import {basename} from 'node:path'

import {parseAsObjectListWithLineno} from '@yatt/xhf'

import type {YattConfig} from './config.ts'

import { cgenSettings, freshCGenSession, type CGenSettings } from "./codegen0/context.ts"
import {
Populator,
  refresh_populator, textToBase64, type Connection, type $yattType
} from "./codegen0/populator/loader.ts"
import type { OutputRecord } from "./declaration/index.ts"
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
  OUT_JS?: string
  ERROR?: string
}

export type TestItem = TestItemOk | TestItemError

export interface TestItemBase {
  kind: 'output' | 'error'
  realfile: string
  num: number

  // Where this item was written. Used to report failures.
  xhfFile: string
  lineno: number

  BREAK: boolean

  FILE: string
  IN: string
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

export type Failure = {item: TestItem, message: string}

type CompileFailure = {item: TestItem, message: string}

/** What runItem needs for the items of one xhf file. */
export type RunContext = {
  $yatt: $yattType
  baseCgen: CGenSettings
  // Failures of every xhf file. Shared across RunContexts for the summary.
  failures: Failure[]
  // realfile -> the failure which left it without a loaded handler.
  compileFailures: Map<string, CompileFailure>
}

type RunHooks = {
  onOutput: (output: OutputRecord) => void
  onCompileError: (error: unknown) => void
}

export function runtests(files: string[], baseConfig: YattConfig): void {

  const failures: Failure[] = []

  for (const fn of files) {
    // console.log('=====', fn)

    const {testItems, ctx} = prepareFile(fn, baseConfig, failures)

    // console.log(`testItems: `, testItems);

    for (const item of testItems) {
      // console.log(item)

      test(testTitle(item), async () => {
        await runItem(item, ctx)
      })
    }
  }

  // Tests run in registration order, so this sees the result of all of them
  // and its output lands right before deno's ERRORS section.
  test('xhf failure summary', () => {
    const summary = formatSummary(failures)
    if (summary) {
      console.log(summary)
    }
  })
}

export function prepareFile(fn: string, baseConfig: YattConfig, failures: Failure[]): {
  testItems: TestItem[], ctx: RunContext
} {
  const {header, sourceCache, testItems} = loadTestItems(fn, {})

  const baseCgen = cgenSettings('populator', {
    ...header,
    ...baseConfig,
    sourceCache
  })

  const $yatt = {
    runtime, public$: {}
  }

  return {
    testItems,
    ctx: {$yatt, baseCgen, failures, compileFailures: new Map()}
  }
}

/**
 * Runs one item. On failure, this throws an error which carries everything
 * needed to investigate it, because the runner reports failures long after
 * the test ran.
 */
export async function runItem(item: TestItem, ctx: RunContext): Promise<void> {
  if (item.BREAK) {
    debugger;
  }

  const outputs: OutputRecord[] = []
  const hooks: RunHooks = {
    onOutput(output) {
      outputs.push(output)
    },
    onCompileError(error) {
      ctx.compileFailures.set(item.realfile, {item, message: errorMessage(error)})
    }
  }

  try {
    switch (item.kind) {
      case 'error': {
        assertMatch(await doErrorTest(item, ctx.$yatt, ctx.baseCgen, hooks)
          , new RegExp(item.ERROR))
        break;
      }
      case 'output': {
        assertEquals(await doOutputTest(item, ctx.$yatt, ctx.baseCgen, hooks)
          , item.OUT)
        break;
      }
      default: {
        // NEVER
        break;
      }
    }
  } catch (error) {
    const message = failureMessage(item, error, ctx)
    ctx.failures.push({item, message})
    throw new Error(formatReport(item, message, error, outputs, debugCgen(ctx)))
  }
}

function debugCgen(ctx: RunContext): number {
  return ctx.baseCgen.params.debug.codegen ?? 0
}

class MissingEntryError extends Error {}

function failureMessage(item: TestItem, error: unknown, ctx: RunContext): string {
  const prior = ctx.compileFailures.get(item.realfile)
  if (error instanceof MissingEntryError && prior && prior.item !== item) {
    return `${FOLLOW_ON}: caused by ${itemLocation(prior.item)}: ${prior.message}`
  }
  return errorMessage(error)
}

const FOLLOW_ON = 'follow-on failure'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function itemLocation(item: TestItemBase): string {
  return `${basename(item.xhfFile)}:${item.lineno}`
}

// The report replaces the original error rather than wrapping it as `cause`,
// because deno prints a cause's stack frames with their data: urls intact.
function formatReport(
  item: TestItem,
  message: string,
  error: unknown,
  outputs: OutputRecord[],
  debugLevel: number
): string {
  const report = [
    `[${itemLocation(item)}] ${message}`,
    `  spec: ${item.xhfFile}:${item.lineno} (${item.realfile})`
  ]

  if (debugLevel >= 1) {
    report.push(`  --- IN ---`, numberLines(item.IN))
    if (outputs.length) {
      for (const output of outputs) {
        report.push(
          `  --- generated (${moduleLabel(output)}) ---`,
          numberLines(output.output.outputText)
        )
      }
    } else {
      report.push(`  --- generated ---`, `  (none: failed before any code was loaded)`)
    }
  }

  const frames = stackFrames(error)
  if (frames.length) {
    report.push(`  --- stack ---`, ...frames)
  }

  return hideGeneratedModules(report.join('\n'), outputs)
}

function stackFrames(error: unknown): string[] {
  const stack = error instanceof Error ? error.stack ?? '' : ''
  return stack.split('\n').filter((line) => /^\s+at /.test(line))
}

function moduleLabel({runtimeNamespace, modName}: OutputRecord): string {
  return `${runtimeNamespace}$.${modName}`
}

function numberLines(text: string): string {
  const lines = text.replace(/\n$/, '').split('\n')
  const width = String(lines.length).length
  return lines.map(
    (line, i) => `  ${String(i + 1).padStart(width)}| ${line}`
  ).join('\n')
}

// Generated modules are imported from data: urls, which take a whole screen.
// Error messages have the full url, so its module can be named. Stack frames
// have it abbreviated by deno, leaving only the part common to all modules.
function hideGeneratedModules(text: string, outputs: OutputRecord[]): string {
  for (const output of outputs) {
    const url = `data:text/typescript;base64,${textToBase64(output.output.outputText)}`
    text = text.replaceAll(url, `<generated:${moduleLabel(output)}>`)
  }
  return text.replaceAll(/data:text\/typescript;base64,[A-Za-z0-9+\/=.]+/g, '<generated>')
}

/** Groups failures by cause, to show which fix would resolve how many items. */
export function formatSummary(failures: Failure[]): string {
  const groups = new Map<string, TestItem[]>()
  for (const {item, message} of failures) {
    const cause = failureCause(message)
    groups.set(cause, [...groups.get(cause) ?? [], item])
  }

  return [...groups.entries()]
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([cause, items]) =>
      `${String(items.length).padStart(4)}  ${cause}\n` +
        `      ${items.map(itemLocation).join(', ')}`
    ).join('\n')
}

function failureCause(message: string): string {
  if (message.startsWith(FOLLOW_ON)) {
    return FOLLOW_ON
  }
  return message.split('\n')[0]
    // The position in the template differs for each item.
    .replace(/ at \S+ line \d+ column \d+$/, '')
    .replace(/\S*\/(?=[^\s\/]+\.ts\b)/g, '')
}

function testTitle(item: TestItem): string {
  return `${itemLocation(item)} [${filename2widgetname(item.realfile)}] ${itemTitle(item)}`
}

function itemTitle(item: TestItemBase, params?: string[]): string {
  let msg = item.TITLE
  if (item.PARAM) {
    msg += ": " + JSON.stringify(params ?? item.PARAM)
  }
  return msg
}

async function compileItem(
  item: TestItemBase,
  $yatt: $yattType,
  baseCgen: CGenSettings,
  hooks?: RunHooks
): Promise<Populator | undefined> {
  const cgen = freshCGenSession(baseCgen)
  try {
    return await refresh_populator(
      item.FILE, {...cgen, $yatt, onOutput: hooks?.onOutput}
    )
  } catch (error) {
    hooks?.onCompileError(error)
    throw error
  }
}

export async function doErrorTest(
  item: TestItemError & {kind: 'error'},
  $yatt: $yattType,
  baseCgen: CGenSettings,
  hooks?: RunHooks
): Promise<string> {
  let entry
  try {
    entry = await compileItem(item, $yatt, baseCgen, hooks)
  } catch (error) {
    if (! (error instanceof Error)) {
      throw error
    }
    return error.message
  }

  if (! entry) {
    throw new MissingEntryError(`FAILED to compile: ${item.TITLE}`)
  }

  try {
    await runCompiledWidget(item, $yatt, entry)
  } catch (error) {
    if (! (error instanceof Error)) {
      throw error
    }
    return error.message
  }

  fail(`Failed to detect error: ${item.TITLE}`)
}

export async function doOutputTest(
  item: TestItemOk & {kind: 'output'},
  $yatt: $yattType,
  baseCgen: CGenSettings,
  hooks?: RunHooks
): Promise<string> {
  const entry = await compileItem(item, $yatt, baseCgen, hooks)
  if (! entry) {
    throw new MissingEntryError(`FAILED to compile: ${item.TITLE}`)
  }

  return await runCompiledWidget(item, $yatt, entry)
}

async function runCompiledWidget(
  item: TestItemOk & {kind: 'output'} | TestItemError,
  $yatt: $yattType,
  entry: Populator
): Promise<string> {
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

  await $this.render_(CON, params)

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
  const xhf_stream = parseAsObjectListWithLineno(xhf_content, {header: true})
  const header = xhf_stream.next()?.value?.value as Header
  // console.log('header: ', header)

  const sourceCache = new SourceRegistry(config);

  const now = Date.now()
  let fileNo = 0
  const testItems: TestItem[] = []
  for (const {lineno, value} of xhf_stream) {
    const item = value as ItemSpec
    if (item.IN != null) {
      ++fileNo
    }

    if (item.SKIP) {
      const lastTestItem = testItems[testItems.length - 1]
      let title = item.TITLE ?? (lastTestItem ? itemTitle(lastTestItem, item.PARAM) : fileNo)
      if (item.SKIP !== "1") {
        title += ": " + item.SKIP
      }
      console.warn(`SKIP: ${basename(fn)}:${lineno} ${title}`)
      continue
    }

    const [realfile, testItem] = parseTestItemSpec(
      item, fileNo, {xhfFile: fn, lineno}, testItems[testItems.length-1]
    )

    if (item.IN != null) {
      sourceCache.setFile(realfile, item.IN, now, item.TITLE)
    }

    if (testItem) {
      testItems.push(testItem)
    }
  }

  return {header, testItems, sourceCache}
}

export function parseTestItemSpec(
  spec: ItemSpec,
  fileNo: number,
  location: {xhfFile: string, lineno: number},
  prevItem?: TestItem
): [string, TestItem | undefined] {
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
  IN ??= prevItem!.IN

  let testItem: TestItem | undefined
  const out = spec.OUT_JS ?? spec.OUT
  if (out != null) {
    testItem = {
      ...spec,
      BREAK,
      kind: 'output',
      ...location,
      realfile, num: fileNo,
      IN, TITLE, FILE, WIDGET,
      OUT: out
    }
  } else if (spec.ERROR != null) {
    testItem = {
      ...spec,
      BREAK,
      kind: 'error',
      ...location,
      realfile, num: fileNo,
      IN, TITLE, FILE, WIDGET,
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
    const {testItems, ctx} = prepareFile(fn, baseConfig, [])

    for (const item of testItems) {
      console.log(item)
      await runItem(item, ctx)
    }
  }
}
