#!/usr/bin/env -S deno run -R

import {readFileSync, existsSync} from 'node:fs'

// import {YattConfig} from '../../config'

type FunctionMG = {name?: string}

import {upward_dirs} from '../../path.ts'

export function list_entity_functions(rootName: string): {[k: string]: any} {

  const funcRe = /^export (?:declare )?function (?<name>\w+)\(this: Connection,/mg

  const dict: {[k: string]: any} = {}

  const fileName = find_file_with_extension(rootName, ['d.ts', 'ts']);
  if (fileName == null) {
    // warn
    return dict
  }

  // console.log(`entity defs: ${fileName}`)

  const source = readFileSync(fileName, {encoding: 'utf-8'})
  let m
  while ((m = funcRe.exec(source))) {
    const mg = m.groups as FunctionMG
    if (! mg.name)
      continue
    dict[mg.name] = true
  }

  return dict
}

function find_file_with_extension(rootName: string, extensions: string[])
: string | undefined {
  for (const dir of upward_dirs(rootName)) {
    for (const ext of extensions) {
      const fn = dir + '/' + rootName + '.' + ext;
      if (existsSync(fn)) {
        return fn
      }
    }
  }
}

if (import.meta.main) {
  const process = await import("node:process")
  const [fileName] = process.argv.slice(2)

  console.log(list_entity_functions(fileName))
}
