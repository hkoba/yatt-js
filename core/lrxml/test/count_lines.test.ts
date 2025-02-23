#!/usr/bin/env -S deno test -A

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {lineNumber, extract_line, extract_prefix_spec} from '../src/utils/count_lines.ts'

test("lineNumber: empty string", () => {
  assertEquals(lineNumber(``), 1)
})

test("lineNumber: a line without newline", () => {
  assertEquals(lineNumber(`foo`), 1)
})

test("foo\\nbar", () => {
  assertEquals(lineNumber(`foo
  bar`), 2)
})

test("foo\\nbar\\n", () => {
  assertEquals(lineNumber(`foo
bar
`), 3)
})

test("extract_line: 0, 2", () => {
  assertEquals(extract_line(`01234`, 0, 2), `01234` + `\n ^`)
});

test("extract_line: 4, 2", () => {
  assertEquals(extract_line(`foo
bar
`, 4, 2), `bar` + `\n ^`)
});

test("extract_prefix_spec: 5", () => {
  assertEquals(extract_prefix_spec(`foo
bar
`, 5), [3, 2, 2])
});
