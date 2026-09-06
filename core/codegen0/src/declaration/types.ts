import type {
  PartBase, PartKind, Part, Widget, Action, Entity
} from './part.ts';
export type {
  PartBase, PartKind, Part, Widget, Action, Entity
} from './part.ts';

import type {AttItem} from '../deps.ts'

export type PartType = Widget | Action | Entity

export type DeclEntry = {
  kind: 'template';
  modTimeMs: number;
  template: TemplateDeclaration
}

export type VFS_Item = VFS_Folder | DeclEntry

export type VFS_Folder = {
  kind: 'folder';
  path: string;
}

export type TemplateDeclaration = {
  modName: string;
  path: string; // fullpath of template file
  realDir: string;
  runtimeNamespace: string; // namespace for generated code
  partMap: PartMapType;
  routeMap: RouteMapType;
  partOrder: [PartKind, string][]; // kind, name
  base: VFS_Item[]
}

export type PartMapType = {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  entity:  Map<string, Entity>;
  [k: string]: Map<string, PartBase>;
}

export type RouteMapType = Map<string, RoutePatternEntry>
export type RoutePatternEntry = {
  pattern: string, // original pattern
  byMethod: Map<string, {part: Part, nameNode?: AttItem}>
}

export type RouteSpec = {
  pattern: string
  method: string[]
  nameNode: AttItem
}
