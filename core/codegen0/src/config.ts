import {type LrxmlParams, lrxmlParams, IsLrxmlParams} from './deps.ts'

import {type YattProjectParams, applyProjectStyle} from "./project/layout.ts"

import type {CGenMacro} from "./codegen0/macro.ts"

export type YattParams = LrxmlParams & YattProjectParams & {
  projectStyle?: string
  lookup_subdirectory_first: boolean
  templateNamespace?: string
  connectionTypeName: string
  noEmit: boolean;
  body_argument_name: string
  entityDefinitionsFile?: string
  macro?: Partial<CGenMacro>
  es?: boolean
  genFileSuffix?: string
  allowedRouteMethods: readonly string[]
  debug: {
    build?: number,
    codegen?: number,
    declaration?: number,
    cache?: number,
    parser?: number
  }
}
export type YattConfig = Partial<Omit<YattParams, 'libDirs'>> & {
  libDirs?: string | string[]
};

export const DEFAULT_ALLOWED_ROUTE_METHODS = [
  "get", "post", "head", "put", "delete", "patch", "options"
] as const;

export function isYattParams(arg: YattConfig | YattParams): arg is YattParams {
  return IsLrxmlParams(arg)
    && arg.yattRoot != null
    && arg.documentRoot != null && arg.libDirs != null
    && arg.connectionTypeName != null
    && arg.body_argument_name != null
}

export function primaryNS(params: YattParams): string {
  return params.namespace[0]
}

export function entFnPrefix(params: YattParams): string {
  return '$' + primaryNS(params)
}

export function yattParams(
  config: YattConfig
): YattParams {
  const lrxmlDefault = lrxmlParams(config)
  const {
    yattRoot, documentRoot, libDirs, outDir, linkDir,
    clientDirs, clientExt, bundleOutDir,
    yattSrcPrefix, projectStyle,
    entityDefinitionsFile,
    lookup_subdirectory_first = false,
    templateNamespace,
    genFileSuffix = '.ts',
    connectionTypeName = 'Connection',
    noEmit = false,
    body_argument_name = "BODY",
    allowedRouteMethods = DEFAULT_ALLOWED_ROUTE_METHODS
  } = config;

  if (allowedRouteMethods.find((v) => v === "*")) {
    throw new Error(`allowedRouteMethods should not contain '*'`)
  }

  return {
    ...lrxmlDefault,
    ...applyProjectStyle(
      {yattRoot, documentRoot, libDirs, outDir, linkDir, yattSrcPrefix,
       clientDirs, clientExt, bundleOutDir},
      projectStyle
    ),
    lookup_subdirectory_first,
    templateNamespace,
    connectionTypeName,
    noEmit,
    genFileSuffix,
    body_argument_name,
    entityDefinitionsFile,
    allowedRouteMethods,
  }
}
