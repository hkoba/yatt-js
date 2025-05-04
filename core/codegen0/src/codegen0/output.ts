import type {TemplateDeclaration} from '../declaration/index.ts'

import type {CGenRequestSession} from './context.ts'

export type OutputItem = {
  outputText: string;
  sourceMapText?: string;
}

export interface TranspileOutput extends OutputItem {
  template: TemplateDeclaration;
  session: CGenRequestSession;
}
