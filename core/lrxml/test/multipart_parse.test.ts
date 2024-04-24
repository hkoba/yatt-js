#!/usr/bin/env -S deno run -A

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parse_multipart, AttItem, hasLabel, isIdentOnly} from '../src/index.ts'

{
  const unnest = (att: AttItem): any => {
    if (isIdentOnly(att)) {
      return att.value
    }
    if (att.kind === 'entity') {
      return att.path
    }
    if (! hasLabel(att)) {
      return att.value
    }
    const label = unnest(att.label)
    if (att.kind === 'nest') {
      return [label, att.value.map(a => unnest(a))]
    }
    else {
      return [label, att.value]
    }
  }

  const it = (src: string) => {
    const [partList, session] = parse_multipart(src, {});
    // console.dir(partList, {depth: null, colors: true})
    return partList.map((part) => {
      // console.dir(part.attlist, {depth: null, colors: true});
      return {kind: part.kind, attlist: part.attlist.map(unnest)}
    })
  };

  test("widget declaration", () => {
    assertEquals(it(`<!yatt:widget foo bar='value/0'>
`), [
  {kind: "widget", attlist: ['foo', ['bar', 'value/0']]}
])})

  test("widget call, declaration and entity reference", () => {
    assertEquals(it(`<yatt:foo x=3 y="8"/>

<!yatt:widget foo x y="?7">
<h2>&yatt:x;</h2>
&yatt:y;

`), [
  {kind: "", attlist: []},
  {kind: "widget", attlist: ['foo', 'x', ['y', '?7']]},
])})

  test("widget declaration with bracket quote", () => {
    assertEquals(it(`<!yatt:widget main title>

<!yatt:widget container main=[delegate]>
`), [
  {kind: "widget", attlist: ['main', 'title']},
  {kind: "widget", attlist: ['container', ['main', ['delegate']]]},
])})
}
