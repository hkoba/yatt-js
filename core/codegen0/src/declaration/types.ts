import type {
  PartBase, PartKind, Part, Widget, Action, Entity
} from './part.ts';
export type {
  PartBase, PartKind, Part, Widget, Action, Entity
} from './part.ts';

export type PartType = Widget | Action | Entity

export type TemplateDeclaration = {
  modName: string;
  realDir: string;
  path: string;
  folder: string;
  partMap: PartMapType;
  routeMap: RouteMapType;
  partOrder: [PartKind, string][]; // kind, name
}

export type PartMapType = {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  entity:  Map<string, Entity>;
  [k: string]: Map<string, PartBase>;
}

export type RouteMapType = Map<string, {part: Part, method?: string}>;
