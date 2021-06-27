export interface LrxmlConfig {
  namespace?: string[]
  doc_root?: string
  default_part?: string
  compat_end_of_comment?: boolean
  debug?: {
    parser?: number
  }
}

export interface LrxmlParams {
  namespace: string[]
  doc_root: string
  default_part: string
  compat_end_of_comment: boolean
  debug: {
    parser?: number
  }
}

export function lrxmlParams(config: LrxmlConfig): LrxmlParams {
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
