#!/usr/bin/env ts-node

import tap from 'tap'

import {parseAsArrayList, parseAsObjectList} from '../src/parse'

const testObjectList = (str: string, expected: any) => {
  const msg = `parseAsObjectList(${JSON.stringify(str)}) -> ${JSON.stringify(expected)}`
  tap.same(parseAsObjectList(str), expected, msg)
}
const testArrayList = (str: string, expected: any) => {
  const msg = `parseAsArrayList (${JSON.stringify(str)}) -> ${JSON.stringify(expected)}`
  tap.same(parseAsArrayList(str), expected, msg)
}

{
  testObjectList(``, [])
  testArrayList(``, [])

  testObjectList(`foo: bar`, [{foo: "bar"}])
  testArrayList(`foo: bar`, [["foo", "bar"]])

  testObjectList(`foo: bar\n\n`, [{foo: "bar"}])
  testArrayList(`foo: bar\n\n`, [["foo", "bar"]])

  testArrayList("- foo\n\n- bar", [["foo"], ["bar"]])
}

testObjectList(
`foo: 1
bar: 2
baz: 3

x: a
y: b
z: c
`, [{foo: 1, bar: 2, baz: 3}, {x: "a", y: "b", z: "c"}])

testArrayList(
`- foo
- bar
= #undef
- baz

# -*- mode: xhf; coding: utf-8 -*-
foo: after comment
bar: 2
baz: before next chunk.
qux= #null

`, [["foo", "bar", null, "baz"], ["foo", "after comment", "bar", 2, "baz", "before next chunk.", "qux", null]]
)


testObjectList(
`foo: 1
bar:
  2 
baz:
 3

foo: 1
bar/bar: 2
baz.html: 3
bang-4: 4

foo:   1   
bar:
 
 2
baz: 
 3


x: 1
y: 2


`, [{foo: 1, bar: " 2 \n", baz: 3},
    {foo: 1, "bar/bar": 2, "baz.html": 3, "bang-4": 4},
    {foo: 1, bar: "\n2\n", baz: 3},
    {x: 1, y: 2}
]
)
