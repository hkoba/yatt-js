import {
  type BaseSession,
  type AttItem,
  ScanningContext
} from '../deps.ts'

import type {YattParams, YattConfig} from '../config.ts'

import {SourceRegistry, type SourceLoader} from './registry.ts'

import type { Part } from './part.ts'

import type { VarTypeMap } from './vartype.ts'

import type { TemplateDeclaration } from './types.ts'
import type { SessionTarget } from "@yatt/lrxml";


export type YattBuildConfig = YattConfig & {
  builders?: BuilderMap
  declCache?: DeclTree
  sourceCache?: SourceRegistry
  sourceLoader?: SourceLoader
  varTypeMap?: VarTypeMap
  entFns?: {[k: string]: any}
}

export function isBuilderSession(arg: YattBuildConfig | BuilderRequestSession)
: arg is BuilderRequestSession {
  return (arg as BuilderRequestSession).params != null
}

export type BuilderMap = Map<string, DeclarationProcessor>;

export interface DeclarationProcessor {
  readonly kind: string;
  createPart(
    ctx: BuilderContext, attlist: AttItem[]
  ): [Part, AttItem[]] | undefined
}

// Session は３階層にすべきか…
// single-file, visited(per request), shared(persistent)

export type BuilderSettings = {
  builders: BuilderMap
  params: YattParams
  varTypeMap: VarTypeMap
  declCache: DeclTree
  sourceCache: SourceRegistry
  entFns: {[k: string]: any}
}

export type BuilderRequestItems = {
  visited: Set<string>
}

export type BuilderRequestSession = BuilderSettings & BuilderRequestItems

export type TargetedBuilderSession = BuilderRequestSession & SessionTarget

export type DeclTree = Map<string, TemplateDeclaration>
export type DeclEntry = {modTimeMs: number, template: TemplateDeclaration}
export type DeclState = DeclEntry & {source: string, updated: boolean}

export type BuilderContext = BuilderContextClass<TargetedBuilderSession>

export class BuilderContextClass<S extends TargetedBuilderSession>
extends ScanningContext<S> {
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
      const entry = this.stash.get(key);
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
