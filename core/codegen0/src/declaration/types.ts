import type {
  PartBase, PartKind, Part, Widget, Action, Entity
} from './part.ts';
export type {
  PartBase, PartKind, Part, Widget, Action, Entity
} from './part.ts';

export type PartType = Widget | Action | Entity

export class TemplateDeclaration {

  constructor(
    public path: string,
    public folder: string,
    public partMap: PartMapType,
    public routeMap: RouteMapType,
    public partOrder: [PartKind, string][] // kind, name
  ) {}

  *[Symbol.iterator](): Generator<PartType> {
    yield* this.parts()
  }

  *parts(): Generator<PartType> {
    for (const [kind, name] of this.partOrder) {
      const partMap = this.partMap[kind]
      const part = partMap.get(name)
      if (part == null)
        throw new Error(`BUG: Unknown part ${kind} ${name}`)

      switch (kind) {
        case "widget": case "action": case "entity": {
          yield part
          break
        }
        default: {
          throw new Error(`BUG: unknown part kind ${kind} ${name}` as never)
        }
      }
    }
  }

}

export type PartMapType = {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  entity:  Map<string, Entity>;
  [k: string]: Map<string, PartBase>;
}

export type RouteMapType = Map<string, {part: Part, method?: string}>;
