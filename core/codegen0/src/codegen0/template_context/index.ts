import type {Node} from '../../deps.ts'

import type {CodeFragment} from '../codefragment.ts'

export type {CodeFragment}

export type Argument =
  {kind: 'argument', items: CodeFragment, source?: Node, need_runtime_escaping?: boolean}
export type Statement =
  {kind: 'statement', items: CodeFragment, source?: Node}

export {generate_attstring_as_cast_to, generate_as_cast_to} from './cast.ts'
