#!/usr/bin/env -S deno test -RE

import {test} from '@cross/test'
import {assert, assertEquals, assertRejects, assertStringIncludes} from '@std/assert'

import {
  formatSummary, prepareFile, runItem, type Failure
} from '../src/xhftest.ts'

const fixture = new URL('./xhftest_report/failures.xhf', import.meta.url).pathname

// Runs the whole fixture, because follow-on items depend on the earlier ones.
async function collectReports(codegen: number) {
  const failures: Failure[] = []
  const {testItems, ctx} = prepareFile(fixture, {
    debug: {codegen},
    ext_public: ['.ytjs', '.yatt', '.html'],
    body_argument_name: 'body'
  }, failures)

  const reports = new Map<string, string>()
  for (const item of testItems) {
    const error = await assertRejects(() => runItem(item, ctx))
    reports.set(item.TITLE, (error as Error).message)
  }
  return {reports, failures}
}

const {reports, failures} = await collectReports(1)

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

test('summary groups failures by cause, ignoring template positions', async () => {
  const summary = formatSummary([
    ...failures.slice(0, 1),
    ...failures.slice(2, 3),
    {...failures[2], message: 'No such widget yatt:nosuch for token element at f9.yatt line 7 column 3'},
    ...failures.slice(3, 4)
  ])
  assertEquals(summary.split('\n'), [
    '   2  No such widget yatt:nosuch for token element',
    '      failures.xhf:19, failures.xhf:19',
    '   1  boom in entity',
    '      failures.xhf:3',
    '   1  follow-on failure',
    '      failures.xhf:28',
  ])
})
