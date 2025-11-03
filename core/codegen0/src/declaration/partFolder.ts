import * as Path from 'node:path'

import type {BuilderRequestSession, BuilderSettings} from './context.ts'
import {indent, testFileCache} from './context.ts'

import type {TemplateDeclaration} from './types.ts'

export function resolveTemplate(fn: string, template: TemplateDeclaration): string {
  return virtResolve(template.realDir, fn)
}

function virtResolve(path: string, ...rest: string[]): string {
  if (! Path.isAbsolute(path)) {
    return Path.join(path, ...rest)
  } else {
    return Path.resolve(path, ...rest)
  }
}

export function baseModName(path: string): string {
  const base = Path.basename(path)
  const ext = Path.extname(path)
  if (ext === "") {
    return base
  } else {
    return base.substring(0, base.length - ext.length)
  }
}

export function internTemplateRuntimeNamespace(path: string, settings: BuilderSettings): string {
  const dir = Path.dirname(path)
  if (! settings.templateFolderMap.size) {
    const nick = 'public'
    settings.templateFolderMap.set(dir, nick)
    return nick
  } else if (! settings.templateFolderMap.has(dir)) {
    const nick = Path.basename(dir)
    settings.templateFolderMap.set(dir, nick)
    return nick
  } else {
    return settings.templateFolderMap.get(dir)!
  }
}

function lexpand(mayList: string | string[]): string[] {
  if (Array.isArray(mayList)) {
    return mayList
  } else {
    return [mayList]
  }
}

// partPath = ['foo', 'bar']
// 1. foo.ytjs:<!yatt:widget bar>
// 2. foo/bar.ytjs:<!yatt:args>

// 1. foo.ytjs:<!yatt:widget bar>
export async function* candidatesForLookup(
  session: BuilderRequestSession, fromDir: string, partPath: string[]
): AsyncGenerator<{realPath: string, name: string}> {

  const debug = session.params.debug.declaration ?? 0

  if (debug) {
    console.log(indent(session) + `fromDir: ${fromDir} rootDir: ${session.params.rootDir} looking partPath: `, partPath)
  }

  const extList = [
    ...lexpand(session.params.ext_private),
    ...lexpand(session.params.ext_public)
  ]

  if (fromDir === "") {
    const found = []
    for (const ext of extList) {
      const rec = rawPartInFile(session, debug, partPath, ext);
      if (await testFileCache(session, rec.realPath)) {
        found.push(rec)
      }
    }
    if (found.length >= 2) {
      throw new Error(`Use of multiple extension is detected for ${partPath.join(":")} in ${fromDir}: ${found.join("\n")}`)
    }
    if (found.length) {
      yield found[0]
    }
    return;
  }

  const genList = session.params.lookup_subdirectory_first ?
    [partInSubdir, partInFile] :
    [partInFile, partInSubdir];

  // XXX: ext_private でもループ
  {
    const absFromDir = virtResolve(fromDir) + Path.sep
    if (debug) {
      console.log(indent(session) + ` absFromDir: ${absFromDir} fromDir: ${fromDir}`)
    }

    for (const gen of genList) {
      const found = []
      for (const ext of extList) {
        const rec = gen(session, debug, absFromDir, partPath, ext);
        if (await testFileCache(session, rec.realPath)) {
          found.push(rec)
        }
      }
      if (found.length >= 2) {
        throw new Error(`Use of multiple extension is detected for ${partPath.join(":")} in ${absFromDir}: ${found.join("\n")}`)
      }
      if (found.length) {
        yield found[0]
      }
    }
  }

}

// when partPath is ['foo', 'bar']...

function rawPartInFile(
  session: BuilderRequestSession,
  debug: number, partPath: string[], ext: string
): {realPath: string, name: string} {
  if (partPath.length === 1) {
    const realPath = partPath[0] + ext
    const result = {realPath, name: ""}
    if (debug) {
      console.log(indent(session) + `rawPartInFile: ext=${ext} =>`, result)
    }
    return result
  } else {
    const virtPath = partPath.slice(0, partPath.length-1).join(Path.sep);
    const realPath = virtPath + ext
    const result = {realPath, name: partPath[partPath.length-1]}
    if (debug) {
      console.log(indent(session) + `rawPartInFile: virtPath: ${virtPath} ext=${ext} =>`, result)
    }
    return result
  }

}

// look for 'foo.ytjs'
function partInFile(
  session: BuilderRequestSession,
  debug: number, fromDir: string, partPath: string[]
  , ext: string
): {realPath: string, name: string} {
  if (partPath.length === 1) {
    const realPath = virtResolve(fromDir, partPath[0]) + ext
    const result = {realPath, name: ""}
    return result
  } else {
    const virtPath = partPath.slice(0, partPath.length-1).join(Path.sep);
    const realPath = virtResolve(fromDir, virtPath) + ext
    const result = {realPath, name: partPath[partPath.length-1]}
    if (debug) {
      console.log(indent(session) + `partInFile: fromDir: ${fromDir} virtPath: ${virtPath} ext=${ext} =>`, result)
    }
    return result
  }

}

// look for 'foo/bar.ytjs'
function partInSubdir(
  session: BuilderRequestSession,
  debug: number, fromDir: string, partPath: string[]
  , ext: string
): {realPath: string, name: string} {
  const virtPath = partPath.join(Path.sep)
  const realPath = virtResolve(fromDir, virtPath) + ext
  const result = {realPath, name: ''};
  if (debug) {
    console.log(indent(session) + `partInSubdir: virtPath: ${virtPath} ext=${ext} => `, result)
  }
  return result
}
