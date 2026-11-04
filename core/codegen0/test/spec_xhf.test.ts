#!/usr/bin/env -S deno test -RE

import {runtests} from '../src/xhftest.ts'

const __dirname = new URL('.', import.meta.url).pathname

import {globSync} from 'node:fs'

import * as process from 'node:process'

const args = process.argv.slice(2);

const files = args.length ? args : globSync(`${__dirname}/spec_xhf/[1-9]*.xhf`)

runtests(files, {
  debug: {
    codegen: parseInt(process.env["DEBUG_CGEN"] ?? "0", 10),
    declaration: parseInt(process.env["DEBUG_DECL"] ?? "0", 10)
  },
  ext_public: ['.ytjs', '.yatt', '.html'],
  body_argument_name: 'body'
})
