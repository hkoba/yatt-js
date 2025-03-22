import type {TemplateDeclaration} from '../declaration/index.ts'

import type {CGenBaseSession} from './context.ts'

export interface TranspileOutput {
  outputText: string;
  template: TemplateDeclaration;
  session: CGenBaseSession;
  sourceMapText?: string;
}
