import type {TemplateDeclaration} from '../declaration/index.ts'

import type {CGenSession} from './context.ts'

export interface TranspileOutput {
  outputText: string;
  template: TemplateDeclaration;
  templateName: string[];
  session: CGenSession;
  sourceMapText?: string;
}
