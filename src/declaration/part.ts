import { RawPart } from 'lrxml-js'

import { Variable } from './vartype'

export type Part = {
  kind: string
  name: string
  is_public: boolean
  argMap: Map<string, Variable>;
  varMap: Map<string, Variable>;
  raw_part?: RawPart //
  route?: string
}

export type Widget = Part & {
  kind: "widget"
}

export function makeWidget(name: string, isPublic: boolean): Widget {
  return {
    kind: "widget", name, is_public: isPublic,
    argMap: new Map, varMap: new Map
  }
}

export type Action = Part & {
  kind: "action"
}

export type Entity = Part & {
  kind: "entity"
}
