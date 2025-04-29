import type {TemplateDeclaration} from '../declaration/index.ts'

import type {CGenRequestSession} from './context.ts'

export interface TranspileOutput {
  outputText: string;
  template: TemplateDeclaration;
  session: CGenRequestSession;
  sourceMapText?: string;
}
