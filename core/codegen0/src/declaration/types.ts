import { PartBase, PartKind, Part, Widget, Action, Entity } from './part'

export type TemplateDeclaration = {
  path: string
  folder: string
  partOrder: [PartKind, string][]; // kind, name
  partMap: PartMapType;
  routeMap: RouteMapType;
}

export interface PartMapType {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  entity:  Map<string, Entity>;
  [k: string]: Map<string, PartBase>;
}

export type RouteMapType = Map<string, {part: Part}>;
