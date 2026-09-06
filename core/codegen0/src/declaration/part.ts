import type { Payload, AttItem } from '../deps.ts'

import type { Variable } from './vartype.ts'

import type {RouteSpec} from './types.ts'

export type Part = Widget | Action | Entity
export type PartKind = Part['kind']

export type PartBase = {
  kind: string
  name: string
  nameNode?: AttItem
  is_public: boolean
  argMap: Map<string, Variable>;
  varMap: Map<string, Variable>;
  payloads: Payload[]
  route?: RouteSpec
}

export type Widget = PartBase & {
  kind: "widget"
  implicit?: boolean
}

export type Action = PartBase & {
  kind: "action"
}

export type Entity = PartBase & {
  kind: "entity"
}
