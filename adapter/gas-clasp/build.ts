#!/usr/bin/env -S deno run -WRE --allow-run --allow-net

/// <reference lib="deno.ns" />

import {glob, type GlobOptions} from 'npm:glob'
import * as Path from 'node:path'
import {readFileSync, writeFileSync, statSync} from 'node:fs'

import * as cgen from '@yatt/codegen0'

const __dirname = new URL('.', import.meta.url).pathname;
export const srcDir = __dirname

async function build(rootDir: string, templateDir: string, config: cgen.YattConfig): Promise<void> {
  const outDir = config.outDir ?? (rootDir + "/_yatt")

  if (! config.noEmit) {
    if (! statSync(outDir, {throwIfNoEntry: false})) {
      Deno.mkdirSync(outDir);
    }
  }

  // copy yatt runtime files
  // XXX: rebuild オプションがほしい
  if (! config.noEmit) {

    copyIntoNamespaceIfMissing(
      "$yatt.runtime",
      `${cgen.path.srcDir}/yatt/runtime.ts`,
      `${rootDir}/_yatt.runtime.ts`
    )

    copyFilesIfMissing(`${srcDir}/runtime`, '**/*.ts', rootDir, true);
  }

  const fileList = glob.sync('**/*.{ytmpl,ytjs,yatt}', {
    root: templateDir, cwd: templateDir
  })

  console.log(fileList)

  for (const fn of fileList) {
    const rn = cgen.path.rootname(fn)
    const srcFn = Path.join(templateDir, fn);
    const outFn = `${outDir}/${rn}.ts`
    const source = readFileSync(srcFn, {encoding: 'utf-8'})
    const output = await cgen.generate_namespace(srcFn, source, config)
    if (! config.noEmit) {
      console.log(`Generating ${outFn}`)
      writeFileSync(outFn, output.outputText)
    }
  }

  // generate static file map
  if (! config.noEmit) {
    console.log('rootDir', rootDir)
    const staticFiles = glob.sync('**/*.html', {
      root: rootDir, cwd: rootDir
    })
    const mapFn = `${outDir}/_static.ts`;
    const script: {[k: string]: boolean} = {};
    for (const fn of staticFiles) {
      script[fn] = true;
    }
    console.log(`writing ${mapFn}`)
    const json = JSON.stringify(script)
    writeFileSync(mapFn, `namespace $yatt {\n  export const staticMap$ = ${json}\n}\n`)
  }

  // bundle client(browser) TypeScript and expose it as $yatt.clientBundle$
  // (GAS serves only HTML, so client JS must be inlined into a <script>).
  if (! config.noEmit) {
    await buildClientBundles(rootDir, templateDir, outDir, config)
  }
}

