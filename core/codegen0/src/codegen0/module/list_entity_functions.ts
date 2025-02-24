#!/usr/bin/env -S deno run -R

import {readFileSync} from 'node:fs'

// import {YattConfig} from '../../config'

type FunctionMG = {name?: string}

export function list_entity_functions(fileName: string): {[k: string]: any} {

  const funcRe = /^\s*export (?:declare )?function (?<name>\w+)\(/mg

  const dict: {[k: string]: any} = {}

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

if (import.meta.main) {
  const process = await import("node:process")
  const [fileName] = process.argv.slice(2)

  console.log(list_entity_functions(fileName))
}
