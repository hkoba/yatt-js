import {LrxmlParams} from 'lrxml-js'

export type YattParams = LrxmlParams & {
  outDir?: string;
  templateNamespace?: string;
  noEmit: boolean;
  body_argument_name: string;
  debug: {parser?: number, declaration?: number}
}
export type YattConfig = Partial<YattParams>;

export function yattParams(
  config: YattConfig & {doc_root?: string}
): YattParams {
  let {
    namespace = ["yatt"],
    doc_root,
    rootDir,
    outDir,
    templateNamespace,
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
    noEmit,
    default_part,
    compat_end_of_comment,
    body_argument_name,
    debug
  }
}
