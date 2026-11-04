#!/usr/bin/env -S deno test -RE

import * as util from 'node:util'

import {test} from '@cross/test'
import {assert, assertEquals, assertMatch, assertRejects, assertStringIncludes} from '@std/assert'

import {
  emptyResults, formatSummary, prepareFile, runItem
} from '../src/xhftest.ts'
import type {YattConfig} from '../src/config.ts'

const fixture = new URL('./xhftest_report/failures.xhf', import.meta.url).pathname

const config = (codegen?: number): YattConfig => ({
  debug: {codegen},
  ext_public: ['.ytjs', '.yatt', '.html'],
  body_argument_name: 'body',
  macro: {
    async macro_test_nimpl(ctx) {
      return ctx.NIMPL()
    }
  }
})

// Runs the whole fixture, because follow-on items depend on the earlier ones.
async function collectReports(codegen: number) {
  const results = emptyResults()
  const {testItems, ctx} = prepareFile(fixture, config(codegen), results)

  const reports = new Map<string, string>()
  for (const item of testItems) {
    const error = await assertRejects(() => runItem(item, ctx))
    reports.set(item.TITLE, (error as Error).message)
  }
  return {reports, results}
}

const {reports, results} = await collectReports(1)
const {failures} = results
const NIMPL_SITE = failures.find((f) => f.item.TITLE === 'nimpl')!.nimpl!

// The line of numbered generated code which a stack frame refers to.
function reportedLine(report: string, frame: RegExp): string {
  const lineno = report.match(frame)?.[1]
  const line = report.match(new RegExp(`^ *${lineno}\\| (.*)$`, 'm'))?.[1]
  assert(line, report)
  return line
}

test('report starts with the location of the item in the xhf file', async () => {
  const report = reports.get('runtime throw')!
  assert(report.startsWith('[failures.xhf:5] boom in entity\n'), report)
  assertStringIncludes(report, `spec: ${fixture}:5 (f1.yatt)`)
})

test('stack frames in generated code are readable and match numbered lines', async () => {
  const report = reports.get('runtime throw')!
  assert(!report.includes('base64'), report)
  assertEquals(
    // Deno abbreviates the url in frames, so that only Bun can name the module.
    reportedLine(report, /boom \(<generated(?::[^>]+)?>:(\d+):/),
    'throw new Error("boom in entity");'
  )
})

test('generated code is reported even if it fails to import', async () => {
  const report = reports.get('bad generated code')!
  assert(!report.includes('base64'), report)
  assertStringIncludes(report, '--- generated (public$.f2) ---')
})

test('failure during code generation says that no code exists', async () => {
  const report = reports.get('compile failure')!
  assertStringIncludes(report, '--- IN ---\n  1| <!yatt:args x>\n  2| <yatt:nosuch/>')
  assertStringIncludes(report, '(none: failed before any code was loaded)')
})

test('item after a compile failure points at the root cause', async () => {
  const report = reports.get('compile failure, next param')!
  assert(
    report.startsWith('[failures.xhf:30] follow-on failure: caused by failures.xhf:21: No such widget'),
    report
  )
  assertStringIncludes(report, '--- IN ---\n  1| <!yatt:args x>')
})

test('output mismatch keeps the diff of the assertion', async () => {
  assertStringIncludes(reports.get('wrong output')!, 'Values are not equal')
})

test('DEBUG_CGEN=0 reports only the location, message and stack', async () => {
  const {reports} = await collectReports(0)
  for (const report of reports.values()) {
    assert(!report.includes('--- IN ---'), report)
    assert(!report.includes('--- generated'), report)
  }
})

test('NIMPL report names the place to implement, without the stack', async () => {
  // Older Bun (seen on 1.3.14) has no getCallSites.
  if ('getCallSites' in util) {
    assertMatch(NIMPL_SITE, /^macro_test_nimpl \(core\/codegen0\/test\/xhftest_report\.test\.ts:\d+\)$/)
  }
  const report = reports.get('nimpl')!
  assert(report.startsWith(`[failures.xhf:40] NIMPL: ${NIMPL_SITE} at f5.yatt line `), report)
  assert(!report.includes('--- stack ---'), report)
})

test('item after a NIMPL counts as the same NIMPL', async () => {
  const report = reports.get('nimpl, next param')!
  assert(report.startsWith(`[failures.xhf:49] follow-on failure: caused by failures.xhf:40: NIMPL: ${NIMPL_SITE}`), report)
  assertEquals(failures.find((f) => f.item.TITLE === 'nimpl, next param')?.nimpl, NIMPL_SITE)
})

test('NIMPL is not taken for the error which the item expects', async () => {
  const report = reports.get('nimpl where an error is expected')!
  assert(report.startsWith(`[failures.xhf:55] NIMPL: ${NIMPL_SITE}`), report)
})

test('thrown error has no frames of its own', async () => {
  const {testItems, ctx} = prepareFile(fixture, config(), emptyResults())
  const nimpl = testItems.find((item) => item.TITLE === 'nimpl')!
  const error = await assertRejects(() => runItem(nimpl, ctx))
  // Bun leaves stack undefined when there are no frames.
  const stack = (error as Error).stack ?? ''
  assertEquals(stack.split('\n').filter((l) => /^\s+at /.test(l)), [])
})

test('summary shows coverage and groups failures by cause', async () => {
  const noSuchWidget = failures.find((f) => f.item.TITLE === 'compile failure')!
  const summary = formatSummary({
    passed: 5,
    skipped: 2,
    failures: [
      // The message of a syntax error differs among runtimes.
      ...failures.filter((f) => f.item.TITLE !== 'bad generated code'),
      {...noSuchWidget, message: 'No such widget yatt:nosuch for token element at f9.yatt line 7 column 3'},
    ]
  })
  assertEquals(summary.split('\n'), [
    'spec coverage: 33.3% (5 passed / 15 items): 3 nimpl, 5 other failures, 2 skipped',
    'NIMPL:',
    `   3  ${NIMPL_SITE}`,
    '      failures.xhf:40, failures.xhf:49, failures.xhf:55',
    'Other failures:',
    '   2  No such widget yatt:nosuch for token element',
    '      failures.xhf:21, failures.xhf:21',
    '   1  boom in entity',
    '      failures.xhf:5',
    '   1  follow-on failure',
    '      failures.xhf:30',
    '   1  Values are not equal.',
    '      failures.xhf:36',
  ])
})
