import type {Node} from 'lrxml'

export type CodeFragment = string |
  {kind: 'name', text: string, source?: Node} |
  CodeFragment[]
