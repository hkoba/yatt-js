#!/usr/bin/env ts-node

// XXX: Remove node path dependencies
import path from 'node:path'
import {strictEqual} from 'assert'

import {YattConfig} from './config'

// After transpilation, jsDir will become $base/lib
export const jsDir = __dirname
// Revert $base/src
export const srcDir = path.join(path.dirname(jsDir), 'src')

export function templatePath(filename: string, rootDir?: string): string[] {

  const suffix = pathUnderRootDir(filename, rootDir)
  if (suffix == null) {
    throw new Error(`filename '${filename}' doesn\'t start with ${rootDir}`)
  }

  const dir = path.dirname(suffix)
  const tmplDir = dir === '.' ? [] : dir.split(path.sep).filter(s => s.length)
  const tmplName = path.basename(suffix, path.extname(filename))
  const tmplPath = [...tmplDir, tmplName];
  for (const path of tmplPath) {
    if (!/^[_a-z][0-9_a-z]*$/i.exec(path)) {
      throw new Error(`Filename '${path}' does not fit for identifier: ${tmplPath}`)
    }
  }
  return tmplPath
}

export function pathUnderRootDir(filename: string, rootDir?: string): string | undefined {
  if (rootDir == null || rootDir === '' || rootDir === './') {
    return path.basename(filename);
  } else {
    strictEqual(rootDir.charAt(rootDir.length-1), path.sep
                , `rootDir should end with path.sep`)
    if (filename.startsWith(rootDir)) {
      return filename.substring(rootDir.length)
    }
  }
}

export function prefixUnderRootDir(filename: string, rootDir?: string): string {
  const dir = pathUnderRootDir(path.dirname(filename), rootDir)
  if (dir == null) {
    return "./"
  } else {
    return prefixPath(dir)
  }
}

export function prefixPath(dir: string): string {
  return Array.from(path.dirname(dir).split(path.sep)
                    , (_) => "..").join(path.sep) + "/"
}

export function guessRootDir(fileList: string[]): string {
  const path = longestPrefixDir(fileList)
  if (path == null || path === "") {
    return "./"
  } else {
    return path
  }
}

export function longestPrefixDir(fileList: string[]): string | undefined {
  const [first, ...rest] = fileList.map(p => path.normalize(p));
  let prefix = normalizeDir(first)
  for (const fn of rest) {
    while (prefix.length && !fn.startsWith(prefix)) {
      prefix = normalizeDir(prefix);
    }
    if (!prefix.length)
      break;
  }
  return prefix;

  function normalizeDir(fn: string): string {
    let prefix = path.dirname(fn)
    if (prefix === "." && !fn.startsWith('./')) {
      return ""
    } else {
      return prefix + '/';
    }
  }
}

export function outFileName(filename: string, newExt: string, config: YattConfig): string {
  if (config.outDir != null && config.outDir !== "") {
    if (config.yattSrcPrefix == null || config.yattSrcPrefix === ""
      || config.yattSrcPrefix === "./")
      throw new Error(`yattSrcPrefix should not be empty when outDir is specified`);
    console.log(`filename=${filename}, yattSrcPrefix=${config.yattSrcPrefix}`)
    const subName = pathUnderRootDir(filename, config.yattSrcPrefix)
    console.log(` => subName = ${subName}`)
    if (subName == null)
      throw new Error(`Can\'t determine outFileName for ${filename} under yattSrcPrefix ${config.yattSrcPrefix}`);
    // XXX: rewrite with rootname()
    const rootName = fileNameWithNewExt(subName, newExt)
    return path.join(config.outDir, rootName)
  } else {
    return fileNameWithNewExt(filename, newExt)
  }
}

export function fileNameWithNewExt(filename: string, newExt: string): string {
  const ext = path.extname(filename)
  return path.join(path.dirname(filename)
                   , path.basename(filename, ext) + newExt)
}

export function rootname(fn: string): string {
  return fn.substring(0, fn.length - path.extname(fn).length)
}

export function* upward_dirs(
  origFn: string, rootDir?: string
): Generator<string> {
  let fn = path.resolve(path.dirname(origFn))
  yield fn
  let pos
  while ((pos = fn.lastIndexOf(path.sep)) >= 0) {
    const f = fn.substring(0, pos)
    yield f
    if (rootDir != null && f === rootDir)
      return
    fn = f
  }
}

if (module.id === ".") {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "longestPrefixDir":
      console.log(longestPrefixDir(args)); break
    case "templatePath":
      console.log(templatePath(args[0], args[1])); break;
    case "pathUnderRootDir":
      console.log(pathUnderRootDir(args[0], args[1])); break;
    case "prefixUnderRootDir":
      console.log(prefixUnderRootDir(args[0], args[1])); break;
    case "prefixPath":
      console.log(prefixPath(args[0])); break;
    default:
      console.error(`Unknown command: ${cmd}`);
  }
}
