#!/usr/bin/env -S deno run -WRE

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

  const fileList = glob.sync('**/*.{ytjs,yatt}', {
    root: templateDir, cwd: templateDir
  })

  console.log(fileList)

  for (const fn of fileList) {
    const rn = cgen.path.rootname(fn)
    const srcFn = Path.join(templateDir, fn);
    const outFn = `${outDir}/${rn}.ts`
    const source = readFileSync(srcFn, {encoding: 'utf-8'})
    const output = cgen.generate_namespace(srcFn, source, config)
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
    writeFileSync(mapFn, `namespace $yatt {\n  export const $staticMap = ${json}\n}\n`)
  }
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
    const templateDir = Path.resolve('templates') + Path.sep
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
