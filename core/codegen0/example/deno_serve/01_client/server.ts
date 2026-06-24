#!/usr/bin/env -S deno run -NRWE --allow-run

/// <reference lib="deno.ns" />

// Populator-style dev server that also demonstrates the client-TS pipeline with
// a FileSink: at startup it bundles every `public/**/*.client.ts` to ./_dist via
// esbuild, and serves them at /_dist/<name>.js. Templates reference a bundle
// with a plain <script src="/_dist/index.js">.

import {
  cgenSettings, freshCGenSession, refresh_populator, runtime,
  bundleClientEntries, FileSink, type ClientEntry,
} from '@yatt/codegen0'

import {parse_long_options} from '@yatt/lrxml'

import {resolve, basename} from 'node:path'

import {readFileSync, readdirSync} from 'node:fs'

const process = await import('node:process')

const [...args] = process.argv.slice(2);

const __dirname = new URL('.', import.meta.url).pathname

const DEBUG_LEVEL = parseInt(process.env["DEBUG"] ?? "0", 10) || 0

const config = {
  rootDir: resolve(__dirname, 'public'),
  ext_public: ['.ytjs', '.yatt'],
  debug: {
    declaration: DEBUG_LEVEL,
    codegen: DEBUG_LEVEL
  }
}

parse_long_options(args, {target: config})

const baseCgen = cgenSettings('populator', config)

const $yatt = {
  runtime,
  public$: {},
  ...baseCgen.entFns
}

// --- client TS bundling (FileSink) ---------------------------------------
const clientExt = '.client.ts'
const distDir = resolve(__dirname, '_dist')

const clientEntries: ClientEntry[] = []
for (const ent of readdirSync(config.rootDir, {recursive: true})) {
  const fn = typeof ent === 'string' ? ent : ent.toString()
  if (fn.endsWith(clientExt)) {
    clientEntries.push({
      name: fn.slice(0, -clientExt.length),
      entryPoint: resolve(config.rootDir, fn),
    })
  }
}

if (clientEntries.length) {
  await bundleClientEntries(clientEntries, new FileSink(distDir), {
    format: 'iife', target: 'es2015'
  })
  console.log(`bundled ${clientEntries.length} client entr${clientEntries.length === 1 ? 'y' : 'ies'} -> ${distDir}`)
}

// -------------------------------------------------------------------------

async function handler(req: Request): Promise<Response> {

  const url = new URL(req.url)

  let pathname = url.pathname

  // serve bundled client JS from ./_dist
  if (pathname.startsWith('/_dist/')) {
    const fn = resolve(distDir, basename(pathname))
    try {
      const body = readFileSync(fn, {encoding: "utf-8"})
      return new Response(body, {
        headers: {"Content-Type": `text/javascript; charset="utf-8"`}
      })
    } catch {
      return new Response("Not found", {status: 404})
    }
  }

  if (pathname.charAt(pathname.length - 1) === '/') {
    pathname += 'index'
  }

  const cgen = freshCGenSession(baseCgen)

  const fn = pathname.substring(1) + '.yatt'
  const targetFile = resolve(config.rootDir, fn)
  console.log(`GET: ${fn} => ${targetFile}`)

  const entry = await refresh_populator(
    targetFile, {...cgen, $yatt}
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

  const params = Object.fromEntries(url.searchParams.entries())

  $this.render_(CON, params)

  return new Response(CON.buffer, {
    headers: {
      "Content-Type": `text/html; charset="utf-8"`
    }
  });
}

Deno.serve(handler)
