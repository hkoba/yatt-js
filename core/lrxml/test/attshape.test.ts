#!/usr/bin/env -S deno test -RE

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parse_multipart, parse_template} from '../src/index.ts'

import {attShape, termShape, type AttShape, type TermShape} from '../src/attlist/shape.ts'

{
  const source = `<yatt:foo a="AA" b='BB' c=3.14 d=vname e=[code x="1"] f=&yatt:v; "POS" [get "/route"] &yatt:w; g :::h [i j]="LST">
<:yatt:x>body</:yatt:x>
</yatt:foo>
`

  const src = (node: {start: number, end: number}) =>
    source.substring(node.start, node.end)

  const summary = (s: AttShape): unknown => {
    switch (s.shape) {
      case "identOnly":
        return [s.shape, s.name, s.has_three_colon]
      case "labeled":
        return [s.shape, s.name, termSummary(s.value)]
      case "nestLabeled":
        return [s.shape, s.label.value.map(a => summary(attShape(a))), termSummary(s.value)]
      case "positional":
        return [s.shape, termSummary(s.value)]
      case "attelem":
        return [s.shape, s.path]
    }
  }

  const termSummary = (t: TermShape): unknown => {
    switch (t.shape) {
      case "string":
        return [t.shape, t.text, t.quoted]
      case "ident":
        return [t.shape, t.text, t.has_three_colon]
      case "nest":
        return [t.shape, t.items.map(a => summary(attShape(a)))]
      case "entity":
        // EntNode の range は "&yatt" opener を含まない（":v;" 形になる）
        return [t.shape, src(t.node)]
    }
  }

  const parseFirstElement = () => {
    const [contentList, session] = parse_multipart(source, {debug: {}})
    for (const content of contentList) {
      if (content.kind !== 'text')
        continue
      for (const node of parse_template(session, [content])) {
        if (node.kind === "element")
          return node
      }
    }
    throw new Error("no element node in test source")
  }

  test("attShape: all 5 att shapes x all 4 term shapes", () => {
    const node = parseFirstElement()
    assertEquals(node.attlist.map(a => summary(attShape(a))), [
      ["labeled", "a", ["string", "AA", true]],
      ["labeled", "b", ["string", "BB", true]],
      ["labeled", "c", ["string", "3.14", false]],
      ["labeled", "d", ["ident", "vname", false]],
      ["labeled", "e", ["nest", [
        ["identOnly", "code", false],
        ["labeled", "x", ["string", "1", true]],
      ]]],
      ["labeled", "f", ["entity", ":v;"]],
      ["positional", ["string", "POS", true]],
      ["positional", ["nest", [
        ["identOnly", "get", false],
        ["positional", ["string", "/route", true]],
      ]]],
      ["positional", ["entity", ":w;"]],
      ["identOnly", "g", false],
      ["identOnly", "h", true],
      ["nestLabeled", [
        ["identOnly", "i", false],
        ["identOnly", "j", false],
      ], ["string", "LST", true]],
      ["attelem", ["yatt", "x"]],
    ])
  })

  test("attShape: node keeps source ranges", () => {
    const node = parseFirstElement()
    const a = attShape(node.attlist[0])
    if (a.shape !== "labeled")
      throw new Error(`expected labeled, got ${a.shape}`)
    assertEquals(src(a.node), `"AA"`)      // att 自体の range は値トークン由来
    assertEquals(src(a.nameNode), `a`)
    const g = attShape(node.attlist[9])
    if (g.shape !== "identOnly")
      throw new Error(`expected identOnly, got ${g.shape}`)
    assertEquals(src(g.node), `g`)
  })

  test("termShape: TermShapeOf overload narrows by input type", () => {
    const node = parseFirstElement()
    const l = attShape(node.attlist[11])
    if (l.shape !== "nestLabeled")
      throw new Error(`expected nestLabeled, got ${l.shape}`)
    // l.label は NestedTerm なので、overload により戻り値は nest arm に確定し、
    // narrowing なしで .items が見える
    const ns = termShape(l.label)
    assertEquals(ns.shape, "nest")
    assertEquals(ns.items.length, 2)
  })
}
