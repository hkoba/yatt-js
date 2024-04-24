import {
  ParserSession,
  ScanningContext,
  AttItem
} from '../deps.ts'

import {YattParams, YattConfig} from '../config.ts'

import { Part } from './part.ts'

import { VarTypeMap } from './vartype.ts'

import { TemplateDeclaration } from './types.ts'

export type YattBuildConfig = YattConfig & {
  builders?: BuilderMap
  declCacheSet?: DeclarationCacheSet
  varTypeMap?: VarTypeMap
  entFns?: {[k: string]: any}
}

export type BuilderMap = Map<string, DeclarationProcessor>;

export interface DeclarationProcessor {
  readonly kind: string;
  createPart(ctx: BuilderContext, attlist: AttItem[]): [Part, AttItem[]] | undefined
}

export type BuilderSession = ParserSession & {
  builders: BuilderMap
  params: YattParams
  varTypeMap: VarTypeMap
  declCacheSet: DeclarationCacheSet
  visited: Map<string, boolean>
  entFns: {[k: string]: any}
}

export type DeclarationCacheSet = {[k: string]: DeclTree}

export type DeclTree = Map<string, {modTime: number, tree: TemplateDeclaration}>

export type BuilderContext = BuilderContextClass<BuilderSession>

export class BuilderContextClass<S extends BuilderSession> extends ScanningContext<S> {
  public debug: number = 0
  stash: Map<[string, string], any>;
  constructor(session: S,
              index: number = 0,
              start: number = 0,
              end: number = session.source.length,
              parent?: BuilderContextClass<S>) {
    super(session, index, start, end, parent)
    this.stash = new Map;
    if (session.params.debug.declaration !== undefined) {
      this.debug = session.params.debug.declaration
    }
  }

  is_body_argument(name: string): boolean {
    return this.session.params.body_argument_name === name
  }
  body_argument_name(): string {
    return this.session.params.body_argument_name;
  }

  append_stash(key: [string, string], value: any): void {
    if (! this.stash.has(key)) {
      this.stash.set(key, [value])
    } else {
      let entry = this.stash.get(key);
      entry.push(value)
      this.stash.set(key, entry)
    }
  }

  copy_array<T>(ary: T[]): T[] {
    return Object.assign([], ary)
  }

  dirname(path: string): string {
    return path.replace(/[^\/]+$/, '')
  }

  baseModName(path: string): string {
    return path.replace(/(^.*\/)?/, '').replace(/\.\w+$/, '')
  }
}
