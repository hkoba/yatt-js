export interface LrxmlParams {
  namespace: string[]
  ext_public: string
  ext_private: string
  rootDir?: string
  default_part: string
  compat_end_of_comment: boolean
  debug: {
    parser?: number
    lexer?: number
  }
}

export type LrxmlConfig = Partial<LrxmlParams>;

export function lrxmlParams(
  config: LrxmlConfig & {doc_root?: string}
): LrxmlParams {
  let {
    namespace = ["yatt"],
    ext_public = ".ytjs",
    ext_private = ".ytcomp", // component
    doc_root, rootDir,
    default_part = "page",
    compat_end_of_comment = false,
    debug = {}
  } = config;

  return {
    namespace,
    ext_public, ext_private,
    rootDir: rootDir ?? doc_root,
    default_part,
    compat_end_of_comment,
    debug
  }
}
