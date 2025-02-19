#!/usr/bin/env -S deno run -A

import {glob} from 'npm:glob'
import * as Path from 'node:path'
import {readFileSync, writeFileSync, statSync} from 'node:fs'

import * as cgen from '@yatt/codegen0'

const __dirname = new URL('.', import.meta.url).pathname;
export const srcDir = __dirname

async function build(rootDir: string, templateDir: string, config: cgen.YattConfig): Promise<void> {
  const outDir = config.outDir ?? (rootDir + "/_build")
  const runtimeDir = `${outDir}/yatt`;

  if (! config.noEmit) {
    for (const dir of [outDir, runtimeDir]) {
      if (! statSync(dir, {throwIfNoEntry: false})) {
        Deno.mkdirSync(dir);
      }
    }
  }

  // copy yatt runtime files
  // XXX: rebuild オプションがほしい
  if (! config.noEmit) {
    Deno.copyFile(`${cgen.path.srcDir}/yatt.ts`, `${outDir}/yatt.ts`);

    copyFilesIfMissing(`${cgen.path.srcDir}/yatt`, '**/*.ts', runtimeDir, true);

    copyFilesIfMissing(`${srcDir}/runtime`, '**/*.ts', runtimeDir, true, {dot: true});
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
    let mapFn = `${runtimeDir}/$static.js`;
    let script = {};
    for (const fn of staticFiles) {
      script[fn] = 1;
    }
    console.log(`writing ${mapFn}`)
    const json = JSON.stringify(script)
    writeFileSync(mapFn, `const $staticMap = ${json}`)
  }
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
    const { parse_long_options } = await import('@yatt/lrxml')

    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const templateDir = Path.resolve('templates') + Path.sep
    let config: cgen.YattConfig = {
      outDir: './root/_build',
      rootDir: templateDir,
      exportNamespace: false,
      connectionTypeName: 'yatt.Connection',
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    await build('./root', templateDir, config)
  })()
}
