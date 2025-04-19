#!/usr/bin/env -S deno test -RE

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parseAsArrayList, parseAsObjectList} from '../src/parse.ts'

const testObjectList = (str: string, expected: any) => {
  const msg = `parseAsObjectList(${JSON.stringify(str)}) -> ${JSON.stringify(expected)}`

  test(msg, () => {
    assertEquals([...parseAsObjectList(str)], expected);
  })

}
const testArrayList = (str: string, expected: any) => {
  const msg = `parseAsArrayList (${JSON.stringify(str)}) -> ${JSON.stringify(expected)}`

  test(msg, () => {
    assertEquals([...parseAsArrayList(str)], expected)
  })

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
`, [{foo: "1", bar: "2", baz: "3"}, {x: "a", y: "b", z: "c"}])

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

`, [["foo", "bar", null, "baz"], ["foo", "after comment", "bar", "2", "baz", "before next chunk.", "qux", null]]
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


`, [{foo: "1", bar: " 2 \n", baz: "3\n"},
    {foo: "1", "bar/bar": "2", "baz.html": "3", "bang-4": "4"},
    {foo: "1", bar: "\n2\n", baz: "3"},
    {x: "1", y: "2"}
]
)

testArrayList(
`foo: 1
bar{
x: 2.1
y: 2.2
}
baz: 3

{
foo: 1
bar: 2
}

`, [
  ["foo", "1",
   "bar", {x: "2.1", y: "2.2"},
   "baz", "3"],
  [{foo: "1", bar: "2"}],
]
)

testArrayList(
`YATT_CONFIG[
special_entities[
- HTML
]
]

stash{
user{
login: foo
}
}

`, [
  ["YATT_CONFIG", ["special_entities", ['HTML']]],
  ["stash", {user: {login: 'foo'}}],
]
)


testArrayList(
`{
foo: 1
bar: 2
- ba z
= #null
}
{
- 
= #null
}
[
= #null
- baz
- bang
]


{
- foo bar
- baz
qux: quux
}

`, [
  [{foo: "1", bar: "2", "ba z": null},
   {"": null},
   [null, 'baz', 'bang']],
  [{"foo bar": "baz", qux: "quux"}]
]
)


testObjectList(
`foo: 1
bar[
- 2.1
, 2.2
- 2.3
]
baz: 3

foo: 1
bar[
- 2.1
{
hoe:
 2.1.1
moe:   2.1.2
}
- 2.3
]
baz: 3

`, [
  {foo: "1", bar: ["2.1", "2.2", "2.3"], baz: "3"},
  {foo: "1",
   bar: ["2.1", {hoe: "2.1.1\n", moe: "2.1.2"}, "2.3"],
   baz: "3"}
]
)

testObjectList(
`#foo
#bar
foo: 1
bar: 
 2
# baz (needs space)
baz:
 3

`, [
  {foo: "1", bar: "2", baz: "3\n"},
]
)

testArrayList(
`chklst[]: 1
chklst[]: 2
chklst[]: 5

`, [
  ['chklst[]', "1", 'chklst[]', "2", 'chklst[]', "5"]
]
)
