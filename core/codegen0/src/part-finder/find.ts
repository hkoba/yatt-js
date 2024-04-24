#!/usr/bin/env -S deno run -A

import * as Path from 'node:path'

import * as Fs from 'node:fs'

import {YattConfig} from '../config.ts'

import {
  Widget,
  Entity,
  BuilderSession,
  YattBuildConfig,
  build_template_declaration,
  TemplateDeclaration,
} from '../declaration/index.ts'
import { DeclTree } from '../declaration/context.ts'

//
// DEBUG=1 src/part-finder/find.ts --libDirs=test/input/ex1/ytmpl  test/input/ex1/public/subgroup1/foo.ytjs foo:bar
//
// --lookup_subdirectory_first
// --lookup_only
//
export function find_widget(
  session: BuilderSession, template: TemplateDeclaration, partPath: string[]
): {widget: Widget, template: TemplateDeclaration} | undefined
{
  const [head, ...rest] = partPath
  if (rest.length === 0 && template.partMap.widget.has(head)) {
    const widget = template.partMap.widget.get(head)!
    return {widget, template}
  }

  for (const {realPath, virtPath, name, cache}
       of candidatesForLookup(session, template.folder, partPath)) {
    refresh(session, cache, virtPath, realPath)
    if (cache.has(virtPath)) {
      const decls = cache.get(virtPath)!.tree

      if (decls.partMap.widget.has(name)) {
        return {widget: decls.partMap.widget.get(name)!, template: decls}
      }
    }
  }
}

export function find_entity(
  session: BuilderSession, template: TemplateDeclaration, name: string
): {entity: Entity, template: TemplateDeclaration} | string | undefined {
  if (template.partMap.entity.has(name)) {
    const entity = template.partMap.entity.get(name)!
    return {entity, template}
  }

  const fn = session.entFns[name]
  if (fn != null) {
    return name
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


if (import.meta.main) {
  (async () => {
    const process = await import("node:process")
    let [...args] = process.argv.slice(2)

    // const Fs = await import("fs")
    // const Path = await import("node:path")

    const {parse_long_options} = await import('../deps.ts')
    const {build_template_declaration} = await import("../declaration/index.ts")

    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config: YattConfig & {lookup_only?: string, entity?: boolean} = {
      debug: {
        declaration: debugLevel
      }
    }
    parse_long_options(args, {target: config})

    const [filename, elemPathStr] = args;

    const source = Fs.readFileSync(filename, {encoding: "utf-8"})

    const [template, session] = build_template_declaration(filename, source, config)

    const fromDir = Path.dirname(filename)
    const elemPath = elemPathStr.split(/:/)

    if (config.lookup_only) {
      for (const {realPath, name} of candidatesForLookup(
        session, fromDir, elemPath
      )) {
        console.log(`Try ${name} in ${realPath}`)
      }
    }
    else if (config.entity) {
      const entity = find_entity(
        session,
        template,
        elemPath[0]
      )

      if (entity == null) {
        console.error(`Can\'t find entity ${elemPathStr} from file ${filename}`)
      } else {
        console.log(`Found entity: `, entity)
      }
    }
    else {
      const widget = find_widget(
        session,
        template,
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
