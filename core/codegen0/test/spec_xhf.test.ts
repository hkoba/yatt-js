#!/usr/bin/env -S deno test -RE

import {runtests} from '../src/xhftest.ts'

const __dirname = new URL('.', import.meta.url).pathname

import {expandGlob} from 'jsr:@std/fs/expand-glob'

import * as process from 'node:process'

const args = process.argv.slice(2);

const files = args.length ? args : (await Array.fromAsync(expandGlob(`${__dirname}/spec_xhf/[1-9]*.xhf`))).map((e) => e.path)

runtests(files, {
  debug: {
    codegen: parseInt(process.env["DEBUG_CGEN"] ?? "0", 10),
    declaration: parseInt(process.env["DEBUG_DECL"] ?? "0", 10)
  },
  ext_public: ['.ytjs', '.yatt', '.html'],
  body_argument_name: 'body'
})
