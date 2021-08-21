#!/usr/bin/env ts-node

import tap from 'tap'

import {YattConfig} from '../src/config'

import {runSource} from '../src/codegen0/run0'

{
  const it = (filename: string, src: string, config?: YattConfig) =>
    runSource(src, {filename});

  tap.same(it('test', `<yatt:foo x=3 y=8>hoehoe</yatt:foo>
aaa
<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
<div><yatt:BODY/></div>
&yatt:y;`), `<h2>3</h2>
<div>hoehoe</div>
8aaa
`)
}