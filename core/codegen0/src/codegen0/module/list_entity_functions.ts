#!/usr/bin/env ts-node

import {readFileSync} from 'fs'

type FunctionMG = {name?: string}

export function list_entity_functions(fileName: string): {[k: string]: any} {

  const funcRe = /^export function (?<name>\w+)\(this: Connection,/mg

  let dict: {[k: string]: any} = {}

  const source = readFileSync(fileName, {encoding: 'utf-8'})
  let m
  while (m = funcRe.exec(source)) {
    const mg = m.groups as FunctionMG
    if (! mg.name)
      continue
    dict[mg.name] = true
  }

  return dict
}

if (module.id === '.') {
  let [fileName] = process.argv.slice(2)

  console.log(list_entity_functions(fileName))
}
