import {Node} from 'lrxml-js'

import {CodeGenContext} from './context'

import {VarScope} from './varscope'

export type CGenMacro = (
  ctx: CodeGenContext, scope: VarScope, node: Node & {kind: "element"}
) => string; // XXX: may need emitter abstraction

export type MacroDict = {[k: `macro_${string}`]: CGenMacro}
