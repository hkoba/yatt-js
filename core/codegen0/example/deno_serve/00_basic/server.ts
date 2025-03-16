#!/usr/bin/env -S deno run -NRE

import {generate_mounter, runtime} from '@yatt/codegen0'

import {readFileSync, statSync} from 'node:fs'

import {resolve} from 'node:path'

async function handler(req: Request): Promise<Response> {

  const url = new URL(req.url)

  let pathname = url.pathname

  if (pathname.charAt(pathname.length - 1) === '/') {
    pathname += 'index'
  }

  const fn = resolve('public', pathname.substring(1) + '.yatt')

  console.log(`GET: ${fn}`)

  if (! statSync(fn, {throwIfNoEntry: false})) {
    return new Response("Not found", {status: 404})
  }

  const source = readFileSync(fn, {encoding: "utf-8"})

  const output = generate_mounter(fn, source, {})

  const script = output.outputText

  const {mount} = await import(`data:text/typescript,${script}`)

  const $yatt = {
    runtime,
    $public: {}
  }

  const $this = mount($yatt)

  const CON = {
    buffer: "",
    append(str: string) {
      this.buffer += str;
    },
    appendUntrusted(str?: string) {
      if (str == null) return;
      this.buffer += $yatt.runtime.escape(str)
    },
    appendRuntimeValue(val: any) {
      this.buffer += $yatt.runtime.escape(val)
    }
  }

  // XXX: list 型とそれ以外とで、entries の扱いを変更する
  const params = Object.fromEntries(url.searchParams.entries())

  console.log('searchParams:', params)

  $this.render_(CON, params)

  return new Response(CON.buffer);
}

Deno.serve(handler)
