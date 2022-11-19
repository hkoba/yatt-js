#!/usr/bin/env ts-node

// XXX: Remove node path dependencies
import {readFileSync, existsSync} from 'fs'

// import {YattConfig} from '../../config'

type FunctionMG = {name?: string}

export function list_entity_functions(rootName: string): {[k: string]: any} {

  const funcRe = /^export (?:declare )?function (?<name>\w+)\(this: Connection,/mg

  let dict: {[k: string]: any} = {}

  const fileName = find_file_with_extension(rootName, ['d.ts', 'ts']);
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

function find_file_with_extension(rootName: string, extensions: string[]): string {
  for (const ext of extensions) {
    const fn = rootName + '.' + ext;
    if (existsSync(fn)) {
      return fn
    }
  }
  throw new Error(`Can't find '${rootName}' with extensions: ${extensions}`)
}

if (module.id === '.') {
  let [fileName] = process.argv.slice(2)

  console.log(list_entity_functions(fileName))
}
