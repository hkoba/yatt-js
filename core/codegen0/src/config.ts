import {LrxmlParams} from 'lrxml'

export type YattParams = LrxmlParams & {
  outDir?: string;
  templateNamespace?: string;
  exportNamespace?: boolean;
  entFnsFile?: string,
  connectionTypeName: string,
  noEmit: boolean;
  body_argument_name: string;
  debug: {parser?: number, declaration?: number}
}
export type YattConfig = Partial<YattParams>;

export function primaryNS(params: YattParams): string {
  return params.namespace[0]
}

export function entFnPrefix(params: YattParams): string {
  return '$' + primaryNS(params)
}

export function yattParams(
  config: YattConfig & {doc_root?: string}
): YattParams {
  let {
    namespace = ["yatt"],
    doc_root,
    rootDir,
    outDir,
    templateNamespace,
    exportNamespace,
    entFnsFile,
    connectionTypeName = 'Connection',
    noEmit = false,
    default_part = "page",
    compat_end_of_comment = false,
    body_argument_name = "BODY",
    debug = {}
  } = config;

  return {
    namespace,
    rootDir: rootDir ?? doc_root,
    outDir,
    templateNamespace,
    exportNamespace,
    entFnsFile,
    connectionTypeName,
    noEmit,
    default_part,
    compat_end_of_comment,
    body_argument_name,
    debug
  }
}
