#!/usr/bin/env ts-node

import tap from 'tap'

import {YattConfig} from '../src/config'

import {runSource} from '../src/codegen0/namespace/run0'

{
  const it = (filename: string, src: string, _config?: YattConfig) =>
    runSource(src, {filename, connectionTypeName: 'yatt.runtime.Connection'});

  tap.test(`basic`, t => {
    t.same(it('widget', `<yatt:foo x=3 y=8>hoehoe</yatt:foo>
aaa
<!yatt:widget foo x y>
<h2>&yatt:x;</h2>
<div><yatt:BODY/></div>
&yatt:y;`), `<h2>3</h2>
<div>hoehoe</div>
8aaa
`)

    if (0) {
      t.same(it(`entity`, `&yatt:sum(3,8);
        <!yatt:entity sum x y>
        return (x ?? 0) + (y ?? 0);
                `), `11`)
    }

    t.end()
  })

}
