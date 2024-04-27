#!/usr/bin/env -S deno run -A

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {longestPrefixDir, templatePath} from '../src/path.ts'

test("templatePath", () => {
  assertEquals(templatePath('foo/bar/baz.js'), ['baz']);
  assertEquals(templatePath('foo/bar/baz.js', 'foo/'), ['bar', 'baz']);

  assertEquals(templatePath('/tmp/zsh3HWHBX'), ['zsh3HWHBX']);
  assertEquals(templatePath('/usr/src/foo/bar.js', '/usr/src/'), ['foo', 'bar']);
})

test("longestPrefixDir", () => {
  assertEquals(longestPrefixDir(['foo.js', 'foo.js']), '');
  assertEquals(longestPrefixDir(['foo.js', 'bar.js']), '');

  assertEquals(longestPrefixDir(['foo/bar/baz.js', 'foo/bar/qux.js']), 'foo/bar/');
  assertEquals(longestPrefixDir(['foo/bar/baz.js', 'foo/qux.js']), 'foo/');
})
