#!/usr/bin/env ts-node

import * as Path from 'path'
import fs from 'fs'

export type FilePath = {
  rootDir: string
  location: string
  file: string
  isIndex: boolean
  subpath?: string
  absPath: string
}

export function resolveFilePath(
  path: string, opts: {rootDir: string, index: string, ext: string}
)
: FilePath | undefined
{
  if (path.length === 0 || path.charAt(0) !== '/')
    throw new Error(`Invalid path: ${path}`)

  let rootDir = Path.normalize(opts.rootDir)
  let elemList = path.split(Path.sep)
  let location = []
  let file
  let isIndex = false
  while (elemList.length > 0) {
    const elem = elemList[0]
    let prefix = rootDir + location.join(Path.sep)
    let fn = `${prefix}/${elem}`
    let stat = fs.statSync(fn, {throwIfNoEntry: false})
    if (stat != null && stat.isDirectory()) {
      location.push(elemList.shift())
      continue;
    }
    if (stat == null) {
      fn = `${prefix}/${opts.index}`
      if (! fs.existsSync(fn))
        return;
      file = opts.index
      isIndex = true;
    }
    else {
      if (Path.extname(elem) !== opts.ext)
        return;
      file = elem
    }
    break;
  }
  if (file == null) {
    let fn = rootDir + [...location, opts.index].join(Path.sep)
    if (fs.existsSync(fn)) {
      file = opts.index
      isIndex = true
    } else {
      throw new Error(`BUG! file is empty!`)
    }
  }
  const subpath = elemList.length ? elemList.join(Path.sep) : undefined
  const absPath = rootDir + [...location, file].join(Path.sep)
  return {
    rootDir: opts.rootDir, location: location.join(Path.sep),
    file, isIndex, subpath,
    absPath
  }
}

if (module.id === '.') {
  const args = process.argv.slice(2)
  if (args.length < 2)
    throw new Error(`Too few arguments! Usage: path rootDir`);
  const [path, rootDir, index = 'index.ytjs'] = args
  console.log(resolveFilePath(path, {rootDir, index, ext: '.ytjs'}))
}
