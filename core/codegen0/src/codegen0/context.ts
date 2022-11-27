import {
  TemplateDeclaration, BuilderSession, Widget
  , BuilderContextClass
} from '../declaration/'

import {MacroDict} from './macro'

import {primaryNS, entFnPrefix} from '../config'

import {commonPrefix} from '../utils/commonPrefix'

export type CGenSession  = BuilderSession & {
  templateName: string[]
  macro: MacroDict
  entFns: {[k: string]: any}
  importDict?: {[k: string]: string}
}

export type CodeGenContext = CodeGenContextClass<CGenSession>

export class CodeGenContextClass<S extends CGenSession>
  extends BuilderContextClass<S> {

    public hasThis: boolean;

    constructor(
      public template: TemplateDeclaration, public part: Widget,
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

import {CodeFragment} from './codefragment'

// XXX: For future sourcemap support
export function finalize_codefragment(
  ctx: BuilderContextClass<CGenSession>,
  fragments: CodeFragment[]
): string {
  let program = ""
  for (const item of fragments) {
    if (typeof(item) === "string") {
      program += item
    }
    else if (item instanceof Array) {
      program += finalize_codefragment(ctx, item)
    }
    else {
      switch (item.kind) {
        case "name": case "other":
          program += item.code;
          break;
        default:
          ctx.NEVER(item)
      }
    }
  }
  return program
}
