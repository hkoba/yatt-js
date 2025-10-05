#!/usr/bin/env -S deno test -RE

import {test as cross_test} from "@cross/test"
import {assertEquals} from '@std/assert'

import { build_template_declaration } from '../src/declaration/template-declaration.ts'

{
  const it = async (src: string) => {
    const template = await build_template_declaration('', src, {entFns: {}});
    const {partMap} = template
    return [...partMap.widget.entries()].map(([name, widget]) => {
      return {name, args: [...widget.argMap.keys()],
              vars: [...widget.varMap.keys()]}
    })
  }

  const test = (src: string, result: any, title?: string) => {
    cross_test(title ?? src, async () => {
      assertEquals(await it(src), result)
    })
  }

  test(`<!yatt:widget foo bar='value/0'>
`, [
  {name: 'foo', args: ['bar', 'BODY'], vars: []}
])

  test(`<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
&yatt:y;

<!yatt:args>
<yatt:foo x=3 y="8"/>
`, [
  {name: 'foo', args: ['x', 'y', 'BODY'], vars: []},
  {name: '', args: ['BODY'], vars: []},
])

  test(`<yatt:foo x=3 y="8"/>

<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
&yatt:y;
`, [
  {name: '', args: ['BODY'], vars: []},
  {name: 'foo', args: ['x', 'y', 'BODY'], vars: []},
])

}

{
  const it = async (src: string) => {
    const template = await build_template_declaration('', src, {entFns: {}});
    const {routeMap} = template
    return [...routeMap.entries()].map(([route, rec]) => {
      return {route, kind: rec.part.kind, name: rec.part.name}
    })
  }

  const test = (src: string, result: any, title?: string) => {
    cross_test(title ?? src, async () => {
      assertEquals(await it(src), result)
    })
  }

  test(`<!yatt:page home="/home">

<!yatt:page user="/user/:uid">
`, [
  {route: "/home", kind: "widget", name: "home"},
  {route: "/user/:uid", kind: "widget", name: "user"},
])
}
