#!/usr/bin/env -S deno run -A

import {assertEquals} from 'https://deno.land/std/assert/mod.ts'

import {lineNumber, extract_line, extract_prefix_spec} from '../src/utils/count_lines.ts'

Deno.test("lineNumber: empty string", () => {
  assertEquals(lineNumber(``), 1)
})

Deno.test("lineNumber: a line without newline", () => {
  assertEquals(lineNumber(`foo`), 1)
})

Deno.test("foo\\nbar", () => {
  assertEquals(lineNumber(`foo
  bar`), 2)
})

Deno.test("foo\\nbar\\n", () => {
  assertEquals(lineNumber(`foo
bar
`), 3)
})

Deno.test("extract_line: 0, 2", () => {
  assertEquals(extract_line(`01234`, 0, 2), `01234` + `\n ^`)
});

Deno.test("extract_line: 4, 2", () => {
  assertEquals(extract_line(`foo
bar
`, 4, 2), `bar` + `\n ^`)
});

Deno.test("extract_prefix_spec: 5", () => {
  assertEquals(extract_prefix_spec(`foo
bar
`, 5), [3, 2, 2])
});
