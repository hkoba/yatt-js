#!/usr/bin/env ts-node

import {readFileSync} from 'node:fs'

type NamespaceMG = { body?: string }
type FunctionMG = { name?: string }

export function list_entity_functions(fileName: string, nsName: string): {[k: string]: any} {
  const nsPat = nsName.replace(/\$/g, '\\$&')
  const patStr = `^namespace[ \t]+${nsPat}[ \t]+\\{\n(?<body>.*?)\n\\}`
  const re = new RegExp(patStr, 'mgs')

  const funcRe = /^[ \t]*export[ \t]+(?:async[ \t]+)?function[ \t]+(?<name>\w+)/mg

  let dict: {[k: string]: any} = {}
  const script = readFileSync(fileName, {encoding: 'utf-8'})
  let m
  while (m = re.exec(script)) {
    const mg = m.groups as NamespaceMG
    if (! mg.body)
      continue
    let f
    while (f = funcRe.exec(mg.body)) {
      const fn = f.groups as FunctionMG
      if (! fn.name)
        continue
      dict[fn.name] = true
    }
  }
  return dict
}

if (module.id === '.') {
  let [fileName, nsName] = process.argv.slice(2)
  console.log(list_entity_functions(fileName, nsName ?? '$yatt'))
}
