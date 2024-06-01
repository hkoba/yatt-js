import type {ElementNode} from '../deps.ts'

import type {WidgetGenContext} from './context.ts'

import type {VarScope} from './varscope.ts'

import type {CodeFragment} from './codefragment.ts'

export type CGenMacro = (
  ctx: WidgetGenContext, scope: VarScope, node: ElementNode
) => {output: CodeFragment, fragment?: any}; // XXX: may need emitter abstraction

export type MacroDict = {[k: `macro_${string}`]: CGenMacro}
