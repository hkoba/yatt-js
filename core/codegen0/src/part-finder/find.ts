#!/usr/bin/env ts-node

import * as Path from 'path'

import * as Fs from 'fs'

import {YattConfig} from '../config'

import {
  Widget,
  BuilderSession,
  YattBuildConfig,
  build_template_declaration,
} from '../declaration'
import { DeclTree } from '../declaration/context'

export function find_widget(
  session: BuilderSession, fromDir: string, partPath: string[]
): Widget | undefined
{

  const [[rootDir, primaryMap], ...restCache] = Object.entries(session.declCacheSet)
  const partName = partPath[partPath.length-1]

  // partPath = ['foo', 'bar']
  // 1. foo.ytjs:<!yatt:widget bar>
  // 2. foo/bar.ytjs:<!yatt:args>

  // 1. foo.ytjs:<!yatt:widget bar>
  {
    let virtPath = [fromDir, ...partPath.slice(0, partPath.length-1)].
      join(Path.sep);

    refresh(session, primaryMap, virtPath,
            resolveRealPath(session, rootDir, virtPath))

    if (primaryMap.has(virtPath)) {
      const decls = primaryMap.get(virtPath)!.tree

      if (decls.partMap.widget.has(partName)) {
        return decls.partMap.widget.get(partName)!
      }
    }
  }

  for (const [dir, cache] of restCache) {
    let virtPath = [dir, ...partPath.slice(0, partPath.length-1)].
      join(Path.sep);

    refresh(session, cache, virtPath,
            resolveRealPath(session, dir, virtPath))

    if (cache.has(virtPath)) {
      const decls = cache.get(virtPath)!.tree

      if (decls.partMap.widget.has(partName)) {
        return decls.partMap.widget.get(partName)!
      }
    }
  }

  // 2. foo/bar.ytjs:<!yatt:args>


}

function resolveRealPath(session: BuilderSession, rootDir: string, virtPath: string): string {
  return Path.resolve(rootDir, virtPath) +
      session.params.ext_public
}

// XXX: Remove Fs, Path dependencies
function refresh(
  session: BuilderSession, cache: DeclTree,
  virtPath: string, realPath: string
) {
  if (session.visited.get(realPath)) {
    return
  }
  if (cache.has(virtPath)) {
    const entry = cache.get(virtPath)!
    const stat = Fs.statSync(realPath)
    if (stat == null) {
      return
    }
    if (stat.mtimeMs <= entry.modTime) {
      return
    }
  } else if (! Fs.existsSync(realPath)) {
    return
  }

  const config: YattBuildConfig = {
    builders: session.builders,
    varTypeMap: session.varTypeMap,
    declCacheSet: session.declCacheSet,
  }

  const source = Fs.readFileSync(realPath, {encoding: 'utf-8'})
  const modTime = Fs.statSync(realPath, {throwIfNoEntry: false})!.mtimeMs
  const [template, _session] = build_template_declaration(source, config)
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

    let config: YattConfig = {}
    parse_long_options(args, {target: config})

    const [filename, elemPathStr] = args;

    const source = Fs.readFileSync(filename, {encoding: "utf-8"})

    const [session] = declarationBuilderSession(source, config)

    const widget = find_widget(
      session,
      Path.dirname(filename),
      elemPathStr.split(/:/)
    )

    if (widget == null) {
      console.error(`Can\'t find widget ${elemPathStr} from file ${filename}`)
    } else {
      console.log(`Found widget: `, widget)
    }

  })()
}
