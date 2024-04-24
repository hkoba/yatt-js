import {TemplateDeclaration} from '../declaration/index.ts'

import {CGenSession} from './context.ts'

export interface TranspileOutput {
  outputText: string;
  template: TemplateDeclaration;
  templateName: string[];
  session: CGenSession;
  sourceMapText?: string;
}
