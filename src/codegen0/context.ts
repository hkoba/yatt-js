import {ScanningContext} from 'lrxml-js'

import { TemplateDeclaration, BuilderSession, Part } from '../declaration/'

export type CGenSession  = BuilderSession & {
  templateName: string
}

export class CodeGenContext<T extends Part> extends ScanningContext<CGenSession> {
  public hasThis: boolean
  constructor(
    public template: TemplateDeclaration, public part: T,
    session: CGenSession,
    params?: {hasThis?: boolean}
  ) {
    super(session, 0, 0, session.source.length)
    this.hasThis = params && params.hasThis != null ? params.hasThis : false;
  }
}
