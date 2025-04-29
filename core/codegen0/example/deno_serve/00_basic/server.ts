#!/usr/bin/env -S deno run -NRE

import {cgenSettings, freshCGenSession, refresh_populator, runtime} from '@yatt/codegen0'

import {resolve} from 'node:path'

const config = {
  rootDir: resolve('public'),
  debug: {
    declaration: 1
  }
}

const baseCgen = cgenSettings('populator', config)

const $yatt = {
  runtime,
  $public: {}
}

console.log(`debug: `, baseCgen.params.debug)

async function handler(req: Request): Promise<Response> {

  const url = new URL(req.url)

  let pathname = url.pathname

  if (pathname.charAt(pathname.length - 1) === '/') {
    pathname += 'index'
  }

  const cgen = freshCGenSession(baseCgen)
  // console.log(cgen, '----------------')

  const fn = pathname.substring(1) + '.yatt'
  console.log(`GET: ${fn}`)

  const entry = await refresh_populator(
    resolve(config.rootDir, fn), {...cgen, $yatt}
    // , {private: false}
  )

  if (! entry) {
    return new Response("Not found", {status: 404})
  }

  const {$this} = entry

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
