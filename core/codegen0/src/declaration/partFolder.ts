import * as Path from 'node:path'

import type {BuilderRequestSession} from './context.ts'

// partPath = ['foo', 'bar']
// 1. foo.ytjs:<!yatt:widget bar>
// 2. foo/bar.ytjs:<!yatt:args>

// 1. foo.ytjs:<!yatt:widget bar>
export function* candidatesForLookup(
  session: BuilderRequestSession, fromDir: string, partPath: string[]
): Generator<{realPath: string, name: string}> {

  const debug = session.params.debug.declaration ?? 0

  if (debug) {
    console.log(`fromDir: ${fromDir} looking partPath: `, partPath)
  }

  const extMayList = session.params.ext_public

  if (fromDir === "") {
    for (const ext of Array.isArray(extMayList) ? extMayList : [extMayList]) {
      // XXX: fromDir を使わないのに渡すのは、気持ち悪い…
      yield partInFile(debug, fromDir, partPath, ext, true)
    }
    return;
  }

  const genList = session.params.lookup_subdirectory_first ?
    [partInSubdir, partInFile] :
    [partInFile, partInSubdir];

  // XXX: ext_private でもループ
  {
    const absFromDir = Path.resolve(fromDir) + Path.sep

    for (const gen of genList) {
      for (const ext of Array.isArray(extMayList) ? extMayList : [extMayList]) {
        yield {
          ...gen(debug, absFromDir, partPath, ext),
        }
      }
    }
  }

}

// when partPath is ['foo', 'bar']...

// look for 'foo.ytjs'
function partInFile(
  debug: number, fromDir: string, partPath: string[]
  , ext: string, ignoreFromDir?: boolean
): {realPath: string, name: string} {
  if (partPath.length === 1) {
    const realPath = (ignoreFromDir ? partPath[0] : Path.resolve(fromDir, partPath[0])) + ext
    const result = {realPath, name: ""}
    return result
  } else {
    const virtPath = partPath.slice(0, partPath.length-1).join(Path.sep);
    const realPath = (ignoreFromDir ? virtPath : Path.resolve(fromDir, virtPath)) + ext
    const result = {realPath, name: partPath[partPath.length-1]}
    if (debug) {
      console.log(`partInFile: fromDir: ${fromDir} virtPath: ${virtPath} ext=${ext} =>`, result)
    }
    return result
  }

}

// look for 'foo/bar.ytjs'
function partInSubdir(
  debug: number, fromDir: string, partPath: string[]
  , ext: string
): {realPath: string, name: string} {
  const virtPath = partPath.join(Path.sep)
  const realPath = Path.resolve(fromDir, virtPath) + ext
  const result = {realPath, name: ''};
  if (debug) {
    console.log(`partInSubdir: virtPath: ${virtPath} ext=${ext} => `, result)
  }
  return result
}
