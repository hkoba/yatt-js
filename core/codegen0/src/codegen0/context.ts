import {ScanningContext} from 'lrxml'

import {
  TemplateDeclaration, BuilderSession, Widget
  , BuilderContextClass
} from '../declaration/'

import {MacroDict} from './macro'

import {primaryNS, entFnPrefix} from '../config'

export type CGenSession  = BuilderSession & {
  templateName: string[]
  macro: MacroDict
  entFns: {[k: string]: any}
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
        case "name":
          program += item.text;
          break;
        default:
          ctx.NEVER()
      }
    }
  }
  return program
}
