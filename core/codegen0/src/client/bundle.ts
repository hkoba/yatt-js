#!/usr/bin/env -S deno run -RWE --allow-run --allow-net

// Client-side (browser/webworker) TypeScript transpile + bundle.
//
// This is the toolchain layer for the "client TS" pipeline (see
// docs/discuss/browser-js.md). It is intentionally thin: a small wrapper over
// esbuild that turns one or more client entry points into bundled JS, and an
// abstract *sink* deciding where that JS goes.
//
//   - InlineSink : keep the bundled JS as a string (e.g. to inline into a GAS
//                  `<script>` via the generated `$yatt.clientBundle$` map).
//   - FileSink   : write `<name>.js` to a directory (e.g. `dist/`, served via
//                  `<script src=...>` by a normal web server).
//
// esbuild is imported dynamically so that merely importing @yatt/codegen0 does
// not pull the esbuild binary into environments that never bundle.

import * as Path from 'node:path'
import {writeFileSync, mkdirSync, statSync} from 'node:fs'

export type ClientBundleOptions = {
  target?: string                 // esbuild target, default 'es2015'
  format?: 'iife' | 'esm' | 'cjs' // default 'iife' (no module system; GAS-safe)
  minify?: boolean
  sourcemap?: boolean | 'inline'
}

export type ClientEntry = {
  name: string        // logical name (map key / output basename)
  entryPoint: string  // path to the client .ts entry file
}

const DEFAULTS: Required<Omit<ClientBundleOptions, 'sourcemap'>> & {sourcemap: boolean | 'inline'} = {
  target: 'es2015',
  format: 'iife',
  minify: false,
  sourcemap: false,
}

// A sink decides what to do with one bundled entry's JS.
export interface BundleSink {
  emit(name: string, js: string): void | Promise<void>
}

// Collect bundles in memory as { name: js } — for inlining (GAS etc.).
export class InlineSink implements BundleSink {
  readonly bundles: {[name: string]: string} = {}
  emit(name: string, js: string): void {
    this.bundles[name] = js
  }
}

// Write each bundle to `${outDir}/${name}${ext}`.
export class FileSink implements BundleSink {
  constructor(public outDir: string, public ext: string = '.js') {}
  emit(name: string, js: string): void {
    if (! statSync(this.outDir, {throwIfNoEntry: false})) {
      mkdirSync(this.outDir, {recursive: true})
    }
    const outFn = Path.join(this.outDir, name + this.ext)
    writeFileSync(outFn, js)
  }
}

// Bundle a set of client entries through esbuild and push each result to `sink`.
// The esbuild service is started once and stopped at the end.
export async function bundleClientEntries(
  entries: ClientEntry[],
  sink: BundleSink,
  options?: ClientBundleOptions
): Promise<void> {
  if (entries.length === 0) return

  const opts = {...DEFAULTS, ...options}
  const esbuild = await import('esbuild')

  try {
    for (const {name, entryPoint} of entries) {
      const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        write: false,
        platform: 'browser',
        format: opts.format,
        target: opts.target,
        minify: opts.minify,
        sourcemap: opts.sourcemap,
        logLevel: 'silent',
      })
      const js = new TextDecoder().decode(result.outputFiles[0].contents)
      await sink.emit(name, js)
    }
  } finally {
    // Let the deno process exit instead of hanging on the esbuild service.
    await esbuild.stop()
  }
}

// Convenience: bundle a single entry point and return the JS string.
export async function bundleClientEntry(
  entryPoint: string,
  options?: ClientBundleOptions
): Promise<string> {
  const sink = new InlineSink()
  const name = Path.basename(entryPoint).replace(/\.[^.]+$/, '')
  await bundleClientEntries([{name, entryPoint}], sink, options)
  return sink.bundles[name]
}

if (import.meta.main) {
  const process = await import('node:process')
  const {parse_long_options} = await import('../deps.ts')

  const args = process.argv.slice(2)
  const config: {outDir?: string, format?: string, minify?: boolean} = {}
  parse_long_options(args, {target: config})

  if (args.length === 0) {
    console.error('Usage: bundle.ts [--outDir=DIR] [--format=iife|esm] [--minify] <entry.ts>...')
    process.exit(1)
  }

  const options: ClientBundleOptions = {}
  if (config.format) options.format = config.format as ClientBundleOptions['format']
  if (config.minify) options.minify = true

  const entries: ClientEntry[] = args.map(entryPoint => ({
    name: Path.basename(entryPoint).replace(/\.[^.]+$/, ''),
    entryPoint: Path.resolve(entryPoint),
  }))

  if (config.outDir) {
    // FileSink: write bundles to disk.
    const sink = new FileSink(config.outDir)
    await bundleClientEntries(entries, sink, options)
    for (const {name} of entries) {
      console.error(`Wrote ${Path.join(config.outDir, name + sink.ext)}`)
    }
  } else {
    // InlineSink: print the bundled JS (single entry) or a name->js map (many).
    const sink = new InlineSink()
    await bundleClientEntries(entries, sink, options)
    if (entries.length === 1) {
      process.stdout.write(sink.bundles[entries[0].name])
    } else {
      process.stdout.write(JSON.stringify(sink.bundles, null, 2) + '\n')
    }
  }
}
