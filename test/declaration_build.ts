#!/usr/bin/env ts-node

import tap from 'tap'

import { build_template_declaration } from '../src/declaration/build'

{
  const it = (src: string) => {
    const [template, _session] = build_template_declaration(src, {});
    const {partMap} = template
    return [...partMap.widget.entries()].map(([name, widget]) => {
      return {name, args: [...widget.argMap.keys()],
              vars: [...widget.varMap.keys()]}
    })
  }

  tap.same(it(`<!yatt:widget foo bar='value/0'>
`), [
  {name: 'foo', args: ['bar'], vars: []}
])

  tap.same(it(`<!yatt:widget main title>

<!yatt:widget container main=[delegate]>
`), [
  {name: 'main', args: ['title'], vars: []},
  {name: 'container', args: ['title'], vars: ['main']},
])

  tap.same(it(`<!yatt:widget container main=[delegate]>

<!yatt:widget main title>
`), [
  {name: 'container', args: ['title'], vars: ['main']},
  {name: 'main', args: ['title'], vars: []},
], "reverse order")

  tap.same(it(`<!yatt:widget container main=[delegate foo baz]>

<!yatt:widget main foo='?xx' bar='/yy' baz>
`), [
  {name: 'container', args: ['foo', 'baz'], vars: ['main']},
  {name: 'main', args: ['foo', 'bar', 'baz'], vars: []},
], "specified only")

   tap.same(it(`<!yatt:widget container aliased=[delegate:long_widget_name y w]>

<!yatt:widget long_widget_name x y z w>
`), [
  {name: 'container', args: ['y', 'w'], vars: ['aliased']},
  {name: 'long_widget_name', args: ['x', 'y', 'z', 'w'], vars: []},
], "alias")

  tap.same(it(`<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
&yatt:y;

<!yatt:args>
<yatt:foo x=3 y="8"/>
`), [
  {name: 'foo', args: ['x', 'y'], vars: []},
  {name: '', args: [], vars: []},
])

  tap.same(it(`<yatt:foo x=3 y="8"/>

<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
&yatt:y;
`), [
  {name: '', args: [], vars: []},
  {name: 'foo', args: ['x', 'y'], vars: []},
])

}

{
  const it = (src: string) => {
    const [template, _session] = build_template_declaration(src, {});
    const {routeMap} = template
    return [...routeMap.entries()].map(([route, rec]) => {
      return {route, kind: rec.part.kind, name: rec.part.name}
    })
  }

  tap.same(it(`<!yatt:page home="/home">

<!yatt:page user="/user/:uid">
`), [
  {route: "/home", kind: "widget", name: "home"},
  {route: "/user/:uid", kind: "widget", name: "user"},
])
}
