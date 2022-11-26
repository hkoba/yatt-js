#!/usr/bin/env ts-node

import * as Path from 'path'

import * as Fs from 'fs'

import {YattConfig} from '../config'

import {
  Widget,
  BuilderSession,
  YattBuildConfig,
  build_template_declaration,
  TemplateDeclaration,
} from '../declaration'
import { DeclTree } from '../declaration/context'

//
// DEBUG=1 src/part-finder/find.ts --libDirs=test/input/ex1/ytmpl  test/input/ex1/public/subgroup1/foo.ytjs foo:bar
//
// --lookup_subdirectory_first
// --lookup_only
//
export function find_widget(
  session: BuilderSession, fromDir: string, partPath: string[]
): {widget: Widget, template: TemplateDeclaration} | undefined
{

  for (const {realPath, virtPath, name, cache} of candidatesForLookup(session, fromDir, partPath)) {
    refresh(session, cache, virtPath, realPath)
    if (cache.has(virtPath)) {
      const decls = cache.get(virtPath)!.tree

      if (decls.partMap.widget.has(name)) {
        return {widget: decls.partMap.widget.get(name)!, template: decls}
      }
    }
  }
}

// partPath = ['foo', 'bar']
// 1. foo.ytjs:<!yatt:widget bar>
// 2. foo/bar.ytjs:<!yatt:args>

// 1. foo.ytjs:<!yatt:widget bar>
function* candidatesForLookup(
  session: BuilderSession, fromDir: string, partPath: string[]
): Generator<{realPath: string, virtPath: string, name: string, cache: DeclTree}> {

  const ext = session.params.ext_public

  const [[rootDir, primaryMap], ...restCache] = Object.entries(session.declCacheSet)

  const genList = session.params.lookup_subdirectory_first ?
    [partInSubdir, partInFile] :
    [partInFile, partInSubdir];

  {
    const absFromDir = Path.resolve(fromDir)

    for (const gen of genList) {
      yield {
        ...gen(absFromDir, partPath, ext, rootDir),
        cache: primaryMap
      }
    }
  }

  for (const [dir, cache] of restCache) {
    const absDir = Path.resolve(dir)
    for (const gen of genList) {
      yield {
        ...gen(absDir, partPath, ext),
        cache
      }
    }
  }
}

function partInFile(fromDir: string, partPath: string[], ext: string, rootDir?: string): {realPath: string, virtPath: string, name: string} {
  // console.log(`InFile rootDir=${rootDir}, fromDir=${fromDir}`)

  const virtPath = [fromDir, ...partPath.slice(0, partPath.length-1)].
    join(Path.sep);
  const realPath = Path.resolve(rootDir ?? fromDir, virtPath) + ext
  return {realPath, virtPath, name: partPath[partPath.length-1]}
}

function partInSubdir(fromDir: string, partPath: string[], ext: string, rootDir?: string): {realPath: string, virtPath: string, name: string} {
  // console.log(`InSubdir rootDir=${rootDir}, fromDir=${fromDir}`)
  const virtPath = [fromDir, ...partPath].
    join(Path.sep)
  const realPath = Path.resolve(rootDir ?? fromDir, virtPath) + ext
  return {realPath, virtPath, name: ''}
}


// XXX: Remove Fs, Path dependencies
function refresh(
  session: BuilderSession, cache: DeclTree,
  virtPath: string, realPath: string
) {
  const debug = session.params.debug.declaration
  if (debug) {
    console.log(`refreshing ${virtPath}`)
  }
  if (session.visited.get(realPath)) {
    if (debug) {
      console.log(` => has visited: ${virtPath}`)
    }
    return
  }
  if (cache.has(virtPath)) {
    if (debug) {
      console.log(` => has cache: ${virtPath}`)
    }
    const entry = cache.get(virtPath)!
    const stat = Fs.statSync(realPath)
    if (stat == null) {
      return
    }
    if (stat.mtimeMs <= entry.modTime) {
      return
    }
  } else if (! Fs.existsSync(realPath)) {
    if (debug) {
      console.log(` => No realfile: ${realPath}`)
    }
    return
  }

  const config: YattBuildConfig = {
    builders: session.builders,
    varTypeMap: session.varTypeMap,
    declCacheSet: session.declCacheSet,
  }

  if (debug) {
    console.log(`Parsing ${realPath}`)
  }
  const source = Fs.readFileSync(realPath, {encoding: 'utf-8'})
  const modTime = Fs.statSync(realPath, {throwIfNoEntry: false})!.mtimeMs
  const [template, _session] = build_template_declaration(realPath, source, config)
  cache.set(virtPath, {modTime, tree: template})
  session.visited.set(realPath, true)
}


if (module.id === ".") {
  (async () => {
    let [...args] = process.argv.slice(2)

    // const Fs = await import("fs")
    // const Path = await import("path")

    const {parse_long_options} = await import("lrxml")
    const {declarationBuilderSession} = await import("../declaration/createPart")

    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config: YattConfig & {lookup_only?: string} = {
      debug: {
        declaration: debugLevel
      }
    }
    parse_long_options(args, {target: config})

    const [filename, elemPathStr] = args;

    const source = Fs.readFileSync(filename, {encoding: "utf-8"})

    const [session] = declarationBuilderSession(filename, source, config)

    const fromDir = Path.dirname(filename)
    const elemPath = elemPathStr.split(/:/)

    if (config.lookup_only) {
      for (const {realPath, name} of candidatesForLookup(
        session, fromDir, elemPath
      )) {
        console.log(`Try ${name} in ${realPath}`)
      }
    } else {
      const widget = find_widget(
        session,
        fromDir,
        elemPath
      )

      if (widget == null) {
        console.error(`Can\'t find widget ${elemPathStr} from file ${filename}`)
      } else {
        console.log(`Found widget: `, widget)
      }
    }

  })()
}
