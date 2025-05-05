import {dirname} from 'node:path'

import type {YattConfig} from '../config.ts'

import type {
  YattBuildConfig,
  TemplateDeclaration, BuilderSettings, Part, Widget, Entity
} from '../declaration/index.ts'

import {baseModName, internTemplateFolder} from '../declaration/index.ts'

import {
  BuilderContextClass, declarationBuilderSession,
  type BuilderRequestItems
} from '../declaration/index.ts'

export type {Part, Widget, Entity} from '../declaration/index.ts'

import type {MacroDict} from './macro.ts'

import {primaryNS, entFnPrefix} from '../config.ts'
import type { SessionTarget } from "@yatt/lrxml";

import {builtinMacros} from './macro/index.ts'

export type CodeKind = 'namespace' | 'module' | 'populator'

export type YattCGenConfig = YattBuildConfig & {
  macro?: MacroDict
}

export type CGenSettings  = BuilderSettings & YattCGenConfig & {
  cgenStyle: CodeKind
  macro: MacroDict
}

export type CGenRequestSession = CGenSettings & BuilderRequestItems & {
  indentLevel: number
}

export type TargetedCGenSession = CGenRequestSession & SessionTarget & {
  templateName: string[]
  importDict: {[k: string]: TemplateDeclaration}
}

export function cgenSettings(
  cgenStyle: CodeKind, origConfig: YattConfig | YattCGenConfig
): CGenSettings {
  const builder_session = declarationBuilderSession(origConfig)
  const session: CGenSettings = {
    ...builder_session,
    cgenStyle,
    macro: Object.assign({}, builtinMacros, origConfig.macro ?? {}),
  }

  return session;
}

export function freshCGenSession(base: CGenSettings)
: CGenRequestSession {
  const fresh = {
    ...base
    , visited: new Set<string>
    , output: []
    , indentLevel: 0
  }
  return fresh
}

export type WidgetGenContext = CodeGenContext<Widget>
export type EntityGenContext = CodeGenContext<Entity>

export type CodeGenContext<T extends Part> = CodeGenContextClass<T>

export class CodeGenContextClass<
  PartT extends Part,
  S extends TargetedCGenSession = TargetedCGenSession
> extends BuilderContextClass<S> {

    public hasThis: boolean;

    constructor(
      public template: TemplateDeclaration, public part: PartT,
      session: S,
      params?: {hasThis?: boolean}
    ) {
      super(session, 0, 0, session.source.length)
      this.hasThis = params && params.hasThis != null ? params.hasThis : false;
    }

    primaryNS(): string {
      return primaryNS(this.session.params)
    }

    entFnPrefix(): string {
      return entFnPrefix(this.session.params)
    }

    addImport(template: TemplateDeclaration) {
      if (this.session.importDict[template.path] == null) {
        this.session.importDict[template.path] = template
      }
    }
}

export function indent(session: CGenRequestSession): string {
  return "  ".repeat(session.indentLevel)
}

export class IndentScope {
  savedIndentLevel: number
  constructor(public session: CGenRequestSession, newLevel?: number) {
    this.savedIndentLevel = session.indentLevel
    if (newLevel != null) {
      session.indentLevel = newLevel
    } else {
      session.indentLevel++
    }
  }

  reset(): void {
    this.session.indentLevel = this.savedIndentLevel + 1
  }

  [Symbol.dispose]() {
    this.session.indentLevel = this.savedIndentLevel
  }
}

export {finalize_codefragment} from './codefragment.ts'

