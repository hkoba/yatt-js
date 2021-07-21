import { Part } from './part'

export type Widget = Part & {
  kind: "widget"
}

export function makeWidget(name: string, isPublic: boolean): Widget {
  return {
    kind: "widget", name, is_public: isPublic,
    argMap: new Map, varMap: new Map
  }
}
