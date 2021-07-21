import {LrxmlParams} from 'lrxml-js'

export type YattParams = LrxmlParams & {
  body_argument_name: string;
  debug: {parser?: number, declaration?: number}
}
export type YattConfig = Partial<YattParams>

export function yattParams(config: YattConfig): YattParams {
  let {
    namespace = ["yatt"],
    doc_root = "",
    default_part = "page",
    compat_end_of_comment = false,
    body_argument_name = "BODY",
    debug = {}
  } = config;

  return {
    namespace,
    doc_root,
    default_part,
    compat_end_of_comment,
    body_argument_name,
    debug
  }
}
