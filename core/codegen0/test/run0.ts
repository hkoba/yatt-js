#!/usr/bin/env ts-node

import tap from 'tap'

import {YattConfig} from '../src/config'

import {runSource} from '../src/codegen0/namespace/run0'

(async () => {
  const it = async (filename: string, src: string, config?: YattConfig) =>
    await runSource(src, {filename, connectionTypeName: 'yatt.runtime.Connection'});

  tap.test(`basic`, async t => {
    t.same(await it('test', `<yatt:foo x=3 y=8>hoehoe</yatt:foo>
aaa
<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
<div><yatt:BODY/></div>
&yatt:y;`), `<h2>3</h2>
<div>hoehoe</div>
8aaa
`)
  })

})()
