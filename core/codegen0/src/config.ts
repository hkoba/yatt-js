import {LrxmlParams, lrxmlParams} from '@yatt/lrxml'

export const yattRcFile = ".htyattrc"

export type YattParams = LrxmlParams & {
  outDir?: string;
  libDirs: string[]
  lookup_subdirectory_first: boolean
  templateNamespace?: string;
  exportNamespace?: boolean;
  connectionTypeName: string,
  noEmit: boolean;
  body_argument_name: string;
  debug: {
    parser?: number,
    declaration?: number,
    codegen?: number
  }
}
export type YattConfig = Partial<Omit<YattParams, 'libDirs'>> & {
  libDirs?: string | string[]
};

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
    outDir,
    libDirs = [],
    lookup_subdirectory_first = false,
    templateNamespace,
    exportNamespace,
    connectionTypeName = 'Connection',
    noEmit = false,
    body_argument_name = "BODY",
  } = config;

  return {
    ...lrxmlDefault,
    outDir,
    libDirs: typeof(libDirs) === "string" ? [libDirs] : libDirs,
    lookup_subdirectory_first,
    templateNamespace,
    exportNamespace,
    connectionTypeName,
    noEmit,
    body_argument_name
  }
}
