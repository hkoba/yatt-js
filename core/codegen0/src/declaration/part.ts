import { RawPart, AttItem } from 'lrxml'

import { Variable } from './vartype'

export type Part = Widget | Action | Entity
export type PartKind = Part['kind']

export type PartBase = {
  kind: string
  name: string
  nameNode?: AttItem
  is_public: boolean
  argMap: Map<string, Variable>;
  varMap: Map<string, Variable>;
  raw_part?: RawPart //
  route?: string
}

export type Widget = PartBase & {
  kind: "widget"
}

export function makeWidget(name: string, isPublic: boolean, nameNode?: AttItem): Widget {
  return {
    kind: "widget", name, nameNode, is_public: isPublic,
    argMap: new Map, varMap: new Map
  }
}

export type Action = PartBase & {
  kind: "action"
}

export type Entity = PartBase & {
  kind: "entity"
}
