#!/usr/bin/env ts-node

import tap from 'tap'

import {lineNumber, extract_line, extract_prefix_spec} from '../src/utils/count_lines'

tap.same(lineNumber(``), 1)

tap.same(lineNumber(`foo`), 1)

tap.same(lineNumber(`foo
bar`), 2)

tap.same(lineNumber(`foo
bar
`), 3)

tap.same(extract_line(`01234`, 0, 2), `01234` + `\n ^`);

tap.same(extract_line(`foo
bar
`, 4, 2), `bar` + `\n ^`);

tap.same(extract_prefix_spec(`foo
bar
`, 5), [3, 2, 2]);
