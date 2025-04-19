import type {YattConfig} from '../config.ts'

import type {
  YattBuildConfig,
  TemplateDeclaration, BuilderBaseSession, Part, Widget, Entity
} from '../declaration/index.ts'

import { BuilderContextClass, declarationBuilderSession } from '../declaration/index.ts'

export type {Part, Widget, Entity} from '../declaration/index.ts'

import type {MacroDict} from './macro.ts'

import {primaryNS, entFnPrefix} from '../config.ts'
import type { SessionTarget } from "@yatt/lrxml";

import {builtinMacros} from './macro/index.ts'

export type CodeKind = 'namespace' | 'module' | 'populator'

export type YattCGenConfig = YattBuildConfig & {
  macro?: MacroDict
}

export type CGenBaseSession  = BuilderBaseSession & YattCGenConfig & {
  cgenStyle: CodeKind
  macro: MacroDict
  importDict?: {[k: string]: string}
}

export type CGenSession = CGenBaseSession & SessionTarget & {
  templateName: string[]
}

export function cgenSession(cgenStyle: CodeKind, origConfig: YattConfig | YattCGenConfig)
: CGenBaseSession {
  const builder_session = declarationBuilderSession(origConfig)
  const session: CGenBaseSession = {
    ...builder_session,
    cgenStyle,
    macro: Object.assign({}, builtinMacros, origConfig.macro ?? {}),
  }

  return session;
}

export function freshCGenSession(base: CGenBaseSession)
: CGenBaseSession {
  const fresh = {...base, visited: new Set<string>}
  return fresh
}

export type WidgetGenContext = CodeGenContext<Widget>
export type EntityGenContext = CodeGenContext<Entity>

export type CodeGenContext<T extends Part> = CodeGenContextClass<T>

export class CodeGenContextClass<PartT extends Part, S extends CGenSession = CGenSession>
  extends BuilderContextClass<S> {

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

    addImport(pathName: string) {
      if (this.session.importDict == null) {
        this.throw_error(`BUG! call of addImport for ${pathName}`)
      }
      if (this.session.importDict[pathName] == null) {
        const thatDir = this.dirname(pathName)
        const thisDir = this.dirname(this.session.filename ?? '')
        if (thisDir !== thatDir) {
          this.NIMPL(`thisDir ${thisDir} != thatDir ${thatDir}`)
        }
        this.session.importDict[pathName] = this.baseModName(pathName)
      }
      return this.session.importDict[pathName]
    }
}

export {finalize_codefragment} from './codefragment.ts'

