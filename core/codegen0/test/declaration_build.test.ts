#!/usr/bin/env -S deno test -A

import {test as cross_test} from "@cross/test"
import {assertEquals} from '@std/assert'

import { build_template_declaration } from '../src/declaration/createPart.ts'

{
  const it = (src: string) => {
    const [template, _session] = build_template_declaration('', src, {entFns: {}});
    const {partMap} = template
    return [...partMap.widget.entries()].map(([name, widget]) => {
      return {name, args: [...widget.argMap.keys()],
              vars: [...widget.varMap.keys()]}
    })
  }

  const test = (src: string, result: any, title?: string) => {
    cross_test(title ?? src, () => {
      assertEquals(it(src), result)
    })
  }

  test(`<!yatt:widget foo bar='value/0'>
`, [
  {name: 'foo', args: ['bar', 'BODY'], vars: []}
])

  test(`<!yatt:widget main title>

<!yatt:widget container main=[delegate]>
`, [
  {name: 'main', args: ['title', 'BODY'], vars: []},
  {name: 'container', args: ['title', 'BODY'], vars: ['main']},
])

  test(`<!yatt:widget container main=[delegate]>

<!yatt:widget main title>
`, [
  {name: 'container', args: ['title', 'BODY'], vars: ['main']},
  {name: 'main', args: ['title', 'BODY'], vars: []},
], "reverse order")

  test(`<!yatt:widget container main=[delegate foo baz]>

<!yatt:widget main foo='?xx' bar='/yy' baz>
`, [
  {name: 'container', args: ['foo', 'baz', 'BODY'], vars: ['main']},
  {name: 'main', args: ['foo', 'bar', 'baz', 'BODY'], vars: []},
], "specified only")

   test(`<!yatt:widget container aliased=[delegate:long_widget_name y w]>

<!yatt:widget long_widget_name x y z w>
`, [
  {name: 'container', args: ['y', 'w', 'BODY'], vars: ['aliased']},
  {name: 'long_widget_name', args: ['x', 'y', 'z', 'w', 'BODY'], vars: []},
], "alias")

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
  const it = (src: string) => {
    const [template, _session] = build_template_declaration('', src, {entFns: {}});
    const {routeMap} = template
    return [...routeMap.entries()].map(([route, rec]) => {
      return {route, kind: rec.part.kind, name: rec.part.name}
    })
  }

  const test = (src: string, result: any, title?: string) => {
    cross_test(title ?? src, () => {
      assertEquals(it(src), result)
    })
  }

  test(`<!yatt:page home="/home">

<!yatt:page user="/user/:uid">
`, [
  {route: "/home", kind: "widget", name: "home"},
  {route: "/user/:uid", kind: "widget", name: "user"},
])
}
