#!/usr/bin/env ts-node

export type YattProjectParams = {
  rootDir: string
  libDirs: string[]
  outDir?: string
  linkDir?: string
  yattSrcPrefix?: string
}

export type YattProjectStyle = {
  rootDir?: string
  libDirs?: string[]
  outDir?: string
  linkDir?: string
  projectStyle?: string | YattProjectStyle
  yattSrcPrefix?: string
}

const projectStyles: {[k: string]: YattProjectStyle} = {
  "default": {
    projectStyle: "default",
    rootDir:       "pages/",
    libDirs:      ["widgets/"],
    outDir:    "gen/",
    linkDir:   "src/"
  }
}

type YattProjectConfig = Partial<Omit<YattProjectParams, 'libDirs'>> & {
  libDirs?: string | string[]
  projectStyle?: string
}

function getProjectStyle(styleSpec: string | YattProjectStyle)
: YattProjectStyle {
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
  styleSpec: string | YattProjectStyle = "default"
): YattProjectParams {

  const style = {...getProjectStyle(styleSpec)}

  let {
    rootDir,
    libDirs,
    yattSrcPrefix,
    outDir = style.outDir,
    linkDir = style.linkDir
  } = origConfig;

  yattSrcPrefix ??= style.yattSrcPrefix

  // XXX: path.normalize???
  const defaultRootDir = yattSrcPrefix
    ? yattSrcPrefix + (style.rootDir ?? "") : "./"

  const defaultLibDirs = (yattSrcPrefix && style.libDirs)
    ? style.libDirs.map(d => yattSrcPrefix + d) : [];

  return {
    rootDir: rootDir ?? defaultRootDir,
    libDirs: typeof libDirs === 'string' ? [libDirs] : defaultLibDirs,
    yattSrcPrefix,
    outDir, linkDir
  }
}

export function extractProjectStyle<T extends YattProjectConfig>(
  config: T
): YattProjectConfig {
  const {yattSrcPrefix, rootDir, libDirs, outDir, linkDir} = config
  return {yattSrcPrefix, rootDir, libDirs, outDir, linkDir}
}
