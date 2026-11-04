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
import { NimplError } from "./deps.ts"
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

export type Failure = {
  item: TestItem
  message: string
  // Set if the cause is a ctx.NIMPL(): its place in the source of this project.
  nimpl?: string
}

/** Outcome of all the xhf files. */
export type Results = {
  passed: number
  skipped: number
  failures: Failure[]
}

export function emptyResults(): Results {
  return {passed: 0, skipped: 0, failures: []}
}

type CompileFailure = {item: TestItem, error: unknown}

/** What runItem needs for the items of one xhf file. */
export type RunContext = {
  $yatt: $yattType
  baseCgen: CGenSettings
  // Shared across RunContexts for the summary.
  results: Results
  // realfile -> the failure which left it without a loaded handler.
  compileFailures: Map<string, CompileFailure>
}

type RunHooks = {
  onOutput: (output: OutputRecord) => void
  onCompileError: (error: unknown) => void
}

export function runtests(files: string[], baseConfig: YattConfig): void {

  const results = emptyResults()

  for (const fn of files) {
    // console.log('=====', fn)

    const {testItems, ctx} = prepareFile(fn, baseConfig, results)

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
  test('xhf spec coverage', () => {
    console.log(formatSummary(results))
  })
}

export function prepareFile(fn: string, baseConfig: YattConfig, results: Results): {
  testItems: TestItem[], ctx: RunContext
} {
  const {header, sourceCache, testItems, skipped} = loadTestItems(fn, {})

  results.skipped += skipped

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
    ctx: {$yatt, baseCgen, results, compileFailures: new Map()}
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
      ctx.compileFailures.set(item.realfile, {item, error})
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
    const failure = describeFailure(item, error, ctx)
    ctx.results.failures.push(failure)
    throw errorWithoutStack(
      formatReport(failure, error, outputs, debugCgen(ctx))
    )
  }

  ctx.results.passed++
}

// The frames of the thrown error would only point here. The report has the
// stack of the original error if it is worth showing.
function errorWithoutStack(message: string): Error {
  const limit = Error.stackTraceLimit
  Error.stackTraceLimit = 0
  try {
    return new Error(message)
  } finally {
    Error.stackTraceLimit = limit
  }
}

function debugCgen(ctx: RunContext): number {
  return ctx.baseCgen.params.debug.codegen ?? 0
}

class MissingEntryError extends Error {}

function describeFailure(item: TestItem, error: unknown, ctx: RunContext): Failure {
  const prior = ctx.compileFailures.get(item.realfile)
  if (error instanceof MissingEntryError && prior && prior.item !== item) {
    return {
      item,
      message: `${FOLLOW_ON}: caused by ${itemLocation(prior.item)}: ${errorMessage(prior.error)}`,
      nimpl: nimplSite(prior.error)
    }
  }
  return {item, message: errorMessage(error), nimpl: nimplSite(error)}
}

const FOLLOW_ON = 'follow-on failure'

function errorMessage(error: unknown): string {
  if (error instanceof NimplError) {
    const kind = error.itemKind ? ` [${error.itemKind}]` : ''
    return `NIMPL: ${nimplSite(error)}${kind}${error.location}`
  }
  return error instanceof Error ? error.message : String(error)
}

const projectRoot = new URL('../../../', import.meta.url).pathname

function nimplSite(error: unknown): string | undefined {
  if (! (error instanceof NimplError)) {
    return undefined
  }
  if (! error.site) {
    return error.message
  }
  const {functionName, scriptName, lineNumber} = error.site
  const script = scriptName.replace(/^file:\/\//, '').replace(projectRoot, '')
  return `${functionName} (${script}:${lineNumber})`
}

function itemLocation(item: TestItemBase): string {
  return `${basename(item.xhfFile)}:${item.lineno}`
}

// The report replaces the original error rather than wrapping it as `cause`,
// because deno prints a cause's stack frames with their data: urls intact.
function formatReport(
  {item, message, nimpl}: Failure,
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

  // nimpl already tells where it is. The rest is just the generator's call chain.
  const frames = nimpl && debugLevel < 2 ? [] : stackFrames(error)
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

/**
 * Coverage of the spec, followed by the failures grouped by cause to show
 * which fix would resolve how many items.
 */
export function formatSummary({passed, skipped, failures}: Results): string {
  const nimpl = failures.filter((f) => f.nimpl != null)
  const others = failures.filter((f) => f.nimpl == null)
  const total = passed + skipped + failures.length
  const percent = total ? (passed / total * 100).toFixed(1) : '0.0'

  return [
    `spec coverage: ${percent}% (${passed} passed / ${total} items)`
      + `: ${nimpl.length} nimpl, ${others.length} other failures, ${skipped} skipped`,
    ...formatGroups('NIMPL:', nimpl, (f) => f.nimpl!),
    ...formatGroups('Other failures:', others, (f) => failureCause(f.message)),
  ].join('\n')
}

function formatGroups(
  heading: string, failures: Failure[], causeOf: (failure: Failure) => string
): string[] {
  const groups = new Map<string, TestItem[]>()
  for (const failure of failures) {
    const cause = causeOf(failure)
    groups.set(cause, [...groups.get(cause) ?? [], failure.item])
  }

  const lines = [...groups.entries()]
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([cause, items]) =>
      `${String(items.length).padStart(4)}  ${cause}\n` +
        `      ${items.map(itemLocation).join(', ')}`
    )
  return lines.length ? [heading, ...lines] : []
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
    if (! isExpectedError(error)) {
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
    if (! isExpectedError(error)) {
      throw error
    }
    return error.message
  }

  fail(`Failed to detect error: ${item.TITLE}`)
}

// NIMPL is not the error the item expects, whatever ERROR says.
function isExpectedError(error: unknown): error is Error {
  return error instanceof Error && ! (error instanceof NimplError)
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
  sourceCache: SourceRegistry,
  skipped: number
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
  let skipped = 0
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
      skipped++
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

  return {header, testItems, sourceCache, skipped}
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
    const {testItems, ctx} = prepareFile(fn, baseConfig, emptyResults())

    for (const item of testItems) {
      console.log(item)
      await runItem(item, ctx)
    }
  }
}
