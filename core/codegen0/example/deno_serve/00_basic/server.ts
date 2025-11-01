#!/usr/bin/env -S deno run -NRE

/// <reference lib="deno.ns" />

import {cgenSettings, freshCGenSession, refresh_populator, runtime} from '@yatt/codegen0'

import {parse_long_options} from '@yatt/lrxml'

import {resolve} from 'node:path'

import {readFileSync} from 'node:fs'

const process = await import('node:process')

const [...args] = process.argv.slice(2);

const __dirname = new URL('.', import.meta.url).pathname

const DEBUG_LEVEL = parseInt(process.env["DEBUG"] ?? "0", 10) || 0

const config = {
  mockEntityByFile: "",
  rootDir: resolve(__dirname, 'public'),
  ext_public: ['.ytjs', '.yatt'],
  debug: {
    declaration: DEBUG_LEVEL,
    codegen: DEBUG_LEVEL
  }
}

parse_long_options(args, {target: config})

const baseCgen = cgenSettings('populator', config)

if (config.mockEntityByFile !== "") {
  console.log(`Mocking entities by ${config.mockEntityByFile}`)
  const mock = JSON.parse(readFileSync(config.mockEntityByFile, {encoding: "utf-8"}))
  baseCgen.entFns = Object.fromEntries(
    Object.entries(mock).map(([k, v]) => {
      console.log(`entity ${k} returns ${v}`)
      return [k, function () {
        console.log(`mock ${k} is called`);
        return v
      }];
    })
  )
}

const $yatt = {
  runtime,
  $public: {},
  ...baseCgen.entFns
}

if (DEBUG_LEVEL > 0) {
  console.log(`\$yatt: `, $yatt)

  console.log(`debug: `, baseCgen.params.debug)
}


async function handler(req: Request): Promise<Response> {

  const url = new URL(req.url)

  let pathname = url.pathname

  if (pathname.charAt(pathname.length - 1) === '/') {
    pathname += 'index'
  }

  const cgen = freshCGenSession(baseCgen)
  // console.log(cgen, '----------------')

  const fn = pathname.substring(1) + '.yatt'
  const targetFile = resolve(config.rootDir, fn)
  console.log(`GET: ${fn} => ${targetFile}`)

  const entry = await refresh_populator(
    targetFile, {...cgen, $yatt}
    // , {private: false}
  )

  if (! entry) {
    return new Response("Not found", {status: 404})
  }

  const {$this} = entry

  console.log('$this:', $this)

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

  return new Response(CON.buffer, {
    headers: {
      "Content-Type": `text/html; charset="utf-8"`
    }
  });
}

Deno.serve(handler)
