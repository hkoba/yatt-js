import {
  type AttItem,
  ScanningContext
} from '../deps.ts'

import type {YattParams, YattConfig} from '../config.ts'

import type {SourceRegistry, SourceLoader} from './registry.ts'

import type { Part } from './part.ts'

import type { VarTypeMap } from './vartype.ts'

import type { TemplateDeclaration } from './types.ts'
import type { SessionTarget } from "@yatt/lrxml";

import type {OutputItem} from '../codegen0/output.ts'
import { ParserContext, ParserSession } from "../../../lrxml/src/context.ts";

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
  process(
    ctx: BuilderContext, template: TemplateDeclaration, attlist: AttItem[]
  ): Promise<[Part, AttItem[]] | undefined>
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
  templateFolderMap: Map<string, string>
}


export type BuilderRequestItems = {
  visited: Set<string>
  output: OutputRecord[]
}

// XXX: ../codegen0/output.ts: TranspileOutput と統合する？
export type OutputRecord = {
  folder: string
  modName: string
  output: OutputItem
}

export type BuilderRequestSession = BuilderSettings & BuilderRequestItems

export type TargetedBuilderSession = BuilderRequestSession & SessionTarget

export type DeclTree = Map<string, TemplateDeclaration>
import type {DeclEntry} from './types.ts'
export type DeclState = DeclEntry & {source: string, updated: boolean}

export type BuilderContext = BuilderContextClass<TargetedBuilderSession>

export class BuilderContextClass<S extends TargetedBuilderSession>
extends ScanningContext<S> {
  public debug: number = 0
  constructor(session: S,
              index: number = 0,
              start: number = 0,
              end: number = session.source.length,
              parent?: BuilderContextClass<S>) {
    super(session, index, start, end, parent)
    if (session.params.debug.declaration !== undefined) {
      this.debug = session.params.debug.declaration
    }
  }

  parserContext(): ParserContext {
    const session: ParserSession = {
      patterns: {},
      params: this.session.params,
      filename: this.session.filename,
      source: this.session.source
    }
    return new ParserContext(session, this.index, this.start, this.end)
  }

  is_body_argument(name: string): boolean {
    return this.session.params.body_argument_name === name
  }
  body_argument_name(): string {
    return this.session.params.body_argument_name;
  }

  copy_array<T>(ary: T[]): T[] {
    return Object.assign([], ary)
  }
}
