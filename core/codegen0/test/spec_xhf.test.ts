#!/usr/bin/env -S deno test -RE

import {runtests} from '../src/xhftest.ts'

const __dirname = new URL('.', import.meta.url).pathname

import * as process from 'node:process'

runtests([`${__dirname}/spec_xhf/1-basic.xhf`], {
  debug: {
    codegen: parseInt(process.env["DEBUG_CGEN"] ?? "0", 10),
    declaration: parseInt(process.env["DEBUG_DECL"] ?? "0", 10)
  },
  ext_public: ['.ytjs', '.yatt', '.html'],
  body_argument_name: 'body'
})
