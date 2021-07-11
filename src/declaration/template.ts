import { Part } from './part'

export type TemplateDeclaration = {
  path: string
  partMap: Map<[string, string], Part>;
  routes: Map<string, Part>;
}
