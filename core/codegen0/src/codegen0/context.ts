import {ScanningContext} from 'lrxml-js'

import {
  TemplateDeclaration, BuilderSession, Widget
  , BuilderContextClass
} from '../declaration/'

import {MacroDict} from './macro'

export type CGenSession  = BuilderSession & {
  templateName: string[]
  macro: MacroDict
  entFns: {[k: string]: any}
}

export type CodeGenContext = CodeGenContextClass<CGenSession>

export class CodeGenContextClass<S extends CGenSession>
  extends BuilderContextClass<S> {
  public hasThis: boolean
  constructor(
    public template: TemplateDeclaration, public part: Widget,
    session: S,
    params?: {hasThis?: boolean}
  ) {
    super(session, 0, 0, session.source.length)
    this.hasThis = params && params.hasThis != null ? params.hasThis : false;
  }
}
