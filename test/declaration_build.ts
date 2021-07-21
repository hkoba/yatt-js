#!/usr/bin/env ts-node

import tap from 'tap'

import { build_template_declaration } from '../src/declaration/build'

{
  const it = (src: string) => {
    const [template, _session] = build_template_declaration(src, {});
    const {partMap} = template
    return [...partMap.widget.entries()].map(([name, widget]) => {
      return {name, args: [...widget.argMap.keys()]}
    })
  }

  tap.same(it(`<!yatt:widget main title>

<!yatt:widget container main=[delegate]>
`), [
  {name: 'main', args: ['title']},
  {name: 'container', args: ['title']},
])
}
