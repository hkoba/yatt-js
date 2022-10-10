import {Node} from 'lrxml'

import {CodeFragment} from '../codefragment'

export {CodeFragment}

export type Argument =
  {kind: 'argument', items: CodeFragment, source?: Node, need_runtime_escaping?: boolean}
export type Statement =
  {kind: 'statement', items: CodeFragment, source?: Node}

