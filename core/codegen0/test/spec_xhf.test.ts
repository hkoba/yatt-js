#!/usr/bin/env -S deno test -RE

import {runtests} from '../src/xhftest.ts'

const __dirname = new URL('.', import.meta.url).pathname

runtests([`${__dirname}/spec_xhf/1-basic.xhf`], {
  ext_public: ['.ytjs', '.yatt', '.html'],
  body_argument_name: 'body'
})