// Discover client-side .ts entries, bundle them with esbuild (InlineSink) and
// emit `${outDir}/_clientBundle.ts` mirroring the `_static.ts`/`staticMap$`
// pattern. A template inlines a bundle via, e.g.:
//   <script><?yatt CON.append($yatt.clientBundle$.index) ?></script>
async function buildClientBundles(
  rootDir: string, templateDir: string, outDir: string, config: cgen.YattConfig
): Promise<void> {
  const clientExt = config.clientExt ?? '.client.ts'
  // project root = parent of the templates dir (sibling of clasp `root/`).
  const projectRoot = Path.dirname(templateDir.replace(/[/\\]+$/, ''))

  const entries: cgen.ClientEntry[] = []
  const includes: string[] = []

  // "endpoint" layout: client TS co-located with templates under templateDir.
  const coLocated = glob.sync(`**/*${clientExt}`, {root: templateDir, cwd: templateDir})
  for (const fn of coLocated) {
    const name = fn.slice(0, -clientExt.length)   // index.client.ts -> index
    entries.push({name, entryPoint: Path.join(templateDir, fn)})
  }
  if (coLocated.length) {
    includes.push(`${Path.relative(projectRoot, templateDir) || '.'}/**/*${clientExt}`)
  }

  // "role-split" layout: dedicated client source dirs (relative to project root).
  for (const dir of (config.clientDirs ?? [])) {
    const base = Path.resolve(projectRoot, dir)
    if (! statSync(base, {throwIfNoEntry: false})) continue
    for (const fn of glob.sync('**/*.ts', {root: base, cwd: base})) {
      entries.push({name: fn.replace(/\.ts$/, ''), entryPoint: Path.join(base, fn)})
    }
    includes.push(`${Path.relative(projectRoot, base) || '.'}/**/*.ts`)
  }

  if (entries.length === 0) return

  // Provide a client-scoped tsconfig (DOM lib, no GAS types) so developers can
  // type-check client TS separately from the server/GAS code (esbuild itself
  // only transpiles). Write-if-missing so user edits are preserved.
  writeClientTsconfigIfMissing(projectRoot, includes)

  console.log(`bundling ${entries.length} client entr${entries.length === 1 ? 'y' : 'ies'}`)
  const sink = new cgen.InlineSink()
  await cgen.bundleClientEntries(entries, sink, {format: 'iife', target: 'es2015'})

  // Escape `</script` so bundled JS can sit inside an HTML <script> element.
  const map: {[k: string]: string} = {}
  for (const [k, js] of Object.entries(sink.bundles)) {
    map[k] = js.replace(/<\/(script)/gi, '<\\/$1')
  }

  const outFn = `${outDir}/_clientBundle.ts`
  console.log(`writing ${outFn}`)
  writeFileSync(outFn, `namespace $yatt {\n  export const clientBundle$ = ${JSON.stringify(map)}\n}\n`)
}

// Client TS uses the DOM lib and must NOT see GAS server types; this is the
// "server(no DOM) / client(DOM)" split. esbuild only transpiles, so this
// config is for the developer's own `tsc -p _yatt.client.tsconfig.json` pass
// and editor type-checking. Only client files are included; imported helpers
// are checked transitively.
function writeClientTsconfigIfMissing(projectRoot: string, includes: string[]) {
  const destFn = `${projectRoot}/_yatt.client.tsconfig.json`
  if (statSync(destFn, {throwIfNoEntry: false})) {
    return
  }
  const tsconfig = {
    compilerOptions: {
      target: "es2015",
      module: "ESNext",
      moduleResolution: "Bundler",
      lib: ["esnext", "DOM", "DOM.Iterable"],
      types: [],
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
    },
    include: includes,
  }
  console.log(`writing ${destFn}`)
  writeFileSync(destFn, JSON.stringify(tsconfig, null, 2) + '\n')
}

function copyIntoNamespaceIfMissing(ns: string, srcFn: string, destFn: string) {
  if (statSync(destFn, {throwIfNoEntry: false})) {
    return
  }
  const content = readFileSync(srcFn, {encoding: "utf-8"})
  const indented = content.replaceAll(/^.+$/mg, "  $&")
  writeFileSync(destFn, `namespace ${ns} {\n${indented}\n}\n`)
}

function copyFilesIfMissing(srcDir: string, pattern: string, destDir: string
  , verbose?: boolean
  , options?: GlobOptions
) {
  options ??= {}
  const runtimeFiles = glob.sync(pattern, {
    ...options,
    root: srcDir, cwd: srcDir
  });
  for (const fn of runtimeFiles) {
    const outFn = `${destDir}/${fn}`
    const srcFn = `${srcDir}/${fn}`
    if (statSync(outFn, {throwIfNoEntry: false})) {
      continue
    }
    Deno.copyFile(srcFn, outFn);
    if (verbose) {
      console.log(`Copied ${srcFn} -> ${outFn}`);
    }
  }
}

if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    const { parse_long_options } = await import('@yatt/lrxml')

    const args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const templateDir = Path.resolve('pages') + Path.sep
    const config: cgen.YattConfig = {
      outDir: './root/_yatt',
      rootDir: templateDir,
      connectionTypeName: '$yatt.runtime.Connection',
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    await build('./root', templateDir, config)
  })()
}
