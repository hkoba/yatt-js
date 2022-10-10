import {ElementNode} from 'lrxml'

import {CodeGenContext} from './context'

import {VarScope} from './varscope'

import {CodeFragment} from './codefragment'

export type CGenMacro = (
  ctx: CodeGenContext, scope: VarScope, node: ElementNode
) => {output: CodeFragment, fragment?: any}; // XXX: may need emitter abstraction

export type MacroDict = {[k: `macro_${string}`]: CGenMacro}
