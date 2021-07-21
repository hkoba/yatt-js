import { RawPart } from 'lrxml-js'

import { Variable } from './vartype'

export type Part = {
  kind: string
  name: string
  is_public: boolean
  argMap: Map<string, Variable>;
  varMap: Map<string, Variable>;
  raw_part?: RawPart //
  route?: string
}
