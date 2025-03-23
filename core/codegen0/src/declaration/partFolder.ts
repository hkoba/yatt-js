import * as Path from 'node:path'
import * as Fs from 'node:fs/promises'

import type {BuilderBaseSession, DeclTree} from './context.ts'

export async function needsUpdate(
  session: BuilderBaseSession, cache: DeclTree,
  virtPath: string, realPath: string
): Promise<{modTime: number, source: string} | undefined> {
  const debug = session.params.debug.declaration
  if (debug) {
    console.log(`refreshing virtPath=${virtPath}, realPath=${realPath}`)
  }
  if (session.visited.get(realPath)) {
    if (debug) {
      console.log(` => has visited: ${virtPath}`)
    }
    return
  }
  let fh, stat;
  try {
    fh = await Fs.open(realPath)
    stat = await fh.stat()
  } catch (err) {
    if (debug) {
      console.log(` => Not found: `, err)
    }
  }

  if (!fh || !stat) {
    if (debug) {
      console.log(` => No real file: ${realPath}`)
    }
    return;
  } else if (cache.has(virtPath)) {
    if (debug) {
      console.log(` => has cache: ${virtPath}`)
    }
    const entry = cache.get(virtPath)!
    if (stat.mtimeMs <= entry.modTime) {
      if (debug) {
        console.log(` => cache is valid: cache(${entry.modTime}) vs stat(${stat.mtimeMs})`)
      }
      return
    }
  }

  const source = await fh.readFile({encoding: 'utf-8'})

  return {source, modTime: stat!.mtimeMs}
}

// partPath = ['foo', 'bar']
// 1. foo.ytjs:<!yatt:widget bar>
// 2. foo/bar.ytjs:<!yatt:args>

// 1. foo.ytjs:<!yatt:widget bar>
export function* candidatesForLookup(
  session: BuilderBaseSession, fromDir: string, partPath: string[]
): Generator<{rootDir: string, realPath: string, virtPath: string, name: string, cache: DeclTree}> {

  const debug = session.params.debug.declaration ?? 0

  const ext = session.params.ext_public

  const [[rootDir, primaryMap], ...restCache] = Object.entries(session.declCacheSet)

  const genList = session.params.lookup_subdirectory_first ?
    [partInSubdir, partInFile] :
    [partInFile, partInSubdir];

  {
    const absFromDir = Path.resolve(fromDir)

    for (const gen of genList) {
      yield {
        ...gen(debug, absFromDir, partPath, ext, rootDir),
        cache: primaryMap
      }
    }
  }

  for (const [dir, cache] of restCache) {
    const absDir = Path.resolve(dir)
    for (const gen of genList) {
      yield {
        ...gen(debug, absDir, partPath, ext),
        cache
      }
    }
  }
}

function partInFile(debug: number, fromDir: string, partPath: string[], ext: string, rootDir?: string): {rootDir: string, realPath: string, virtPath: string, name: string} {
  if (debug) {
    console.log(`InFile rootDir=${rootDir}, fromDir=${fromDir}`)
  }

  const virtPath = [fromDir, ...partPath.slice(0, partPath.length-1)].
    join(Path.sep);
  const folder = rootDir ?? fromDir
  const realPath = Path.resolve(folder, virtPath) + ext
  return {realPath, virtPath, rootDir: folder, name: partPath[partPath.length-1]}
}

function partInSubdir(debug: number, fromDir: string, partPath: string[], ext: string, rootDir?: string): {rootDir: string, realPath: string, virtPath: string, name: string} {
  if (debug) {
    console.log(`InSubdir rootDir=${rootDir}, fromDir=${fromDir}`)
  }
  const virtPath = [fromDir, ...partPath].
    join(Path.sep)
  const folder = rootDir ?? fromDir
  const realPath = Path.resolve(folder, virtPath) + ext
  return {realPath, virtPath, rootDir: folder, name: ''}
}
