#!/usr/bin/env -S deno test -RE

import {test} from '@cross/test'
import {assert, assertEquals, assertRejects, assertStringIncludes} from '@std/assert'

import {
  emptyResults, formatSummary, prepareFile, runItem
} from '../src/xhftest.ts'

const fixture = new URL('./xhftest_report/failures.xhf', import.meta.url).pathname

// Runs the whole fixture, because follow-on items depend on the earlier ones.
async function collectReports(codegen: number) {
  const results = emptyResults()
  const {testItems, ctx} = prepareFile(fixture, {
    debug: {codegen},
    ext_public: ['.ytjs', '.yatt', '.html'],
    body_argument_name: 'body'
  }, results)

  const reports = new Map<string, string>()
  for (const item of testItems) {
    const error = await assertRejects(() => runItem(item, ctx))
    reports.set(item.TITLE, (error as Error).message)
  }
  return {reports, results}
}

const {reports, results} = await collectReports(1)
const {failures} = results
const NIMPL_SITE = 'generate_putargs (core/codegen0/src/codegen0/widget/element/putargs.ts:91)'

test('report starts with the location of the item in the xhf file', async () => {
  const report = reports.get('runtime throw')!
  assert(report.startsWith('[failures.xhf:3] boom in entity\n'), report)
  assertStringIncludes(report, `spec: ${fixture}:3 (f1.yatt)`)
})

test('stack frames in generated code are readable and match numbered lines', async () => {
  const report = reports.get('runtime throw')!
  assert(!report.includes('base64'), report)
  assertStringIncludes(report, '(<generated>:15:')
  assertStringIncludes(report, '15| throw new Error("boom in entity");')
})

test('generated code is reported even if it fails to import', async () => {
  const report = reports.get('bad generated code')!
  assert(!report.includes('base64'), report)
  assertStringIncludes(report, '--- generated (public$.f2) ---')
  assertStringIncludes(report, '<generated:public$.f2>:15:12')
})

test('failure during code generation says that no code exists', async () => {
  const report = reports.get('compile failure')!
  assertStringIncludes(report, '--- IN ---\n  1| <!yatt:args x>\n  2| <yatt:nosuch/>')
  assertStringIncludes(report, '(none: failed before any code was loaded)')
})

test('item after a compile failure points at the root cause', async () => {
  const report = reports.get('compile failure, next param')!
  assert(
    report.startsWith('[failures.xhf:28] follow-on failure: caused by failures.xhf:19: No such widget'),
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
  const report = reports.get('nimpl')!
  assert(report.startsWith(`[failures.xhf:38] NIMPL: ${NIMPL_SITE} at f5.yatt line 1 column 1\n`), report)
  assert(!report.includes('--- stack ---'), report)
  assertEquals(failures.find((f) => f.item.TITLE === 'nimpl')?.nimpl, NIMPL_SITE)
})

test('item after a NIMPL counts as the same NIMPL', async () => {
  const report = reports.get('nimpl, next param')!
  assert(report.startsWith(`[failures.xhf:48] follow-on failure: caused by failures.xhf:38: NIMPL: ${NIMPL_SITE}`), report)
  assertEquals(failures.find((f) => f.item.TITLE === 'nimpl, next param')?.nimpl, NIMPL_SITE)
})

test('NIMPL is not taken for the error which the item expects', async () => {
  const report = reports.get('nimpl where an error is expected')!
  assert(report.startsWith(`[failures.xhf:54] NIMPL: ${NIMPL_SITE}`), report)
})

test('thrown error has no frames of its own', async () => {
  const {testItems, ctx} = prepareFile(fixture, {debug: {}}, emptyResults())
  const nimpl = testItems.find((item) => item.TITLE === 'nimpl')!
  const error = await assertRejects(() => runItem(nimpl, ctx))
  assertEquals((error as Error).stack?.split('\n').filter((l) => /^\s+at /.test(l)), [])
})

test('summary shows coverage and groups failures by cause', async () => {
  const noSuchWidget = failures.find((f) => f.item.TITLE === 'compile failure')!
  const summary = formatSummary({
    passed: 5,
    skipped: 2,
    failures: [
      ...failures,
      {...noSuchWidget, message: 'No such widget yatt:nosuch for token element at f9.yatt line 7 column 3'},
    ]
  })
  assertEquals(summary.split('\n'), [
    'spec coverage: 31.3% (5 passed / 16 items): 3 nimpl, 6 other failures, 2 skipped',
    'NIMPL:',
    `   3  ${NIMPL_SITE}`,
    '      failures.xhf:38, failures.xhf:48, failures.xhf:54',
    'Other failures:',
    '   2  No such widget yatt:nosuch for token element',
    '      failures.xhf:19, failures.xhf:19',
    '   1  boom in entity',
    '      failures.xhf:3',
    '   1  SyntaxError: Expression expected',
    '      failures.xhf:11',
    '   1  follow-on failure',
    '      failures.xhf:28',
    '   1  Values are not equal.',
    '      failures.xhf:34',
  ])
})
