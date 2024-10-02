#!/usr/bin/env -S deno run -A

import * as Path from "node:path"

export type YattProjectParams = {
  yattRoot: string
  documentRoot: string
  libDirs: string[]
  outDir?: string
  linkDir?: string
  yattSrcPrefix?: string
}

export type YattProjectStyle = {
  yattRoot?: string
  documentRoot?: string
  libDirs?: string[]
  outDir?: string
  linkDir?: string
  projectStyle?: string | YattProjectStyle
  yattSrcPrefix?: string
}

const pagesStyle = {
  projectStyle: "pages",
  yattRoot:     "./",
  documentRoot: "pages/",
  libDirs:     ["widgets/"],
  outDir:       "_gen/",
  linkDir:      "src/"
}

const projectStyles: {[k: string]: YattProjectStyle} = {
  "pages": pagesStyle,
  "yatt/pages": {
    ...pagesStyle, projectStyle: "yatt/pages", yattSrcPrefix: "yatt/"
  }
}

type YattProjectConfig = Partial<Omit<YattProjectParams, 'libDirs'>> & {
  libDirs?: string | string[]
  projectStyle?: string
}

function getProjectStyle(styleSpec?: string | YattProjectStyle)
: YattProjectStyle {
  if (styleSpec == null)
    return {}

  const getBase = (key: string) => {
    if (! projectStyles[key]) {
      throw new Error(`Unknown project style: ${key}`)
    }
    return projectStyles[key]
  }
  if (typeof styleSpec === 'string') {
    return {...getBase(styleSpec)}
  }
  else if (typeof styleSpec.projectStyle === 'string') {
    return {...getBase(styleSpec.projectStyle), ...styleSpec}
  }
  else {
    return styleSpec
  }
}

export function applyProjectStyle(
  origConfig: YattProjectConfig,
  styleSpec?: string | YattProjectStyle
): YattProjectParams & {projectStyle?: string} {

  const style = {...getProjectStyle(styleSpec)}

  const projectStyle = typeof style.projectStyle === 'string'
    ? style.projectStyle : undefined

  let {
    yattRoot,
    documentRoot,
    libDirs,
    yattSrcPrefix,
    outDir = style.outDir,
    linkDir = style.linkDir
  } = origConfig;

  yattSrcPrefix ??= style.yattSrcPrefix

  yattRoot ??= Path.normalize(
    yattSrcPrefix ? yattSrcPrefix + (style.yattRoot ?? "") :
      (style.yattRoot ?? ".")
  ) as string
  yattRoot = yattRoot.replace(/\/*$/, '/')

  documentRoot ??= Path.normalize(
    yattSrcPrefix ? yattSrcPrefix + (style.documentRoot ?? "") :
      (style.documentRoot ?? ".")
  ) as string
  documentRoot = documentRoot.replace(/\/*$/, '/')

  const defaultLibDirs = (yattSrcPrefix && style.libDirs)
    ? style.libDirs.map(d => yattSrcPrefix + d) : (style.libDirs ?? []);

  return {
    projectStyle,
    yattRoot,
    documentRoot,
    libDirs: typeof libDirs === 'string' ? [libDirs] : defaultLibDirs,
    yattSrcPrefix,
    outDir, linkDir
  }
}

export function extractProjectStyle<T extends YattProjectConfig>(
  config: T
): YattProjectConfig {
  const {yattSrcPrefix, yattRoot, documentRoot, libDirs, outDir, linkDir} = config
  return {yattSrcPrefix, yattRoot, documentRoot, libDirs, outDir, linkDir}
}
