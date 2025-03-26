import * as Path from 'node:path'
import * as Fs from 'node:fs/promises'

import type {BuilderBaseSession} from './context.ts'

export async function needsUpdate(
  session: BuilderBaseSession, realPath: string
): Promise<{modTime: number, source: string} | undefined> {
  const debug = session.params.debug.declaration
  if (debug) {
    console.log(`refreshing realPath=${realPath}`)
  }
  if (session.visited.get(realPath)) {
    if (debug) {
      console.log(` => has visited: ${realPath}`)
    }
    return
  }

  let fh, stat;
  try {
    fh = await Fs.open(realPath)
    stat = await fh.stat()

    if (session.declCache.has(realPath)) {
      if (debug) {
        console.log(` => has cache: ${realPath}`)
      }
      const entry = session.declCache.get(realPath)!
      if (stat.mtimeMs <= entry.modTime) {
        if (debug) {
          console.log(` => cache is valid: cache(${entry.modTime}) vs stat(${stat.mtimeMs})`)
        }
        return
      }
    }
    if (debug) {
      console.log(` => Reading ${realPath}`)
    }

    const source = await fh.readFile({encoding: 'utf-8'})
    return {source, modTime: stat!.mtimeMs}

  } catch (err) {
    if (err instanceof Error && err.name !== "NotFound") {
      console.warn(err)
    } else if (debug) {
      console.log(` => Not found: ${realPath}`)
    }
  } finally {
    await fh?.close()
  }
}

// partPath = ['foo', 'bar']
// 1. foo.ytjs:<!yatt:widget bar>
// 2. foo/bar.ytjs:<!yatt:args>

// 1. foo.ytjs:<!yatt:widget bar>
export function* candidatesForLookup(
  session: BuilderBaseSession, fromDir: string, partPath: string[]
): Generator<{realPath: string, name: string}> {

  const debug = session.params.debug.declaration ?? 0

  if (debug) {
    console.log(`fromDir: ${fromDir} looking partPath: `, partPath)
  }

  const ext = session.params.ext_public

  const genList = session.params.lookup_subdirectory_first ?
    [partInSubdir, partInFile] :
    [partInFile, partInSubdir];

  // XXX: ext_public, ext_private でループ
  {
    const absFromDir = Path.resolve(fromDir) + Path.sep

    for (const gen of genList) {
      yield {
        ...gen(debug, absFromDir, partPath, ext),
      }
    }
  }

}

// when partPath is ['foo', 'bar']...

// look for 'foo.ytjs'
function partInFile(
  debug: number, fromDir: string, partPath: string[]
  , ext: string
): {realPath: string, name: string} {
  if (partPath.length === 1) {
    const realPath = Path.resolve(fromDir, partPath[0]) + ext
    const result = {realPath, name: ""}
    return result
  } else {
    const virtPath = partPath.slice(0, partPath.length-1).join(Path.sep);
    const realPath = Path.resolve(fromDir, virtPath) + ext
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
