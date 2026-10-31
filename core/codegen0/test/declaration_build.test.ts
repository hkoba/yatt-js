#!/usr/bin/env -S deno test -RE

import {test as cross_test} from "@cross/test"
import {assertEquals, assertRejects} from '@std/assert'

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
    return [...routeMap.entries()].flatMap(([route, entry]) => {
      return [...entry.byMethod.entries()].map(([method, rec]) => {
        return {route, method, kind: rec.part.kind, name: rec.part.name}
      })
    })
  }

  const test = (src: string, result: any, title?: string) => {
    cross_test(title ?? src, async () => {
      assertEquals(await it(src), result)
    })
  }

  const testError = (src: string, msgPart: string, title?: string) => {
    cross_test(title ?? `ERROR ${msgPart}`, async () => {
      await assertRejects(() => it(src), Error, msgPart)
    })
  }

  test(`<!yatt:page home="/home">

<!yatt:page user="/user/:uid">
`, [
  {route: "/home", method: "*", kind: "widget", name: "home"},
  {route: "/user/:uid", method: "*", kind: "widget", name: "user"},
])

  // [method "route"] — デフォルト設定 (DEFAULT_ALLOWED_ROUTE_METHODS) で通ること
  test(`<!yatt:page foo=[get "/foo"]>
`, [
  {route: "/foo", method: "get", kind: "widget", name: "foo"},
])

  // ["route" method method...] — 複数 method、順不同
  test(`<!yatt:page foo=["/foo" get post]>
`, [
  {route: "/foo", method: "get", kind: "widget", name: "foo"},
  {route: "/foo", method: "post", kind: "widget", name: "foo"},
])

  // method は小文字に正規化される
  test(`<!yatt:page foo=[GET "/foo"]>
`, [
  {route: "/foo", method: "get", kind: "widget", name: "foo"},
])

  // 同一 pattern に別 method の handler を共存させられる
  test(`<!yatt:page foo=["/x" get]>

<!yatt:page bar=["/x" post]>
`, [
  {route: "/x", method: "get", kind: "widget", name: "foo"},
  {route: "/x", method: "post", kind: "widget", name: "bar"},
])

  // 無名 part への positional route (method 無指定 = wildcard)
  test(`<!yatt:args "/top">
`, [
  {route: "/top", method: "*", kind: "widget", name: ""},
])

  // 有名 part の positional route spec — 名前は location2name (method suffix つき)
  test(`<!yatt:page ["/m" get]>
`, [
  {route: "/m", method: "get", kind: "widget", name: "_2fm__get"},
])

  testError(`<!yatt:page foo=["/x" get]>

<!yatt:page bar=["/x" get]>
`, `route conflict: get /x`)

  testError(`<!yatt:page foo=[hoge "/foo"]>
`, `Unsupported http method: hoge`)
}
