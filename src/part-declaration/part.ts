import { RawPart } from 'lrxml-js'

export type PartSet = {[k: string]: Part}

export type Part = {
    type: string
    name: string
    is_public: boolean
    arg_dict: ArgDict
    raw_part: RawPart
}

export type DefaultFlag = "?" | "|" | "/"

export type VarDecl = {
    name: string
    type: string
    default?: [DefaultFlag, string]
}

export type ArgDict = {[k: string]: VarDecl}
