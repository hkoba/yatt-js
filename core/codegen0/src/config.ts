import {LrxmlParams, lrxmlParams, IsLrxmlParams} from '@yatt/lrxml'

export const yattRcFile = ".htyattrc"

import {YattProjectParams, applyProjectStyle} from "./project/layout"

import {CGenMacro} from "./codegen0/macro"

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
    && arg.rootDir != null && arg.libDirs != null
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
  let {
    rootDir, libDirs, outDir, linkDir, yattSrcPrefix, projectStyle,
    lookup_subdirectory_first = false,
    templateNamespace,
    exportNamespace,
    connectionTypeName = 'Connection',
    noEmit = false,
    body_argument_name = "BODY",
  } = config;

  return {
    ...lrxmlDefault,
    ...applyProjectStyle(
      {rootDir, libDirs, outDir, linkDir, yattSrcPrefix},
      projectStyle
    ),
    lookup_subdirectory_first,
    templateNamespace,
    exportNamespace,
    connectionTypeName,
    noEmit,
    body_argument_name
  }
}
