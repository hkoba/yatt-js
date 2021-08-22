#!/usr/bin/env ts-node

import path from 'path'

export const srcDir = __dirname

export function templatePath(filename: string, rootDir: string): string[] {
  if (! filename.startsWith(rootDir))
    throw new Error(`File ${filename} is not under ${rootDir}`)

  const dir = path.dirname(filename)
  const tmplDir = dir === '.' ? [] : dir.split(path.sep)
  const tmplName = path.basename(filename, path.extname(filename))
  const tmplPath = [...tmplDir, tmplName];
  for (const path of tmplPath) {
    if (!/^[_a-z][0-9_a-z]*$/i.exec(path)) {
      throw new Error(`Filename '${path}' does not fit for identifier: ${tmplPath}`)
    }
  }
  return tmplPath
}

type Tree<T> = {[k: string]: T | Tree<T>};

export function digEntry<T>(tree: Tree<T>, path: string[]): T | Tree<T> | undefined {
  let node: Tree<T> = tree
  for (const p of path) {
    let v: T | Tree<T> = node[p]
    if (v == null)
      return;
    node = v as unknown as Tree<T>;
  }
  return node;
}
