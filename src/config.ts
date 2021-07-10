import {LrxmlParams} from 'lrxml-js'

export type YattParams = LrxmlParams
export type YattConfig = Partial<YattParams>

export function yattParams(config: YattConfig): YattParams {
  let {
    namespace = ["yatt"],
    doc_root = "",
    default_part = "page",
    compat_end_of_comment = false,
    debug = {}
  } = config;

  return {
    namespace,
    doc_root,
    default_part,
    compat_end_of_comment,
    debug
  }
}
