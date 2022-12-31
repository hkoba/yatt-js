import {TemplateDeclaration} from '../declaration'

import {CGenSession} from './context'

export interface TranspileOutput {
  outputText: string;
  template: TemplateDeclaration;
  templateName: string[];
  session: CGenSession;
  sourceMapText?: string;
}
