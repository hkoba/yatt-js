import {Node} from '../../deps.ts'

import {CodeFragment} from '../codefragment.ts'

export {CodeFragment}

export type Argument =
  {kind: 'argument', items: CodeFragment, source?: Node, need_runtime_escaping?: boolean}
export type Statement =
  {kind: 'statement', items: CodeFragment, source?: Node}

