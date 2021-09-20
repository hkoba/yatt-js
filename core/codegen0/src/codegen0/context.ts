import {ScanningContext} from 'lrxml-js'

import { TemplateDeclaration, BuilderSession, Widget } from '../declaration/'

export type CGenSession  = BuilderSession & {
  templateName: string[]
}

export class CodeGenContext extends ScanningContext<CGenSession> {
  public hasThis: boolean
  constructor(
    public template: TemplateDeclaration, public part: Widget,
    session: CGenSession,
    params?: {hasThis?: boolean}
  ) {
    super(session, 0, 0, session.source.length)
    this.hasThis = params && params.hasThis != null ? params.hasThis : false;
  }
}
