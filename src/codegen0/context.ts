import {ScanningContext} from 'lrxml-js'

import { TemplateDeclaration, BuilderSession, Part } from '../declaration/'

export type CGenSession  = BuilderSession & {
}

export class CodeGenContext<T extends Part> extends ScanningContext<CGenSession> {
  constructor(
    public template: TemplateDeclaration, public part: T,
    session: CGenSession
  ) {
    super(session, 0, 0, session.source.length)
  }
}
