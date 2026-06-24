#!/usr/bin/env -S deno run

import * as Path from "node:path"

export type YattProjectParams = {
  yattRoot: string
  documentRoot: string
  libDirs: string[]
  outDir?: string
  linkDir?: string
  yattSrcPrefix?: string
  // client(browser) side TypeScript sources (see docs/discuss/browser-js.md).
  // `clientExt` is the marker extension used to recognize client entry points
  // (e.g. `*.client.ts`). `clientDirs` are dedicated source roots for the
  // "role-split" layout; when empty, client sources are discovered co-located
  // with templates ("endpoint" layout). `bundleOutDir` is the FileSink target.
  clientDirs?: string[]
  clientExt?: string
  bundleOutDir?: string
}

export type YattProjectStyle = {
  yattRoot?: string
  documentRoot?: string
  libDirs?: string[]
  outDir?: string
  linkDir?: string
  projectStyle?: string | YattProjectStyle
  yattSrcPrefix?: string
  clientDirs?: string[]
  clientExt?: string
  bundleOutDir?: string
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
  },
  // "endpoint": polyglot small-team layout — templates and their client TS live
  // together under public/, client entries marked by `*.client.ts`.
  "endpoint": {
    projectStyle: "endpoint",
    yattRoot:     "./",
    documentRoot: "public/",
    libDirs:     [],
    clientExt:    ".client.ts",
    bundleOutDir: "public/_dist/",
  },
  // "role-split": designer + dedicated-JS-dev layout — server templates under
  // public/, client TS in a separate tree (e.g. client/ or browser/).
  "role-split": {
    projectStyle: "role-split",
    yattRoot:     "./",
    documentRoot: "public/",
    libDirs:     [],
    clientDirs:  ["client/"],
    clientExt:    ".ts",
    bundleOutDir: "dist/",
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
    clientDirs,
    yattSrcPrefix,
    outDir = style.outDir,
    linkDir = style.linkDir,
    clientExt = style.clientExt,
    bundleOutDir = style.bundleOutDir,
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

  const defaultClientDirs = (yattSrcPrefix && style.clientDirs)
    ? style.clientDirs.map(d => yattSrcPrefix + d) : (style.clientDirs ?? undefined);

  return {
    projectStyle,
    yattRoot,
    documentRoot,
    libDirs: typeof libDirs === 'string' ? [libDirs] : defaultLibDirs,
    clientDirs: clientDirs ?? defaultClientDirs,
    clientExt,
    bundleOutDir,
    yattSrcPrefix,
    outDir, linkDir
  }
}

export function extractProjectStyle<T extends YattProjectConfig>(
  config: T
): YattProjectConfig {
  const {
    yattSrcPrefix, yattRoot, documentRoot, libDirs, outDir, linkDir,
    clientDirs, clientExt, bundleOutDir
  } = config
  return {
    yattSrcPrefix, yattRoot, documentRoot, libDirs, outDir, linkDir,
    clientDirs, clientExt, bundleOutDir
  }
}
