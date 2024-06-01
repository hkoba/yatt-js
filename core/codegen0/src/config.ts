import {type LrxmlParams, lrxmlParams, IsLrxmlParams} from './deps.ts'

export const yattRcFile = ".htyattrc"

import {type YattProjectParams, applyProjectStyle} from "./project/layout.ts"

import type {CGenMacro} from "./codegen0/macro.ts"

export type YattParams = LrxmlParams & YattProjectParams & {
  projectStyle?: string
  lookup_subdirectory_first: boolean
  templateNamespace?: string;
  exportNamespace?: boolean;
  connectionTypeName: string,
  noEmit: boolean;
  body_argument_name: string;
  macro?: Partial<CGenMacro>,
  es?: boolean,
  genFileSuffix?: string,
  debug: {
    build?: number,
    codegen?: number,
    declaration?: number,
    parser?: number
  }
}
export type YattConfig = Partial<Omit<YattParams, 'libDirs'>> & {
  libDirs?: string | string[]
};

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
    yattSrcPrefix, projectStyle,
    lookup_subdirectory_first = false,
    templateNamespace,
    exportNamespace,
    genFileSuffix = '.ts',
    connectionTypeName = 'Connection',
    noEmit = false,
    body_argument_name = "BODY",
  } = config;

  return {
    ...lrxmlDefault,
    ...applyProjectStyle(
      {yattRoot, documentRoot, libDirs, outDir, linkDir, yattSrcPrefix},
      projectStyle
    ),
    lookup_subdirectory_first,
    templateNamespace,
    exportNamespace,
    connectionTypeName,
    noEmit,
    genFileSuffix,
    body_argument_name
  }
}
