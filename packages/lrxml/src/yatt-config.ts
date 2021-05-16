export interface YattConfig {
    namespace?: string[]
    doc_root?: string
    default_part?: string
    debug?: {
        parser?: number
    }
}

export interface YattParams {
    namespace: string[]
    doc_root: string
    default_part: string
    debug: {
        parser?: number
    }
}

export function yattParams(config: YattConfig): YattParams {
    let {
        namespace = ["yatt"],
        doc_root = "",
        default_part = "page",
        debug = {}
    } = config;
    

    return {
        namespace,
        doc_root,
        default_part,
        debug
    }
}
